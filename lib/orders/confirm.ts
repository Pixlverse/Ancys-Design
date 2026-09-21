import { connectToDatabase } from "@/lib/db"
import { toDateInputIST } from "@/lib/dates"
import { transitionOrder } from "@/lib/orders/transition"
import { isPublicToken } from "@/lib/orders/token"
import { Customer } from "@/models/customer"
import { Notification } from "@/models/notification"
import { Order } from "@/models/order"
import type { OrderStatus } from "@/schemas/order"

/**
 * Recording a customer's confirmation, in one place.
 *
 * The public order page calls this when they tap Confirm, and phase 5's WhatsApp
 * webhook will call this same function when they tap the button in chat — not a
 * second copy of it. The status move goes through lib/orders/transition.ts like
 * every other (rule 8).
 */

export type ConfirmOutcome =
  | { ok: true; orderId: string; alreadyConfirmed: boolean }
  | { ok: false; reason: "not-found" | "wrong-status" }

export interface ConfirmContext {
  /** Who confirmed: the customer themselves, or a staff member acting for them. */
  confirmedBy: string
  /** The provider's raw payload, kept for auditing a disputed confirmation. */
  rawResponse?: string
  /** The user id to attribute the status change to. */
  userId: string
}

export async function confirmOrderByToken(
  token: string,
  context: ConfirmContext
): Promise<ConfirmOutcome> {
  if (!isPublicToken(token)) return { ok: false, reason: "not-found" }

  await connectToDatabase()
  const order = await Order.findOne({
    "confirmation.publicToken": token,
    isDeleted: false,
  })
    .select({ _id: 1, status: 1 })
    .lean()

  if (!order) return { ok: false, reason: "not-found" }
  return confirmOrderById(String(order._id), context)
}

export async function confirmOrderById(
  orderId: string,
  context: ConfirmContext
): Promise<ConfirmOutcome> {
  await connectToDatabase()

  const order = await Order.findOne({ _id: orderId, isDeleted: false })
    .select({ status: 1, customerId: 1, confirmation: 1 })
    .lean()

  if (!order) return { ok: false, reason: "not-found" }

  // Meta retries webhooks, and a customer can tap Confirm twice. Saying yes
  // again must be a no-op, not an error.
  if (order.status === "confirmed") {
    return { ok: true, orderId, alreadyConfirmed: true }
  }

  // Also reachable from changes_requested: a customer who asked for a change
  // may look again and decide it was fine after all.
  if (
    order.status !== "awaiting_confirmation" &&
    order.status !== "draft" &&
    order.status !== "changes_requested"
  ) {
    return { ok: false, reason: "wrong-status" }
  }

  await transitionOrder(orderId, "confirmed", {
    userId: context.userId,
    note: `Confirmed by ${context.confirmedBy}`,
    set: {
      confirmation: {
        // Spread what is already there: replacing the object wholesale would
        // throw away sentAt and the public token.
        ...order.confirmation,
        confirmedAt: new Date(),
        confirmedBy: context.confirmedBy,
        rawResponse: context.rawResponse,
      },
    },
  })

  // A confirmed order is what turns an enquiry into a customer.
  await Customer.updateOne(
    { _id: order.customerId, status: "lead" },
    { $set: { status: "active" } }
  )

  // Nothing else tells the shop to send the bill: on the manual provider the
  // customer answers on a web page, which reaches no one's phone.
  if (context.confirmedBy === "customer") {
    await notifyCustomerResponse(orderId, "confirmed", "confirmed their order")
  }

  return { ok: true, orderId, alreadyConfirmed: false }
}

/** What the customer chose on the public order page. */
export type OrderResponse = "changes_requested" | "declined"

export type RespondOutcome =
  | { ok: true; orderId: string; status: OrderStatus }
  | { ok: false; reason: "not-found" | "wrong-status" }

export interface RespondContext {
  response: OrderResponse
  /** The customer's own words. Already trimmed and capped by the caller. */
  note?: string
  /** The user id the status change is attributed to; a customer is not one. */
  userId: string
  rawResponse?: string
}

/**
 * The other two answers: "change something" and "no thank you". Declining
 * cancels the order — it is never deleted, and transitionOrder drops the public
 * token on the way through (CLAUDE.md rule 4).
 *
 * Shares confirmOrderByToken's shape: the WhatsApp webhook will call this same
 * function when a customer taps the button in chat.
 */
export async function respondToOrderByToken(
  token: string,
  context: RespondContext
): Promise<RespondOutcome> {
  if (!isPublicToken(token)) return { ok: false, reason: "not-found" }

  await connectToDatabase()
  const order = await Order.findOne({
    "confirmation.publicToken": token,
    isDeleted: false,
  })
    .select({ _id: 1, status: 1, confirmation: 1 })
    .lean()

  if (!order) return { ok: false, reason: "not-found" }

  const target: OrderStatus =
    context.response === "declined" ? "cancelled" : "changes_requested"

  // A customer may only answer while the order is still theirs to answer.
  const answerable: readonly OrderStatus[] = [
    "awaiting_confirmation",
    "draft",
    "changes_requested",
  ]
  if (!answerable.includes(order.status)) {
    return { ok: false, reason: "wrong-status" }
  }

  const orderId = String(order._id)
  const confirmation = {
    ...order.confirmation,
    respondedAt: new Date(),
    customerNote: context.note,
    rawResponse: context.rawResponse,
  }

  if (order.status === target) {
    // Asking for a second change is not a status move, but the new words
    // matter: transitionOrder no-ops on an unchanged status and would drop them.
    await Order.updateOne({ _id: orderId }, { $set: { confirmation } })
  } else {
    await transitionOrder(orderId, target, {
      userId: context.userId,
      note:
        context.response === "declined"
          ? "Declined by the customer"
          : "Changes requested by the customer",
      set: { confirmation },
    })
  }

  await notifyCustomerResponse(
    orderId,
    target,
    context.response === "declined"
      ? "declined their order"
      : "asked for a change"
  )

  return { ok: true, orderId, status: target }
}

/**
 * One in-app notification per order per outcome per day. The dedupe key stops a
 * customer tapping a button repeatedly from filling the shop's bell, and is
 * what makes a retried webhook harmless later.
 */
async function notifyCustomerResponse(
  orderId: string,
  outcome: OrderStatus,
  what: string
): Promise<void> {
  const now = new Date()
  const order = await Order.findById(orderId).select({ orderNo: 1 }).lean()
  if (!order) return

  await Notification.updateOne(
    { dedupeKey: `customer_responded:${orderId}:${outcome}:${toDateInputIST(now)}` },
    {
      $setOnInsert: {
        type: "customer_responded",
        orderId: order._id,
        dueAt: now,
        message: `The customer ${what} on ${order.orderNo}.`,
        isRead: false,
        dedupeKey: `customer_responded:${orderId}:${outcome}:${toDateInputIST(now)}`,
      },
    },
    { upsert: true }
  )
}
