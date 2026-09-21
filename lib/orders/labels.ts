import type { OrderItemStatus, OrderStatus } from "@/schemas/order"

/** How statuses read on screen. One place, so the list and the page agree. */
export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  draft: "Draft",
  awaiting_confirmation: "Awaiting confirmation",
  changes_requested: "Changes requested",
  confirmed: "Confirmed",
  in_progress: "In progress",
  ready: "Ready",
  delivered: "Delivered",
  cancelled: "Cancelled",
}

/** Compact forms, for pills that live in a fixed-width column. */
export const ORDER_STATUS_SHORT_LABELS: Record<OrderStatus, string> = {
  draft: "Draft",
  awaiting_confirmation: "Awaiting",
  changes_requested: "Changes",
  confirmed: "Confirmed",
  in_progress: "Working",
  ready: "Ready",
  delivered: "Delivered",
  cancelled: "Cancelled",
}

export const ORDER_ITEM_STATUS_LABELS: Record<OrderItemStatus, string> = {
  pending: "Pending",
  cutting: "Cutting",
  stitching: "Stitching",
  finishing: "Finishing",
  ready: "Ready",
  delivered: "Delivered",
}

/**
 * A tone per stage, so a garment's place on the workbench is readable at a
 * glance rather than by reading the word. Cool early, warm as it finishes.
 */
export const ORDER_ITEM_STATUS_TONES: Record<OrderItemStatus, string> = {
  pending: "bg-slate-100 text-slate-700 ring-slate-200",
  cutting: "bg-amber-100 text-amber-800 ring-amber-200",
  stitching: "bg-violet-100 text-violet-700 ring-violet-200",
  finishing: "bg-sky-100 text-sky-700 ring-sky-200",
  ready: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  delivered: "bg-teal-100 text-teal-800 ring-teal-200",
}

export const ORDER_STATUS_TONES: Record<OrderStatus, string> = {
  draft: "bg-slate-100 text-slate-700 ring-slate-200",
  awaiting_confirmation: "bg-amber-100 text-amber-800 ring-amber-200",
  changes_requested: "bg-fuchsia-100 text-fuchsia-700 ring-fuchsia-200",
  confirmed: "bg-sky-100 text-sky-700 ring-sky-200",
  in_progress: "bg-violet-100 text-violet-700 ring-violet-200",
  ready: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  delivered: "bg-teal-100 text-teal-800 ring-teal-200",
  cancelled: "bg-rose-100 text-rose-700 ring-rose-200",
}

/** The order a garment passes through the shop, for rendering a tracker. */
export const ITEM_STAGE_ORDER: readonly OrderItemStatus[] = [
  "pending",
  "cutting",
  "stitching",
  "finishing",
  "ready",
  "delivered",
]

/**
 * The order's own lifecycle, for the same purpose. Cancelled and
 * changes_requested sit outside it: neither is a step forward, they are places
 * an order stops.
 */
export const ORDER_STAGE_ORDER: readonly OrderStatus[] = [
  "draft",
  "awaiting_confirmation",
  "confirmed",
  "in_progress",
  "ready",
  "delivered",
]

/** Customer lifecycle. An enquiry is amber; a paying customer is settled green. */
export const CUSTOMER_STATUS_TONES: Record<"lead" | "active", string> = {
  lead: "bg-amber-100 text-amber-800 ring-amber-200",
  active: "bg-emerald-100 text-emerald-800 ring-emerald-200",
}

/** Anything switched off, anywhere. */
export const INACTIVE_TONE = "bg-slate-100 text-slate-600 ring-slate-200"
