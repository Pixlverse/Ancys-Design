"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { isValidObjectId } from "mongoose"

import { AuthorizationError, requireRole } from "@/lib/auth"
import { connectToDatabase } from "@/lib/db"
import { GarmentType } from "@/models/garmentType"
import { MeasurementSet } from "@/models/measurementSet"
import {
  buildMeasurementValuesSchema,
  measurementSetInputSchema,
} from "@/schemas/measurementSet"

export interface MeasurementFormState {
  error?: string
  fieldErrors?: Record<string, string>
}

export async function saveMeasurementSet(
  _previous: MeasurementFormState,
  formData: FormData
): Promise<MeasurementFormState> {
  let customerId: string

  try {
    const session = await requireRole("owner", "staff")

    const parsed = measurementSetInputSchema.safeParse({
      customerId: formData.get("customerId"),
      garmentTypeId: formData.get("garmentTypeId"),
      notes: formData.get("notes"),
    })

    if (!parsed.success) {
      return { error: "That form was incomplete. Reload and try again." }
    }

    if (
      !isValidObjectId(parsed.data.customerId) ||
      !isValidObjectId(parsed.data.garmentTypeId)
    ) {
      return { error: "That form was incomplete. Reload and try again." }
    }

    let rawValues: unknown
    try {
      rawValues = JSON.parse(String(formData.get("values") ?? "{}"))
    } catch {
      return { error: "Could not read the measurements. Reload and try again." }
    }

    await connectToDatabase()

    // The validator is built from this garment type's own field definitions,
    // which the owner can change at any time.
    const garmentType = await GarmentType.findOne({
      _id: parsed.data.garmentTypeId,
      isDeleted: false,
    })
      .select({ measurementFields: 1 })
      .lean()

    if (!garmentType) return { error: "That garment type no longer exists." }

    const fields = garmentType.measurementFields
      .slice()
      .sort((a, b) => a.order - b.order)

    const values = buildMeasurementValuesSchema(fields).safeParse(rawValues)

    if (!values.success) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of values.error.issues) {
        const key = issue.path.join(".")
        fieldErrors[key] ??=
          issue.code === "invalid_type" ? "Required" : issue.message
      }
      return { fieldErrors }
    }

    // Always insert. An old set is what an old order was stitched from, so it is
    // never overwritten (CLAUDE.md section 5).
    await MeasurementSet.create({
      customerId: parsed.data.customerId,
      garmentTypeId: parsed.data.garmentTypeId,
      values: values.data,
      takenOn: new Date(),
      takenBy: session.user.id,
      notes: parsed.data.notes,
    })

    customerId = parsed.data.customerId
  } catch (error) {
    if (error instanceof AuthorizationError) return { error: error.message }
    console.error(error)
    return { error: "Could not save those measurements. Try again." }
  }

  revalidatePath(`/customers/${customerId}`)
  redirect(`/customers/${customerId}`)
}
