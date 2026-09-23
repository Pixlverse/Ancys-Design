import { z } from "zod"

import { parseDateInputIST } from "@/lib/dates"
import { rupeesToPaiseSchema } from "@/schemas/money"

/** The order's own lifecycle. Transitions go through lib/orders/transition.ts. */
export const ORDER_STATUSES = [
  "draft",
  "awaiting_confirmation",
  // The customer looked at the order and asked for something to change. Staff
  // edit it, then send it again. Distinct from draft: it has been out already.
  "changes_requested",
  "confirmed",
  "in_progress",
  "ready",
  "delivered",
  "cancelled",
] as const
export const orderStatusSchema = z.enum(ORDER_STATUSES)
export type OrderStatus = z.infer<typeof orderStatusSchema>

/** Where a single garment has got to on the workbench. */
export const ORDER_ITEM_STATUSES = [
  "pending",
  "cutting",
  "stitching",
  "finishing",
  "ready",
  "delivered",
] as const
export const orderItemStatusSchema = z.enum(ORDER_ITEM_STATUSES)
export type OrderItemStatus = z.infer<typeof orderItemStatusSchema>

/**
 * Some orders are design work only — the shop draws or styles the piece and
 * somebody else stitches it. Those items carry a reference and notes, and no
 * measurements or cloth at all.
 *
 * Beyond CLAUDE.md section 5, which assumes every item is stitched.
 */
export const WORK_TYPES = ["stitching", "design_only"] as const
export const workTypeSchema = z.enum(WORK_TYPES)
export type WorkType = z.infer<typeof workTypeSchema>

/** Customers usually bring their own cloth; sometimes the shop supplies it. */
export const CLOTH_SOURCES = ["customer", "shop"] as const
export const clothSourceSchema = z.enum(CLOTH_SOURCES)
export type ClothSource = z.infer<typeof clothSourceSchema>

export const ORDER_IMAGE_KINDS = ["cloth", "reference", "pattern"] as const
export const orderImageKindSchema = z.enum(ORDER_IMAGE_KINDS)
export type OrderImageKind = z.infer<typeof orderImageKindSchema>

export const orderImageSchema = z.object({
  url: z.url(),
  publicId: z.string().trim().min(1),
  kind: orderImageKindSchema,
})

/** A date input's value, read as a day in the shop's calendar. */
export const dateInputSchema = z.string().transform((value, ctx) => {
  const parsed = parseDateInputIST(value.trim())
  if (!parsed) {
    ctx.addIssue({ code: "custom", message: "Pick a date" })
    return z.NEVER
  }
  return parsed
})

const objectIdSchema = z
  .string()
  .trim()
  .regex(/^[0-9a-f]{24}$/i, "Not a valid id")

/** Metres of cloth, as typed. Blank or nonsense means "not measured". */
const clothLengthSchema = z
  .union([z.string(), z.number()])
  .transform((value) => {
    const text = String(value).trim()
    if (text === "") return undefined
    const parsed = Number(text)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined
  })
  .optional()

const noteSchema = z
  .string()
  .trim()
  .max(1000)
  .transform((value) => (value === "" ? undefined : value))
  .optional()

/**
 * One physical garment within a line of several — three churidar sets from
 * three different cloths. Measurements, rate and due date stay on the item and
 * are shared; what the customer brought for each piece lives here.
 *
 * Beyond CLAUDE.md section 5, which gives an item one set of cloth and photos.
 */
export const orderItemPieceInputSchema = z.object({
  clothSource: clothSourceSchema.optional(),
  clothLength: clothLengthSchema,
  images: z.array(orderImageSchema).max(30).default([]),
  note: noteSchema,
})

export type OrderItemPieceInput = z.infer<typeof orderItemPieceInputSchema>

export const orderItemInputSchema = z.object({
  /**
   * Present when editing: identifies the garment this row already is, so its
   * progress on the workbench and who it is with survive the edit.
   */
  itemId: objectIdSchema.optional(),
  garmentTypeId: objectIdSchema,
  /** Editable for this order; snapshotted so the rate card can move freely. */
  rate: rupeesToPaiseSchema,
  quantity: z.int().min(1, "At least one").max(99),
  /** Reuse of a measurement set the customer already has. */
  /** Stitching work, or design only. */
  workType: workTypeSchema.default("stitching"),
  /**
   * Metres of cloth, as the customer brought it. Quoted back to them in the
   * confirmation message so they can check it before work starts.
   */
  clothLength: clothLengthSchema,
  measurementSetId: objectIdSchema.optional(),
  /**
   * Measurements taken inline while writing the order. Validated against the
   * garment type's own fields server-side, then saved as a new set before the
   * order is created — so the order references a real set, like any other.
   */
  newMeasurements: z.record(z.string(), z.number()).optional(),
  /** Not asked for on design-only work, where no cloth is involved. */
  clothSource: clothSourceSchema.optional(),
  images: z.array(orderImageSchema).max(30).default([]),
  /** With pieces, this is the note that applies to all of them. */
  note: noteSchema,
  /**
   * Present only when the pieces differ from one another. Absent means every
   * piece is the same, and the item's own cloth, photos and note describe all.
   */
  pieces: z.array(orderItemPieceInputSchema).max(99).optional(),
  dueDate: dateInputSchema,
})
  .superRefine((item, ctx) => {
    if (item.pieces) {
      if (item.pieces.length !== item.quantity) {
        ctx.addIssue({
          code: "custom",
          path: ["pieces"],
          message: `Fill in all ${item.quantity} pieces, or mark them the same`,
        })
      }
      if (item.workType === "stitching") {
        item.pieces.forEach((piece, index) => {
          if (!piece.clothSource) {
            ctx.addIssue({
              code: "custom",
              path: ["pieces", index, "clothSource"],
              message: `Say whose cloth piece ${index + 1} is`,
            })
          }
        })
      }
      return
    }

    // Stitching needs to know whose cloth it is; design work does not.
    if (item.workType === "stitching" && !item.clothSource) {
      ctx.addIssue({
        code: "custom",
        path: ["clothSource"],
        message: "Say whose cloth this is",
      })
    }
  })

export type OrderItemInput = z.infer<typeof orderItemInputSchema>

export const orderInputSchema = z.object({
  customerId: objectIdSchema,
  items: z
    .array(orderItemInputSchema)
    .min(1, "Add at least one garment")
    .max(30),
  discount: rupeesToPaiseSchema.default(0),
  advancePaid: rupeesToPaiseSchema.default(0),
})

export type OrderInput = z.infer<typeof orderInputSchema>

/**
 * The latest due date across the items, denormalised onto the order so the
 * calendar and the orders list can sort without opening every item.
 */
export function promisedDateFrom(
  items: readonly { dueDate: Date }[]
): Date | undefined {
  if (items.length === 0) return undefined
  return items.reduce(
    (latest, item) => (item.dueDate > latest ? item.dueDate : latest),
    items[0].dueDate
  )
}
