import { z } from "zod"

import { rupeesToPaiseSchema } from "@/schemas/money"

/**
 * Measurement units. Inches are the house default (CLAUDE.md rule 7); a garment
 * that the shop measures in centimetres can say so per field.
 */
export const MEASUREMENT_UNITS = ["in", "cm"] as const
export const measurementUnitSchema = z.enum(MEASUREMENT_UNITS)
export type MeasurementUnit = z.infer<typeof measurementUnitSchema>

/**
 * `key` is the property name a measurement value is stored under, so it is fixed
 * once a field exists — renaming it would orphan every historical measurement
 * set that used it. The UI locks it after creation; the label stays editable.
 */
export const measurementFieldSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1, "Key is required")
    .max(40)
    .regex(
      /^[a-z][a-zA-Z0-9]*$/,
      "Key must be camelCase, starting with a lowercase letter"
    ),
  label: z.string().trim().min(1, "Label is required").max(40),
  unit: measurementUnitSchema,
  required: z.boolean(),
  order: z.int().min(0),
})

export type MeasurementFieldInput = z.infer<typeof measurementFieldSchema>

export const garmentTypeInputSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(60),
    baseRate: rupeesToPaiseSchema,
    isActive: z.boolean(),
    measurementFields: z
      .array(measurementFieldSchema)
      .max(40, "That is more measurement fields than any garment needs"),
  })
  .superRefine((value, ctx) => {
    const seen = new Set<string>()
    value.measurementFields.forEach((field, index) => {
      if (seen.has(field.key)) {
        ctx.addIssue({
          code: "custom",
          path: ["measurementFields", index, "key"],
          message: `Duplicate key "${field.key}"`,
        })
      }
      seen.add(field.key)
    })
  })
  .transform((value) => ({
    ...value,
    // Reordering in the UI only swaps positions; canonicalise to 0..n-1 here so
    // stored order never drifts from array position.
    measurementFields: value.measurementFields.map((field, index) => ({
      ...field,
      order: index,
    })),
  }))

export type GarmentTypeInput = z.infer<typeof garmentTypeInputSchema>

/** Turns "Sleeve length" into "sleeveLength" as a starting suggestion. */
export function suggestKey(label: string): string {
  const words = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)

  if (words.length === 0) return ""

  return words
    .map((word, index) =>
      index === 0 ? word : word[0].toUpperCase() + word.slice(1)
    )
    .join("")
    .replace(/^[^a-z]+/, "")
}
