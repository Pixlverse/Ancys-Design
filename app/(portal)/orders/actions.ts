"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

import { AuthorizationError, requireRole } from "@/lib/auth"
import { connectToDatabase } from "@/lib/db"
import { nextOrderNo } from "@/lib/orders/orderNumber"
import { calculateTotals } from "@/lib/orders/totals"
import { Customer } from "@/models/customer"
import { GarmentType } from "@/models/garmentType"
import { MeasurementSet } from "@/models/measurementSet"
import { Order, type OrderItem } from "@/models/order"
import { buildMeasurementValuesSchema } from "@/schemas/measurementSet"
import {
  orderInputSchema,
  promisedDateFrom,
  type OrderItemInput,
} from "@/schemas/order"
import { Types, isValidObjectId } from "mongoose"

export interface OrderFormState {
  error?: string
  fieldErrors?: Record<string, string>
}

export async function createOrder(
  _previous: OrderFormState,
  formData: FormData
): Promise<OrderFormState> {
  let orderId: string

  try {
    const session = await requireRole("owner", "staff")

    let payload: unknown
    try {
      payload = JSON.parse(String(formData.get("order") ?? "null"))
    } catch {
      return { error: "Could not read that order. Reload and try again." }
    }

    const parsed = orderInputSchema.safeParse(payload)
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        fieldErrors[issue.path.join(".") || "form"] ??= issue.message
      }
      return { fieldErrors }
    }

    await connectToDatabase()

    const customer = await Customer.findOne({
      _id: parsed.data.customerId,
      isDeleted: false,
    })
      .select({ _id: 1 })
      .lean()
    if (!customer) return { error: "That customer no longer exists." }

    // One lookup for every garment type referenced, so the names and the
    // measurement definitions come from the database, not the browser.
    const built = await buildItems(parsed.data, session.user.id)
    if (!built.ok) return built.state
    const items = built.items

    // Recomputed here from the snapshotted rates — the browser's arithmetic is
    // a convenience for the staff member, never the number that gets stored.
    const totals = calculateTotals(
      items,
      parsed.data.discount,
      parsed.data.advancePaid
    )

    const order = await Order.create({
      orderNo: await nextOrderNo(),
      customerId: parsed.data.customerId,
      status: "draft",
      items,
      ...totals,
      promisedDate: promisedDateFrom(items),
      createdBy: session.user.id,
    })

    orderId = String(order._id)
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: error.message }
    console.error(error)
    return { error: "Could not save that order. Try again." }
  }

  revalidatePath("/orders")
  redirect(`/orders/${orderId}`)
}

/**
 * Edits a live order. Delivered and cancelled orders are history and stay put.
 *
 * Each garment keeps its stage and its assignee across the edit; only what the
 * form owns — garment type, rate, quantity, cloth, note, due date, images and
 * measurements — is replaced.
 */
export async function updateOrder(
  _previous: OrderFormState,
  formData: FormData
): Promise<OrderFormState> {
  let orderId: string

  try {
    const session = await requireRole("owner", "staff")

    const id = String(formData.get("orderId") ?? "")
    if (!isValidObjectId(id)) {
      return { error: "That order could not be found." }
    }
    orderId = id

    let payload: unknown
    try {
      payload = JSON.parse(String(formData.get("order") ?? "null"))
    } catch {
      return { error: "Could not read that order. Reload and try again." }
    }

    const parsed = orderInputSchema.safeParse(payload)
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        fieldErrors[issue.path.join(".") || "form"] ??= issue.message
      }
      return { fieldErrors }
    }

    await connectToDatabase()

    const existing = await Order.findOne({ _id: id, isDeleted: false })
      .select({ status: 1, items: 1 })
      .lean()
    if (!existing) return { error: "That order could not be found." }

    // History is not editable: a delivered order is what the shop actually did,
    // and a cancelled one is void.
    if (existing.status === "delivered" || existing.status === "cancelled") {
      return {
        error: `A ${existing.status} order cannot be changed.`,
      }
    }

    const built = await buildItems(
      parsed.data,
      session.user.id,
      existing.items
    )
    if (!built.ok) return built.state

    const totals = calculateTotals(
      built.items,
      parsed.data.discount,
      parsed.data.advancePaid
    )

    // Status is untouched here on purpose — it only ever moves through
    // lib/orders/transition.ts (rule 8).
    await Order.updateOne(
      {
        _id: id,
        isDeleted: false,
        status: { $nin: ["delivered", "cancelled"] },
      },
      {
        $set: {
          items: built.items,
          ...totals,
          promisedDate: promisedDateFrom(built.items),
        },
      }
    )
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: error.message }
    console.error(error)
    return { error: "Could not save those changes. Try again." }
  }

  revalidatePath("/orders")
  revalidatePath(`/orders/${orderId}`)
  redirect(`/orders/${orderId}`)
}

/** Explicitly discriminated: OrderFormState's `error` is optional, so an
 *  `"error" in result` check would not narrow reliably. */
type BuiltItems =
  | { ok: true; items: OrderItem[] }
  | { ok: false; state: OrderFormState }

/**
 * Turns validated input into order items: looks each garment type up so the
 * name comes from the database, and saves any measurements taken inline as a
 * real measurement set before the item points at it.
 */
async function buildItems(
  input: { customerId: string; items: readonly OrderItemInput[] },
  userId: string,
  /** The order's current items, when editing rather than creating. */
  existing: readonly OrderItem[] = []
): Promise<BuiltItems> {
  const existingById = new Map(existing.map((item) => [String(item._id), item]))

  const garmentTypeIds = [
    ...new Set(input.items.map((item) => item.garmentTypeId)),
  ]
  const garmentTypes = await GarmentType.find({
    _id: { $in: garmentTypeIds },
    isDeleted: false,
  }).lean()

  const garmentTypeById = new Map(
    garmentTypes.map((garmentType) => [String(garmentType._id), garmentType])
  )

  if (garmentTypeById.size !== garmentTypeIds.length) {
    return { ok: false, state: { error: "One of those garment types no longer exists." } }
  }

  const items: OrderItem[] = []

  for (const [index, item] of input.items.entries()) {
    const garmentType = garmentTypeById.get(item.garmentTypeId)
    if (!garmentType) {
      return {
        ok: false,
        state: { error: "One of those garment types no longer exists." },
      }
    }

    let measurementSetId = item.measurementSetId
      ? new Types.ObjectId(item.measurementSetId)
      : undefined

    // Measurements taken while writing the order become a real set, so the
    // order references history the same way any other order does.
    if (item.newMeasurements) {
      const fields = garmentType.measurementFields
        .slice()
        .sort((a, b) => a.order - b.order)

      const values = buildMeasurementValuesSchema(fields).safeParse(
        item.newMeasurements
      )

      if (!values.success) {
        // Name the field and say what is wrong with it. "Check the
        // measurements" sent staff hunting across a dozen boxes for a number
        // the schema could already point at.
        const labelByKey = new Map(fields.map((f) => [f.key, f.label]))
        const detail = values.error.issues
          .map((issue) => {
            const key = String(issue.path[0] ?? "")
            return `${labelByKey.get(key) ?? key}: ${issue.message}`
          })
          .join(". ")

        return {
          ok: false,
          state: {
            fieldErrors: {
              [`items.${index}.newMeasurements`]:
                detail || "Check the measurements for this garment.",
            },
          },
        }
      }

      const created = await MeasurementSet.create({
        customerId: input.customerId,
        garmentTypeId: item.garmentTypeId,
        values: values.data,
        takenOn: new Date(),
        takenBy: userId,
      })
      measurementSetId = created._id
    }

    // An edited garment keeps its identity, its place on the workbench and
    // whoever is making it. Only what the form actually edits is replaced —
    // otherwise editing a price would quietly reset a half-stitched blouse to
    // pending and unassign it.
    const previous = item.itemId ? existingById.get(item.itemId) : undefined

    items.push({
      _id: previous?._id ?? new Types.ObjectId(),
      garmentTypeId: new Types.ObjectId(item.garmentTypeId),
      // Snapshotted. Renaming the garment type later must not rewrite history.
      garmentTypeName: garmentType.name,
      rate: item.rate,
      quantity: item.quantity,
      measurementSetId,
      workType: item.workType,
      // With pieces, each piece carries its own cloth and photos; the item's
      // copies would only go stale beside them.
      ...(item.pieces
        ? { images: [], pieces: item.pieces }
        : {
            clothLength: item.clothLength,
            clothSource: item.clothSource,
            images: item.images,
          }),
      note: item.note,
      dueDate: item.dueDate,
      itemStatus: previous?.itemStatus ?? "pending",
      assignedTo: previous?.assignedTo,
    })
  }

  return { ok: true, items }
}
