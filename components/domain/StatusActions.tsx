import { Check } from "lucide-react"

import { moveOrder, moveOrderItem } from "@/app/(portal)/orders/[id]/actions"
import { Button } from "@/components/ui/button"
import {
  ITEM_STAGE_ORDER,
  ORDER_ITEM_STATUS_LABELS,
  ORDER_ITEM_STATUS_TONES,
  ORDER_STAGE_ORDER,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_TONES,
} from "@/lib/orders/labels"
import { ITEM_TRANSITIONS, ORDER_TRANSITIONS } from "@/lib/orders/transition"
import type { OrderItemStatus, OrderStatus } from "@/schemas/order"

/**
 * The whole journey is shown, not just the next step: staff can see where a
 * garment is and how far is left. Stages already passed are ticked, the current
 * one is filled, legal moves are buttons, and anything the transition table
 * forbids is simply not pressable.
 */
export function ItemStageTracker({
  orderId,
  itemId,
  status,
}: {
  orderId: string
  itemId: string
  status: OrderItemStatus
}) {
  const current = ITEM_STAGE_ORDER.indexOf(status)
  const legal = ITEM_TRANSITIONS[status]

  return (
    <ol className="flex flex-wrap items-center gap-1.5">
      {ITEM_STAGE_ORDER.map((stage, index) => {
        const isCurrent = stage === status
        const isPast = index < current
        const canMove = legal.includes(stage)

        const pill = (
          <span
            className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition-all ${
              isCurrent
                ? `${ORDER_ITEM_STATUS_TONES[stage]} scale-105 shadow-sm`
                : isPast
                  ? "bg-muted text-muted-foreground/80 ring-transparent"
                  : canMove
                    ? "bg-card text-foreground ring-border hover:bg-accent"
                    : "bg-transparent text-muted-foreground/40 ring-transparent"
            }`}
          >
            {isPast ? <Check className="size-3" aria-hidden /> : null}
            {ORDER_ITEM_STATUS_LABELS[stage]}
          </span>
        )

        return (
          <li key={stage}>
            {canMove ? (
              <form action={moveOrderItem}>
                <input type="hidden" name="orderId" value={orderId} />
                <input type="hidden" name="itemId" value={itemId} />
                <input type="hidden" name="to" value={stage} />
                <button
                  type="submit"
                  className="cursor-pointer"
                  aria-label={`Move to ${ORDER_ITEM_STATUS_LABELS[stage]}`}
                >
                  {pill}
                </button>
              </form>
            ) : (
              <span aria-current={isCurrent ? "step" : undefined}>{pill}</span>
            )}
          </li>
        )
      })}
    </ol>
  )
}

/** The same idea for the order itself, plus its remaining actions. */
export function OrderStageTracker({ status }: { status: OrderStatus }) {
  const current = ORDER_STAGE_ORDER.indexOf(status)

  // Neither of these is a step along the line, so the tracker shows the state
  // on its own rather than pretending the order is back at the start.
  if (status === "cancelled" || status === "changes_requested") {
    return (
      <span
        className={`inline-flex rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${ORDER_STATUS_TONES[status]}`}
      >
        {ORDER_STATUS_LABELS[status]}
      </span>
    )
  }

  return (
    <ol className="flex flex-wrap items-center gap-1.5">
      {ORDER_STAGE_ORDER.map((stage, index) => {
        const isCurrent = stage === status
        const isPast = index < current
        return (
          <li key={stage}>
            <span
              aria-current={isCurrent ? "step" : undefined}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ring-1 ${
                isCurrent
                  ? `${ORDER_STATUS_TONES[stage]} shadow-sm`
                  : isPast
                    ? "bg-muted text-muted-foreground/80 ring-transparent"
                    : "bg-transparent text-muted-foreground/40 ring-transparent"
              }`}
            >
              {isPast ? <Check className="size-3" aria-hidden /> : null}
              {ORDER_STATUS_LABELS[stage]}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

const DESTRUCTIVE: readonly string[] = ["cancelled"]

export function OrderStatusActions({
  orderId,
  status,
}: {
  orderId: string
  status: OrderStatus
}) {
  const moves = ORDER_TRANSITIONS[status]
  if (moves.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        This order is {ORDER_STATUS_LABELS[status].toLowerCase()}. Nothing
        further to do.
      </p>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {moves.map((to) => (
        <form key={to} action={moveOrder}>
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="to" value={to} />
          <Button
            type="submit"
            variant={DESTRUCTIVE.includes(to) ? "outline" : "default"}
            className={
              DESTRUCTIVE.includes(to) ? "h-11 text-destructive" : "h-11 brand-fill"
            }
          >
            {actionLabel(status, to)}
          </Button>
        </form>
      ))}
    </div>
  )
}

/** Reads as an instruction rather than a state name. */
function actionLabel(from: OrderStatus, to: OrderStatus): string {
  if (to === "cancelled") return "Cancel order"
  if (to === "draft") return "Back to draft"
  if (to === "awaiting_confirmation") return "Send for confirmation"
  if (to === "confirmed" && from === "draft") return "Mark as confirmed"
  if (to === "delivered") return "Mark as delivered"
  return `Mark as ${ORDER_STATUS_LABELS[to].toLowerCase()}`
}
