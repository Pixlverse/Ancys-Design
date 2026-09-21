import type { ReactNode } from "react"

import {
  CUSTOMER_STATUS_TONES,
  ORDER_ITEM_STATUS_LABELS,
  ORDER_ITEM_STATUS_TONES,
  ORDER_STATUS_LABELS,
  ORDER_STATUS_SHORT_LABELS,
  ORDER_STATUS_TONES,
} from "@/lib/orders/labels"
import type { OrderItemStatus, OrderStatus } from "@/schemas/order"

/**
 * One pill, used everywhere a status appears.
 *
 * shadcn's Badge paints every variant the same, so a table of statuses came out
 * as a column of identical navy lozenges — the colour said nothing. Each status
 * now owns a tone, and because every screen renders through here, the same
 * status is the same colour wherever you meet it.
 */
export function StatusPill({
  tone,
  children,
  className = "",
}: {
  tone: string
  children: ReactNode
  className?: string
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ring-1 ${tone} ${className}`}
    >
      {children}
    </span>
  )
}

export function OrderStatusPill({
  status,
  short = false,
  className,
}: {
  status: OrderStatus
  /** Use in fixed-width columns, where the long labels would truncate. */
  short?: boolean
  className?: string
}) {
  return (
    <StatusPill tone={ORDER_STATUS_TONES[status]} className={className}>
      {short ? ORDER_STATUS_SHORT_LABELS[status] : ORDER_STATUS_LABELS[status]}
    </StatusPill>
  )
}

export function ItemStatusPill({
  status,
  className,
}: {
  status: OrderItemStatus
  className?: string
}) {
  return (
    <StatusPill tone={ORDER_ITEM_STATUS_TONES[status]} className={className}>
      {ORDER_ITEM_STATUS_LABELS[status]}
    </StatusPill>
  )
}

export function CustomerStatusPill({
  status,
  className,
}: {
  status: string
  className?: string
}) {
  const known = status === "active" ? "active" : "lead"
  return (
    <StatusPill tone={CUSTOMER_STATUS_TONES[known]} className={className}>
      {known === "active" ? "Active" : "Lead"}
    </StatusPill>
  )
}
