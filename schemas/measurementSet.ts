import { z } from "zod"

import type { MeasurementFieldInput } from "@/schemas/garmentType"

/**
 * Measurement values are numbers, never strings, and decimals are normal —
 * 32.5 is a real chest measurement (CLAUDE.md rule 7).
 */
export const measurementValueSchema = z
  .number()
  .positive("Must be more than 0")
  .max(200, "That looks too large — check the number")

export type MeasurementValues = Record<string, number>

/**
 * Builds a validator from the garment type's own field definitions. The fields
 * are data the owner edits, so the schema has to be built at runtime rather than
 * written out — there is no fixed list of measurements anywhere in this codebase.
 */
export function buildMeasurementValuesSchema(
  fields: readonly MeasurementFieldInput[]
) {
  const shape: Record<string, z.ZodType> = {}

  for (const field of fields) {
    shape[field.key] = field.required
      ? measurementValueSchema
      : measurementValueSchema.optional()
  }

  return (
    z
      .object(shape)
      // Strip anything not in the definition, so a stale form cannot write junk keys.
      .strip()
      // Drop the optional fields nobody filled in, so what is stored is exactly
      // the measurements that were taken — and so the result really is
      // Record<string, number> rather than one with undefined holes in it.
      .transform((parsed) => {
        const values: MeasurementValues = {}
        for (const [key, value] of Object.entries(parsed)) {
          if (typeof value === "number") values[key] = value
        }
        return values
      })
  )
}

export const measurementSetInputSchema = z.object({
  customerId: z.string().trim().min(1),
  garmentTypeId: z.string().trim().min(1),
  notes: z
    .string()
    .trim()
    .max(1000)
    .transform((value) => (value === "" ? undefined : value))
    .optional(),
})
