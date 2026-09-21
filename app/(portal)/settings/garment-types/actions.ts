"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { z } from "zod"

import { AuthorizationError, requireRole } from "@/lib/auth"
import { connectToDatabase } from "@/lib/db"
import { GarmentType } from "@/models/garmentType"
import { garmentTypeInputSchema } from "@/schemas/garmentType"

const LIST_PATH = "/settings/garment-types"

export interface GarmentTypeFormState {
  error?: string
  /** Keyed by the zod issue path, e.g. `measurementFields.0.key`. */
  fieldErrors?: Record<string, string>
}

/** The editor posts its rows as JSON, since the row count is dynamic. */
const payloadSchema = z.object({
  id: z.string().trim().optional(),
  name: z.string(),
  baseRate: z.string(),
  isActive: z.string().optional(),
  measurementFields: z.string(),
})

export async function saveGarmentType(
  _previous: GarmentTypeFormState,
  formData: FormData
): Promise<GarmentTypeFormState> {
  let savedId: string

  try {
    await requireRole("owner")

    const raw = payloadSchema.safeParse({
      id: formData.get("id") ?? undefined,
      name: formData.get("name"),
      baseRate: formData.get("baseRate"),
      isActive: formData.get("isActive") ?? undefined,
      measurementFields: formData.get("measurementFields"),
    })

    if (!raw.success) {
      return { error: "That form was incomplete. Reload and try again." }
    }

    let measurementFields: unknown
    try {
      measurementFields = JSON.parse(raw.data.measurementFields)
    } catch {
      return { error: "Could not read the measurement fields. Reload and try again." }
    }

    const parsed = garmentTypeInputSchema.safeParse({
      name: raw.data.name,
      baseRate: raw.data.baseRate,
      isActive: raw.data.isActive === "on",
      measurementFields,
    })

    if (!parsed.success) {
      return { fieldErrors: collectFieldErrors(parsed.error) }
    }

    await connectToDatabase()

    if (raw.data.id) {
      const updated = await GarmentType.findOneAndUpdate(
        { _id: raw.data.id, isDeleted: false },
        { $set: parsed.data },
        { returnDocument: "after" }
      )
      if (!updated) return { error: "That garment type no longer exists." }
      savedId = String(updated._id)
    } else {
      const created = await GarmentType.create(parsed.data)
      savedId = String(created._id)
    }
  } catch (error) {
    return { error: describe(error) }
  }

  revalidatePath(LIST_PATH)
  revalidatePath(`${LIST_PATH}/${savedId}`)
  redirect(LIST_PATH)
}

/** Deactivating hides a garment from new orders without touching past ones. */
export async function setGarmentTypeActive(formData: FormData): Promise<void> {
  await requireRole("owner")

  const parsed = z
    .object({ id: z.string().trim().min(1), isActive: z.enum(["true", "false"]) })
    .safeParse({ id: formData.get("id"), isActive: formData.get("isActive") })

  if (!parsed.success) return

  await connectToDatabase()
  await GarmentType.updateOne(
    { _id: parsed.data.id, isDeleted: false },
    { $set: { isActive: parsed.data.isActive === "true" } }
  )

  revalidatePath(LIST_PATH)
}

function collectFieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {}
  for (const issue of error.issues) {
    const path = issue.path.join(".") || "form"
    result[path] ??= issue.message
  }
  return result
}

function describe(error: unknown): string {
  if (error instanceof AuthorizationError) return error.message

  // Mongo's unique index on name.
  if (
    error instanceof Error &&
    "code" in error &&
    (error as { code?: number }).code === 11000
  ) {
    return "A garment type with that name already exists."
  }

  console.error(error)
  return "Could not save that. Try again."
}
