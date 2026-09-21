"use server"

import { revalidatePath } from "next/cache"
import { isValidObjectId } from "mongoose"
import { z } from "zod"

import { AuthorizationError, requireRole } from "@/lib/auth"
import { connectToDatabase } from "@/lib/db"
import { calculateTotals } from "@/lib/orders/totals"
import { Order } from "@/models/order"
import { Assignee } from "@/models/assignee"
import {
  TransitionError,
  transitionOrder,
  transitionOrderItem,
} from "@/lib/orders/transition"
import { orderItemStatusSchema, orderStatusSchema } from "@/schemas/order"

/**
 * Every status button on the order page lands here, and every one of these calls
 * lib/orders/transition.ts. Nothing in this file assigns a status itself.
 */

const orderMoveSchema = z.object({
  orderId: z.string().trim().regex(/^[0-9a-f]{24}$/i),
  to: orderStatusSchema,
})

const itemMoveSchema = z.object({
  orderId: z.string().trim().regex(/^[0-9a-f]{24}$/i),
  itemId: z.string().trim().regex(/^[0-9a-f]{24}$/i),
  to: orderItemStatusSchema,
})

export async function moveOrder(formData: FormData): Promise<void> {
  try {
    const session = await requireRole("owner", "staff")
    const parsed = orderMoveSchema.safeParse({
      orderId: formData.get("orderId"),
      to: formData.get("to"),
    })
    if (!parsed.success) return

    await transitionOrder(parsed.data.orderId, parsed.data.to, {
      userId: session.user.id,
    })
    revalidatePath(`/orders/${parsed.data.orderId}`)
    revalidatePath("/orders")
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof TransitionError) {
      // Surfaced by the page re-render; the buttons only ever offer legal moves.
      console.warn(error.message)
      return
    }
    throw error
  }
}

export async function moveOrderItem(formData: FormData): Promise<void> {
  try {
    // The `tailor` login role, not an assignee: someone who signs in to move
    // garments along the workbench. Assignees never sign in.
    const session = await requireRole("owner", "staff", "tailor")
    const parsed = itemMoveSchema.safeParse({
      orderId: formData.get("orderId"),
      itemId: formData.get("itemId"),
      to: formData.get("to"),
    })
    if (!parsed.success) return

    await transitionOrderItem(
      parsed.data.orderId,
      parsed.data.itemId,
      parsed.data.to,
      { userId: session.user.id }
    )
    revalidatePath(`/orders/${parsed.data.orderId}`)
    revalidatePath("/orders")
    revalidatePath("/calendar")
  } catch (error) {
    if (error instanceof AuthorizationError || error instanceof TransitionError) {
      console.warn(error.message)
      return
    }
    throw error
  }
}

const assignSchema = z.object({
  orderId: z.string().trim().regex(/^[0-9a-f]{24}$/i),
  itemId: z.string().trim().regex(/^[0-9a-f]{24}$/i),
  /** Empty means unassign. */
  assigneeId: z.union([
    z.string().trim().regex(/^[0-9a-f]{24}$/i),
    z.literal(""),
  ]),
})

/**
 * Puts a garment on a particular assignee's bench, or takes it off. Not a status
 * change, so it does not go through transition.ts — it moves who, not where.
 */
export async function assignAssignee(formData: FormData): Promise<void> {
  try {
    await requireRole("owner", "staff")

    const parsed = assignSchema.safeParse({
      orderId: formData.get("orderId"),
      itemId: formData.get("itemId"),
      assigneeId: formData.get("assigneeId") ?? "",
    })
    if (!parsed.success) return

    await connectToDatabase()

    if (parsed.data.assigneeId === "") {
      await Order.updateOne(
        { _id: parsed.data.orderId, isDeleted: false, "items._id": parsed.data.itemId },
        { $unset: { "items.$.assignedTo": "" } }
      )
    } else {
      // Only a real, active assignee can be given work.
      const assignee = await Assignee.findOne({
        _id: parsed.data.assigneeId,
        isActive: true,
        isDeleted: false,
      })
        .select({ _id: 1 })
        .lean()
      if (!assignee) return

      await Order.updateOne(
        { _id: parsed.data.orderId, isDeleted: false, "items._id": parsed.data.itemId },
        { $set: { "items.$.assignedTo": assignee._id } }
      )
    }

    revalidatePath(`/orders/${parsed.data.orderId}`)
    revalidatePath("/calendar")
  } catch (error) {
    if (error instanceof AuthorizationError) {
      console.warn(error.message)
      return
    }
    throw error
  }
}


/**
 * Settles the bill in one tap: advance becomes the whole total, balance zero.
 *
 * Recomputed through calculateTotals rather than assigned, so the stored figures
 * stay consistent with every other place money is worked out (rule 1).
 */
export async function markFullyPaid(formData: FormData): Promise<void> {
  try {
    await requireRole("owner", "staff")

    const id = String(formData.get("orderId") ?? "")
    if (!isValidObjectId(id)) return

    await connectToDatabase()
    const order = await Order.findOne({ _id: id, isDeleted: false })
      .select({ items: 1, discount: 1, total: 1 })
      .lean()
    if (!order) return

    const totals = calculateTotals(order.items, order.discount, order.total)

    await Order.updateOne({ _id: id, isDeleted: false }, { $set: totals })

    revalidatePath(`/orders/${id}`)
    revalidatePath("/orders")
    revalidatePath("/dashboard")
  } catch (error) {
    if (error instanceof AuthorizationError) {
      console.warn(error.message)
      return
    }
    throw error
  }
}
