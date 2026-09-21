"use server"

import { revalidatePath } from "next/cache"
import { isValidObjectId } from "mongoose"

import { AuthorizationError, requireRole } from "@/lib/auth"
import { connectToDatabase } from "@/lib/db"
import { getMessagingProvider } from "@/lib/messaging"
import {
  toMessagingCustomer,
  toMessagingOrder,
} from "@/lib/messaging/order-context"
import { confirmOrderById } from "@/lib/orders/confirm"
import { createPublicToken } from "@/lib/orders/token"
import { TransitionError, transitionOrder } from "@/lib/orders/transition"
import { Customer } from "@/models/customer"
import { Order } from "@/models/order"

export interface SendConfirmationState {
  error?: string
  /**
   * Set when the send needs a person to finish it. The page shows a button; it
   * has no idea which provider produced the link, or whether one was needed.
   */
  openUrl?: string
  sent?: boolean
}

/**
 * Puts a draft in front of the customer: issues the public token, moves the
 * order to awaiting_confirmation, and asks the messaging provider to deliver it.
 */
export async function sendForConfirmation(
  _previous: SendConfirmationState,
  formData: FormData
): Promise<SendConfirmationState> {
  try {
    const session = await requireRole("owner", "staff")

    const orderId = String(formData.get("orderId") ?? "")
    if (!isValidObjectId(orderId)) return { error: "That order was not found." }

    await connectToDatabase()
    const existing = await Order.findOne({ _id: orderId, isDeleted: false }).lean()
    if (!existing) return { error: "That order was not found." }

    const customer = await Customer.findById(existing.customerId).lean()
    if (!customer) return { error: "That customer was not found." }

    const provider = getMessagingProvider()

    // Keep a token the order already has, so re-sending does not break a link
    // the customer is already looking at.
    const publicToken = existing.confirmation.publicToken ?? createPublicToken()

    if (existing.status === "draft") {
      await transitionOrder(orderId, "awaiting_confirmation", {
        userId: session.user.id,
        note: "Sent to the customer",
        set: {
          confirmation: {
            ...existing.confirmation,
            sentAt: new Date(),
            channel: provider.channel,
            publicToken,
          },
        },
      })
    } else {
      await Order.updateOne(
        { _id: orderId },
        {
          $set: {
            "confirmation.sentAt": new Date(),
            "confirmation.channel": provider.channel,
            "confirmation.publicToken": publicToken,
          },
        }
      )
    }

    const fresh = await Order.findById(orderId).lean()
    if (!fresh) return { error: "That order was not found." }

    const result = await provider.sendOrderConfirmation(
      toMessagingOrder(fresh),
      toMessagingCustomer(customer)
    )

    revalidatePath(`/orders/${orderId}`)
    revalidatePath("/orders")

    switch (result.status) {
      case "manual":
        return { openUrl: result.openUrl }
      case "sent":
        return { sent: true }
      case "failed":
        return { error: result.error }
    }
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof TransitionError) {
      return { error: error.message }
    }
    console.error(error)
    return { error: "Could not send that. Try again." }
  }
}

/**
 * For the customer who replies "yes" in chat instead of tapping the button.
 * Goes through the same confirmation function the public page uses.
 */
export async function markConfirmedByStaff(formData: FormData): Promise<void> {
  try {
    const session = await requireRole("owner", "staff")

    const orderId = String(formData.get("orderId") ?? "")
    if (!isValidObjectId(orderId)) return

    await confirmOrderById(orderId, {
      confirmedBy: session.user.name ?? session.user.email ?? "staff",
      userId: session.user.id,
      rawResponse: "marked-by-staff",
    })

    revalidatePath(`/orders/${orderId}`)
    revalidatePath("/orders")
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof TransitionError) {
      console.warn(error.message)
      return
    }
    throw error
  }
}


/**
 * The second message: the final bill, sent once the customer has confirmed.
 *
 * Deliberately a separate step from sendForConfirmation. The first message asks
 * them to check the garments, the cloth and the price; this one goes out only
 * after they have agreed, so a customer never receives an invoice for something
 * they have not yet accepted.
 */
export async function sendBillToCustomer(
  _previous: SendConfirmationState,
  formData: FormData
): Promise<SendConfirmationState> {
  try {
    await requireRole("owner", "staff")

    const orderId = String(formData.get("orderId") ?? "")
    if (!isValidObjectId(orderId)) return { error: "That order was not found." }

    await connectToDatabase()
    const order = await Order.findOne({ _id: orderId, isDeleted: false }).lean()
    if (!order) return { error: "That order was not found." }

    if (!order.confirmation.confirmedAt) {
      return {
        error:
          "The customer has not confirmed yet. Send it for confirmation first.",
      }
    }

    const customer = await Customer.findById(order.customerId).lean()
    if (!customer) return { error: "That customer was not found." }

    const provider = getMessagingProvider()
    const result = await provider.sendBill(
      toMessagingOrder(order),
      toMessagingCustomer(customer),
      // The manual provider cannot attach a file; the Cloud API one will.
      undefined
    )

    await Order.updateOne(
      { _id: orderId },
      { $set: { "confirmation.billSentAt": new Date() } }
    )
    revalidatePath(`/orders/${orderId}`)

    switch (result.status) {
      case "manual":
        return { openUrl: result.openUrl }
      case "sent":
        return { sent: true }
      case "failed":
        return { error: result.error }
    }
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof TransitionError) {
      return { error: error.message }
    }
    console.error(error)
    return { error: "Could not send that. Try again." }
  }
}
