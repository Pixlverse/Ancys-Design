"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { isValidObjectId } from "mongoose"

import { AuthorizationError, requireRole } from "@/lib/auth"
import { connectToDatabase } from "@/lib/db"
import { Customer } from "@/models/customer"
import { Order } from "@/models/order"
import { Purchase } from "@/models/purchase"
import {
  purchaseInputSchema,
  purchaseTotal,
  type PurchaseInput,
} from "@/schemas/purchase"

const LIST_PATH = "/purchases"

export interface PurchaseFormState {
  error?: string
  fieldErrors?: Record<string, string>
}

type Parsed =
  | { ok: true; data: PurchaseInput }
  | { ok: false; state: PurchaseFormState }

function parsePayload(formData: FormData): Parsed {
  let payload: unknown
  try {
    payload = JSON.parse(String(formData.get("purchase") ?? "null"))
  } catch {
    return {
      ok: false,
      state: { error: "Could not read that purchase. Reload and try again." },
    }
  }

  const parsed = purchaseInputSchema.safeParse(payload)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      fieldErrors[issue.path.join(".") || "form"] ??= issue.message
    }
    return { ok: false, state: { fieldErrors } }
  }
  return { ok: true, data: parsed.data }
}

type Tags =
  | {
      ok: true
      orderId?: string
      orderNo?: string
      customerId?: string
    }
  | { ok: false; state: PurchaseFormState }

/**
 * Resolves the reference tags against the database. An order brings its own
 * customer, so the two tags can never disagree.
 */
async function resolveTags(data: PurchaseInput): Promise<Tags> {
  if (data.orderId) {
    const order = await Order.findOne({ _id: data.orderId, isDeleted: false })
      .select({ orderNo: 1, customerId: 1 })
      .lean()
    if (!order) return { ok: false, state: { error: "That order no longer exists." } }
    return {
      ok: true,
      orderId: String(order._id),
      orderNo: order.orderNo,
      customerId: String(order.customerId),
    }
  }

  if (data.customerId) {
    const customer = await Customer.findOne({
      _id: data.customerId,
      isDeleted: false,
    })
      .select({ _id: 1 })
      .lean()
    if (!customer) {
      return { ok: false, state: { error: "That customer no longer exists." } }
    }
    return { ok: true, customerId: String(customer._id) }
  }

  return { ok: true }
}

function fieldsFrom(data: PurchaseInput, tags: Extract<Tags, { ok: true }>) {
  return {
    purchasedOn: data.purchasedOn,
    lines: data.lines,
    // Recomputed here — the browser's running total is only a convenience.
    total: purchaseTotal(data.lines),
    vendor: data.vendor,
    paidBy: data.paidBy,
    billImages: data.billImages,
    orderId: tags.orderId,
    orderNo: tags.orderNo,
    customerId: tags.customerId,
    notes: data.notes,
  }
}

/**
 * Pages a purchase can touch. The order and customer pages show the purchases
 * tagged to them, so those are refreshed too.
 */
function revalidateFor(tags: { orderId?: string; customerId?: string }) {
  revalidatePath(LIST_PATH)
  if (tags.orderId) revalidatePath(`/orders/${tags.orderId}`)
  if (tags.customerId) revalidatePath(`/customers/${tags.customerId}`)
}

export async function createPurchase(
  _previous: PurchaseFormState,
  formData: FormData
): Promise<PurchaseFormState> {
  // Set when staff came from an order page, so they land back on that order.
  const returnToOrder = formData.get("returnTo") === "order"
  let destination: string

  try {
    const session = await requireRole("owner", "staff")

    const parsed = parsePayload(formData)
    if (!parsed.ok) return parsed.state

    await connectToDatabase()

    const tags = await resolveTags(parsed.data)
    if (!tags.ok) return tags.state

    await Purchase.create({
      ...fieldsFrom(parsed.data, tags),
      createdBy: session.user.id,
    })

    revalidateFor(tags)
    destination =
      returnToOrder && tags.orderId ? `/orders/${tags.orderId}` : LIST_PATH
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: error.message }
    console.error(error)
    return { error: "Could not save that purchase. Try again." }
  }

  redirect(destination)
}

export async function updatePurchase(
  _previous: PurchaseFormState,
  formData: FormData
): Promise<PurchaseFormState> {
  try {
    await requireRole("owner", "staff")

    const id = String(formData.get("purchaseId") ?? "")
    if (!isValidObjectId(id)) return { error: "That purchase could not be found." }

    const parsed = parsePayload(formData)
    if (!parsed.ok) return parsed.state

    await connectToDatabase()

    const tags = await resolveTags(parsed.data)
    if (!tags.ok) return tags.state

    const fields = fieldsFrom(parsed.data, tags)
    // Clearing a tag or the vendor must remove it, not leave the old value.
    const unset = Object.fromEntries(
      Object.entries(fields)
        .filter(([, value]) => value === undefined)
        .map(([key]) => [key, 1])
    )
    const set = Object.fromEntries(
      Object.entries(fields).filter(([, value]) => value !== undefined)
    )

    const previous = await Purchase.findOneAndUpdate(
      { _id: id, isDeleted: false },
      Object.keys(unset).length > 0 ? { $set: set, $unset: unset } : { $set: set }
    )
      .select({ orderId: 1, customerId: 1 })
      .lean()
    if (!previous) return { error: "That purchase could not be found." }

    revalidateFor(tags)
    // The old tags' pages still list it until refreshed.
    revalidateFor({
      orderId: previous.orderId ? String(previous.orderId) : undefined,
      customerId: previous.customerId ? String(previous.customerId) : undefined,
    })
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: error.message }
    console.error(error)
    return { error: "Could not save that purchase. Try again." }
  }

  redirect(LIST_PATH)
}

/** Soft delete (rule 4). Owner only — it changes the shop's expense figures. */
export async function deletePurchase(formData: FormData): Promise<void> {
  try {
    await requireRole("owner")

    const id = String(formData.get("purchaseId") ?? "")
    if (!isValidObjectId(id)) return

    await connectToDatabase()
    const purchase = await Purchase.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { $set: { isDeleted: true } }
    )
      .select({ orderId: 1, customerId: 1 })
      .lean()

    if (purchase) {
      revalidateFor({
        orderId: purchase.orderId ? String(purchase.orderId) : undefined,
        customerId: purchase.customerId ? String(purchase.customerId) : undefined,
      })
    }
  } catch (error) {
    if (error instanceof AuthorizationError) return
    throw error
  }

  redirect(LIST_PATH)
}
