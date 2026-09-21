import { z } from "zod"

import { toPaise } from "@/lib/money"

/**
 * Accepts a rupee amount as staff type it and yields integer paise (rule 1).
 * Put this on any form field that holds money — never accept paise from a form.
 */
export const rupeesToPaiseSchema = z
  .union([z.string(), z.number()])
  .transform((value, ctx) => {
    try {
      return toPaise(value)
    } catch {
      ctx.addIssue({ code: "custom", message: "Enter an amount like 450 or 450.50" })
      return z.NEVER
    }
  })
  .refine((paise) => paise >= 0, "Amount cannot be negative")
