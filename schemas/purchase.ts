import { z } from "zod"

import { dateInputSchema, objectIdSchema } from "@/schemas/order"
import { rupeesToPaiseSchema } from "@/schemas/money"

/**
 * Something the shop bought for itself — thread, lining, a metre of cloth.
 * It is a shop expense and nothing more: it never touches an order's bill.
 *
 * Tagging an order or a customer is for reference only, so staff can later see
 * what was bought for whose work. Beyond CLAUDE.md section 5, which has no
 * expenses at all.
 */

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => (value === "" ? undefined : value))
    .optional()

/** One thing on the bill. Free text — no categories. */
export const purchaseLineInputSchema = z.object({
  description: z.string().trim().min(1, "What was bought?").max(120),
  amount: rupeesToPaiseSchema.refine((paise) => paise > 0, "Enter the amount"),
})

export type PurchaseLineInput = z.infer<typeof purchaseLineInputSchema>

/** A photo of the paper bill. Photos only. */
export const billImageSchema = z.object({
  url: z.url(),
  publicId: z.string().trim().min(1),
})

export const purchaseInputSchema = z.object({
  purchasedOn: dateInputSchema,
  lines: z
    .array(purchaseLineInputSchema)
    .min(1, "Add at least one item")
    .max(50),
  vendor: optionalText(80),
  /** Who went and paid, as a name. */
  paidBy: optionalText(80),
  billImages: z.array(billImageSchema).max(10).default([]),
  /** Reference tags. With an order, the customer is taken from the order. */
  orderId: objectIdSchema.optional(),
  customerId: objectIdSchema.optional(),
  notes: optionalText(1000),
})

export type PurchaseInput = z.infer<typeof purchaseInputSchema>

/** The bill total, in paise. Always computed on the server from the lines. */
export function purchaseTotal(lines: readonly { amount: number }[]): number {
  return lines.reduce((sum, line) => sum + line.amount, 0)
}
