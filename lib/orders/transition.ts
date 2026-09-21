import { Types } from "mongoose"

import { connectToDatabase } from "@/lib/db"
import { Order, type OrderDocument, type OrderItem } from "@/models/order"
import type { OrderItemStatus, OrderStatus } from "@/schemas/order"

/**
 * The only place an order or an item changes status (CLAUDE.md rule 8).
 *
 * Everything else — buttons, the public confirmation page, the WhatsApp webhook
 * in phase 5 — calls in here. Nothing assigns `order.status` directly, so the
 * legal moves live in one table and the audit trail cannot be skipped.
 */

/** Which order statuses may follow which. Empty means the order is finished. */
export const ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  draft: ["awaiting_confirmation", "confirmed", "cancelled"],
  // Back to draft so staff can fix an order the customer queried.
  awaiting_confirmation: ["confirmed", "draft", "cancelled"],
  confirmed: ["in_progress", "ready", "cancelled"],
  in_progress: ["ready", "cancelled"],
  ready: ["delivered", "in_progress"],
  delivered: [],
  cancelled: [],
}

/**
 * Item statuses move along the workbench, and one step back — staff mark the
 * wrong garment often enough that undo matters more than strictness here.
 */
export const ITEM_TRANSITIONS: Record<
  OrderItemStatus,
  readonly OrderItemStatus[]
> = {
  pending: ["cutting"],
  cutting: ["stitching", "pending"],
  stitching: ["finishing", "cutting"],
  finishing: ["ready", "stitching"],
  ready: ["delivered", "finishing"],
  delivered: ["ready"],
}

export function canTransitionOrder(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_TRANSITIONS[from].includes(to)
}

export function canTransitionItem(
  from: OrderItemStatus,
  to: OrderItemStatus
): boolean {
  return ITEM_TRANSITIONS[from].includes(to)
}

/** Work statuses, in the order a garment passes through them. */
const ITEM_PROGRESS: readonly OrderItemStatus[] = [
  "pending",
  "cutting",
  "stitching",
  "finishing",
  "ready",
  "delivered",
]

/**
 * Where the order as a whole has got to, read off its items.
 *
 * Only meaningful once the customer has confirmed: a draft is a draft however
 * far along its garments are, and a cancelled order stays cancelled.
 */
export function deriveOrderStatus(
  items: readonly Pick<OrderItem, "itemStatus">[],
  current: OrderStatus
): OrderStatus {
  const derivable: readonly OrderStatus[] = ["confirmed", "in_progress", "ready"]
  if (!derivable.includes(current) || items.length === 0) return current

  const statuses = items.map((item) => item.itemStatus)

  if (statuses.every((status) => status === "delivered")) return "delivered"
  if (statuses.every((status) => status === "ready" || status === "delivered")) {
    return "ready"
  }
  // Anything past pending means work has started.
  if (statuses.some((status) => ITEM_PROGRESS.indexOf(status) > 0)) {
    return "in_progress"
  }
  return current
}

export class TransitionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "TransitionError"
  }
}

export interface TransitionResult {
  status: OrderStatus
  /** True when the order's own status moved, as opposed to only an item's. */
  orderStatusChanged: boolean
}

export interface TransitionContext {
  /** The signed-in user making the change. */
  userId: string
  note?: string
  /** Fields to set alongside the status, e.g. confirmation details in phase 3. */
  set?: Partial<
    Pick<OrderDocument, "confirmation" | "promisedDate" | "isDeleted">
  >
}

/** Moves the whole order. Rejects a move the table does not allow. */
export async function transitionOrder(
  orderId: string,
  to: OrderStatus,
  context: TransitionContext
): Promise<TransitionResult> {
  await connectToDatabase()

  const order = await Order.findOne({ _id: orderId, isDeleted: false })
  if (!order) throw new TransitionError("That order no longer exists.")

  const from = order.status
  if (from === to) {
    return { status: from, orderStatusChanged: false }
  }

  if (!canTransitionOrder(from, to)) {
    throw new TransitionError(
      `An order that is ${humanise(from)} cannot become ${humanise(to)}.`
    )
  }

  order.status = to

  // A delivered or cancelled order's public link stops working: the token is the
  // only protection on that page, and there is nothing left for the customer to
  // confirm (CLAUDE.md section 7).
  if (to === "delivered" || to === "cancelled") {
    order.confirmation.publicToken = undefined
  }

  order.statusHistory.push({
    from,
    to,
    at: new Date(),
    by: new Types.ObjectId(context.userId),
    note: context.note,
  })

  if (context.set) Object.assign(order, context.set)

  await order.save()
  return { status: to, orderStatusChanged: true }
}

/**
 * Moves one garment, then re-derives the order's own status from all of them —
 * marking the last garment ready is what makes the order ready.
 */
export async function transitionOrderItem(
  orderId: string,
  itemId: string,
  to: OrderItemStatus,
  context: TransitionContext
): Promise<TransitionResult> {
  await connectToDatabase()

  const order = await Order.findOne({ _id: orderId, isDeleted: false })
  if (!order) throw new TransitionError("That order no longer exists.")

  const item = order.items.find((row) => String(row._id) === itemId)
  if (!item) throw new TransitionError("That garment is not on this order.")

  const from = item.itemStatus
  if (from === to) {
    return { status: order.status, orderStatusChanged: false }
  }

  if (!canTransitionItem(from, to)) {
    throw new TransitionError(
      `A garment that is ${humanise(from)} cannot become ${humanise(to)}.`
    )
  }

  item.itemStatus = to
  order.statusHistory.push({
    from,
    to,
    at: new Date(),
    by: new Types.ObjectId(context.userId),
    itemId: item._id,
    note: context.note,
  })

  const previousStatus = order.status
  const derived = deriveOrderStatus(order.items, previousStatus)

  if (derived !== previousStatus) {
    order.status = derived
    if (derived === "delivered") {
      order.confirmation.publicToken = undefined
    }
    order.statusHistory.push({
      from: previousStatus,
      to: derived,
      at: new Date(),
      by: new Types.ObjectId(context.userId),
      note: "Derived from the garments",
    })
  }

  await order.save()
  return {
    status: order.status,
    orderStatusChanged: derived !== previousStatus,
  }
}

function humanise(status: string): string {
  return status.replace(/_/g, " ")
}
