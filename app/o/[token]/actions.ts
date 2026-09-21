"use server"

import { revalidatePath } from "next/cache"

import {
  confirmOrderByToken,
  respondToOrderByToken,
  type OrderResponse,
} from "@/lib/orders/confirm"
import { isPublicToken } from "@/lib/orders/token"
import { connectToDatabase } from "@/lib/db"
import { Order } from "@/models/order"
import { User } from "@/models/user"

export interface ConfirmState {
  confirmed?: boolean
  /** Set once the customer has asked for a change or declined. */
  responded?: OrderResponse
  error?: string
}

/**
 * The customer's own words, treated as hostile: React escapes it on the way
 * out, and the cap stops a paste of a novel reaching the database.
 */
const NOTE_MAX = 500

/**
 * Status changes are attributed to a user; a customer is not one, so the change
 * is recorded against whoever created the order, falling back to the owner.
 */
async function attributionFor(token: string): Promise<string | undefined> {
  const order = await Order.findOne({
    "confirmation.publicToken": token,
    isDeleted: false,
  })
    .select({ createdBy: 1 })
    .lean()

  if (!order) return undefined

  const owner = await User.findOne({ role: "owner" }).select({ _id: 1 }).lean()
  return String(order.createdBy ?? owner?._id ?? "") || undefined
}

/**
 * The customer confirming their own order. No session — the token is the
 * credential — so everything here treats its input as hostile.
 */
export async function confirmFromPublicPage(
  _previous: ConfirmState,
  formData: FormData
): Promise<ConfirmState> {
  const token = String(formData.get("token") ?? "")
  if (!isPublicToken(token)) {
    return { error: "That link is no longer valid." }
  }

  await connectToDatabase()

  const attributedTo = await attributionFor(token)
  if (!attributedTo) return { error: "That link is no longer valid." }

  const result = await confirmOrderByToken(token, {
    confirmedBy: "customer",
    userId: attributedTo,
    rawResponse: "public-order-page",
  })

  if (!result.ok) {
    return {
      error:
        result.reason === "wrong-status"
          ? "This order can no longer be confirmed here. Please call the shop."
          : "That link is no longer valid.",
    }
  }

  revalidatePath(`/o/${token}`)
  revalidatePath(`/orders/${result.orderId}`)
  return { confirmed: true }
}

/**
 * "I'd like a change" and "No thank you". One action for both, because they
 * differ only in which status the order lands on.
 */
export async function respondFromPublicPage(
  _previous: ConfirmState,
  formData: FormData
): Promise<ConfirmState> {
  const token = String(formData.get("token") ?? "")
  if (!isPublicToken(token)) {
    return { error: "That link is no longer valid." }
  }

  const raw = String(formData.get("response") ?? "")
  if (raw !== "changes_requested" && raw !== "declined") {
    return { error: "Could not record that. Call the shop." }
  }
  const response: OrderResponse = raw

  const note = String(formData.get("note") ?? "")
    .trim()
    .slice(0, NOTE_MAX)

  await connectToDatabase()

  const attributedTo = await attributionFor(token)
  if (!attributedTo) return { error: "That link is no longer valid." }

  const result = await respondToOrderByToken(token, {
    response,
    note: note || undefined,
    userId: attributedTo,
    rawResponse: "public-order-page",
  })

  if (!result.ok) {
    return {
      error:
        result.reason === "wrong-status"
          ? "This order can no longer be changed here. Please call the shop."
          : "That link is no longer valid.",
    }
  }

  // Declining clears the public token, so revalidating this path would render
  // the customer a 404 the instant they answered. The panel already shows the
  // outcome from the returned state; the dead link is only felt on a refresh,
  // which is the intent.
  if (response !== "declined") revalidatePath(`/o/${token}`)
  revalidatePath(`/orders/${result.orderId}`)
  revalidatePath("/orders")
  return { responded: response }
}
