import { connectToDatabase } from "@/lib/db"
import { transitionOrder } from "@/lib/orders/transition"
import { isPublicToken } from "@/lib/orders/token"
import { Customer } from "@/models/customer"
import { Order } from "@/models/order"

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

  if (order.status !== "awaiting_confirmation" && order.status !== "draft") {
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

  return { ok: true, orderId, alreadyConfirmed: false }
}
