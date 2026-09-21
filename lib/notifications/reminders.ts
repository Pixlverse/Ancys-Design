import type { AnyBulkWriteOperation } from "mongoose"

import { daysUntil, endOfDayIST, formatDate, startOfDayIST, toDateInputIST } from "@/lib/dates"
import { connectToDatabase } from "@/lib/db"
import { Customer } from "@/models/customer"
import { Notification, type NotificationDocument } from "@/models/notification"
import { Order } from "@/models/order"
import type { NotificationType } from "@/schemas/notification"

/**
 * The nightly sweep that makes sure nothing is forgotten.
 *
 * Idempotent by construction: every notification carries a dedupeKey of
 * "reason : thing : IST day", with a unique index behind it, so running the job
 * twice in one day upserts the same documents rather than duplicating them.
 *
 * Sends no messages to customers — that is phase 5.
 */

/** An order sitting unanswered this long is worth chasing. */
const AWAITING_CONFIRMATION_HOURS = 48

export interface ReminderRun {
  created: number
  alreadyPresent: number
  byType: Record<NotificationType, number>
}

function dedupeKey(
  type: NotificationType,
  subjectId: string,
  runDay: string
): string {
  return `${type}:${subjectId}:${runDay}`
}

export async function generateReminders(now: Date = new Date()): Promise<ReminderRun> {
  await connectToDatabase()

  const runDay = toDateInputIST(now)
  const operations: AnyBulkWriteOperation<NotificationDocument>[] = []
  const byType: Record<NotificationType, number> = {
    due_in_3_days: 0,
    due_tomorrow: 0,
    overdue: 0,
    awaiting_confirmation: 0,
    // Raised by the customer on the public order page, not by this job.
    customer_responded: 0,
  }

  // --- Garments with a due date worth flagging -----------------------------
  //
  // Only live work: a delivered or cancelled order has nothing to chase, and a
  // delivered garment is done whatever its date. Bounded by the IST day three
  // days out, so the query never walks the whole order book.
  const horizon = endOfDayIST(addDays(now, 3))

  const orders = await Order.find({
    isDeleted: false,
    status: { $nin: ["delivered", "cancelled", "draft"] },
    "items.dueDate": { $lte: horizon },
  })
    .select({ orderNo: 1, customerId: 1, items: 1, status: 1, confirmation: 1 })
    .lean()

  const customerIds = [...new Set(orders.map((order) => String(order.customerId)))]
  const customers = await Customer.find({ _id: { $in: customerIds } })
    .select({ name: 1 })
    .lean()
  const customerName = new Map(
    customers.map((customer) => [String(customer._id), customer.name])
  )

  for (const order of orders) {
    const who = customerName.get(String(order.customerId)) ?? "A customer"

    for (const item of order.items) {
      if (item.itemStatus === "delivered") continue

      const days = daysUntil(item.dueDate, now)
      let type: NotificationType | undefined
      if (days < 0) type = "overdue"
      else if (days === 1) type = "due_tomorrow"
      else if (days === 3) type = "due_in_3_days"
      if (!type) continue

      const message =
        type === "overdue"
          ? `${who}'s ${item.garmentTypeName} on ${order.orderNo} was due ${formatDate(item.dueDate)} — ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} late.`
          : type === "due_tomorrow"
            ? `${who}'s ${item.garmentTypeName} on ${order.orderNo} is due tomorrow.`
            : `${who}'s ${item.garmentTypeName} on ${order.orderNo} is due in 3 days, on ${formatDate(item.dueDate)}.`

      operations.push(
        upsert({
          type,
          orderId: order._id,
          orderItemId: item._id,
          dueAt: item.dueDate,
          message,
          dedupeKey: dedupeKey(type, String(item._id), runDay),
        })
      )
      byType[type]++
    }
  }

  // --- Orders the customer has not answered --------------------------------
  const staleBefore = new Date(
    now.getTime() - AWAITING_CONFIRMATION_HOURS * 60 * 60 * 1000
  )

  const stale = await Order.find({
    isDeleted: false,
    status: "awaiting_confirmation",
    "confirmation.sentAt": { $lte: staleBefore },
  })
    .select({ orderNo: 1, customerId: 1, confirmation: 1 })
    .lean()

  const staleCustomers = await Customer.find({
    _id: { $in: stale.map((order) => order.customerId) },
  })
    .select({ name: 1 })
    .lean()
  const staleName = new Map(
    staleCustomers.map((customer) => [String(customer._id), customer.name])
  )

  for (const order of stale) {
    const who = staleName.get(String(order.customerId)) ?? "A customer"
    const sentAt = order.confirmation.sentAt ?? now
    const hours = Math.floor((now.getTime() - sentAt.getTime()) / 3_600_000)

    operations.push(
      upsert({
        type: "awaiting_confirmation",
        orderId: order._id,
        dueAt: sentAt,
        message: `${order.orderNo} has been waiting on ${who} for ${hours} hours. Worth a call.`,
        dedupeKey: dedupeKey("awaiting_confirmation", String(order._id), runDay),
      })
    )
    byType.awaiting_confirmation++
  }

  if (operations.length === 0) {
    return { created: 0, alreadyPresent: 0, byType }
  }

  const result = await Notification.bulkWrite(operations, { ordered: false })
  return {
    created: result.upsertedCount ?? 0,
    alreadyPresent: operations.length - (result.upsertedCount ?? 0),
    byType,
  }
}

function upsert(fields: {
  type: NotificationType
  orderId: unknown
  orderItemId?: unknown
  dueAt: Date
  message: string
  dedupeKey: string
}): AnyBulkWriteOperation<NotificationDocument> {
  return {
    updateOne: {
      filter: { dedupeKey: fields.dedupeKey },
      // $setOnInsert only: re-running must never mark a read notification unread
      // or rewrite one the shop has already acted on.
      update: { $setOnInsert: { ...fields, isRead: false } },
      upsert: true,
    },
  } as AnyBulkWriteOperation<NotificationDocument>
}

function addDays(date: Date, days: number): Date {
  const next = new Date(startOfDayIST(date))
  next.setUTCDate(next.getUTCDate() + days)
  return next
}
