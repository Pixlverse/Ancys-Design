"use server"

import { revalidatePath } from "next/cache"

import { confirmOrderByToken } from "@/lib/orders/confirm"
import { isPublicToken } from "@/lib/orders/token"
import { connectToDatabase } from "@/lib/db"
import { Order } from "@/models/order"
import { User } from "@/models/user"

export interface ConfirmState {
  confirmed?: boolean
  error?: string
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

  // Status changes are attributed to a user; a customer is not one, so the
  // change is recorded against the account that created the order.
  const order = await Order.findOne({
    "confirmation.publicToken": token,
    isDeleted: false,
  })
    .select({ createdBy: 1 })
    .lean()

  if (!order) return { error: "That link is no longer valid." }

  const owner = await User.findOne({ role: "owner" }).select({ _id: 1 }).lean()
  const attributedTo = String(order.createdBy ?? owner?._id ?? "")
  if (!attributedTo) return { error: "Could not record that. Call the shop." }

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
