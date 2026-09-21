import { z } from "zod"

/**
 * What the shop gets told about. Each type is one reason a reminder exists, and
 * the reminder job creates at most one of each per order item per day.
 */
export const NOTIFICATION_TYPES = [
  "due_in_3_days",
  "due_tomorrow",
  "overdue",
  "awaiting_confirmation",
  "customer_responded",
] as const

export const notificationTypeSchema = z.enum(NOTIFICATION_TYPES)
export type NotificationType = z.infer<typeof notificationTypeSchema>

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  due_in_3_days: "Due in 3 days",
  due_tomorrow: "Due tomorrow",
  overdue: "Overdue",
  awaiting_confirmation: "Waiting on the customer",
  customer_responded: "The customer replied",
}

/** One tone per reason, matching the calendar's due colours. */
export const NOTIFICATION_TYPE_TONES: Record<NotificationType, string> = {
  overdue: "bg-red-100 text-red-800 ring-red-200",
  due_tomorrow: "bg-amber-100 text-amber-800 ring-amber-200",
  due_in_3_days: "bg-yellow-100 text-yellow-800 ring-yellow-200",
  awaiting_confirmation: "bg-sky-100 text-sky-800 ring-sky-200",
  customer_responded: "bg-fuchsia-100 text-fuchsia-800 ring-fuchsia-200",
}
