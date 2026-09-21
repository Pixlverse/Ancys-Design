import { z } from "zod"

import { normalizePhone } from "@/lib/phone"

/** A customer is a lead until their first order is confirmed (CLAUDE.md section 5). */
export const CUSTOMER_STATUSES = ["lead", "active"] as const
export const customerStatusSchema = z.enum(CUSTOMER_STATUSES)
export type CustomerStatus = z.infer<typeof customerStatusSchema>

/** Normalises on the way in, so nothing downstream ever sees a typed phone number. */
export const phoneSchema = z.string().transform((value, ctx) => {
  const normalized = normalizePhone(value)
  if (!normalized) {
    ctx.addIssue({
      code: "custom",
      message: "Enter a 10-digit mobile number",
    })
    return z.NEVER
  }
  return normalized
})

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? undefined : value))
    .optional()

export const customerInputSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  phone: phoneSchema,
  altPhone: z
    .string()
    .trim()
    .transform((value) => (value === "" ? undefined : value))
    .optional()
    .pipe(phoneSchema.optional()),
  address: optionalText(300),
  notes: optionalText(1000),
})

export type CustomerInput = z.infer<typeof customerInputSchema>
