import type { QueryFilter, Types } from "mongoose"

import { buildCustomerSearch, escapeRegExp } from "@/lib/customers"
import { endOfDayIST, parseDateInputIST } from "@/lib/dates"
import { formatPhone } from "@/lib/phone"
import { Customer } from "@/models/customer"
import { Order } from "@/models/order"
import type { PurchaseDocument } from "@/models/purchase"

export interface PurchaseListParams {
  q?: string
  /** yyyy-MM-dd, IST days, inclusive. */
  from?: string
  to?: string
}

/**
 * The filter behind the purchases list. Free text matches what was bought, the
 * vendor, who paid, the order number, or the tagged customer's phone or name.
 * Needs the database: the customer part is a lookup.
 */
export async function buildPurchaseFilter({
  q = "",
  from,
  to,
}: PurchaseListParams): Promise<QueryFilter<PurchaseDocument>> {
  const filter: QueryFilter<PurchaseDocument> = { isDeleted: false }

  // Bounded on IST days, not raw instants (rule 3).
  const range: Record<string, Date> = {}
  const start = from ? parseDateInputIST(from) : null
  const end = to ? parseDateInputIST(to) : null
  if (start) range.$gte = start
  if (end) range.$lte = endOfDayIST(end)
  if (Object.keys(range).length > 0) filter.purchasedOn = range

  const query = q.trim()
  if (query !== "") {
    const pattern = { $regex: escapeRegExp(query), $options: "i" }
    const customers = await Customer.find(buildCustomerSearch(query).filter)
      .select({ _id: 1 })
      .limit(50)
      .lean()

    filter.$or = [
      { "lines.description": pattern },
      { vendor: pattern },
      { paidBy: pattern },
      { orderNo: pattern },
      ...(customers.length > 0
        ? [{ customerId: { $in: customers.map((customer) => customer._id) } }]
        : []),
    ]
  }

  return filter
}

export interface PurchaseTagLabel {
  kind: "order" | "customer"
  id: string
  label: string
  detail: string
}

/** What a tag reads as on screen: "2026-0142 · Priya" or "Priya · 98400 12345". */
export async function loadPurchaseTag(
  orderId: Types.ObjectId | string | undefined,
  customerId: Types.ObjectId | string | undefined
): Promise<PurchaseTagLabel | null> {
  if (orderId) {
    const order = await Order.findOne({ _id: orderId, isDeleted: false })
      .select({ orderNo: 1, customerId: 1, items: 1 })
      .lean()
    if (order) {
      const customer = await Customer.findById(order.customerId)
        .select({ name: 1 })
        .lean()
      return {
        kind: "order",
        id: String(order._id),
        label: `${order.orderNo} · ${customer?.name ?? "—"}`,
        detail:
          order.items.map((item) => item.garmentTypeName).join(", ") || "Order",
      }
    }
  }

  if (customerId) {
    const customer = await Customer.findOne({ _id: customerId, isDeleted: false })
      .select({ name: 1, phone: 1 })
      .lean()
    if (customer) {
      return {
        kind: "customer",
        id: String(customer._id),
        label: customer.name,
        detail: formatPhone(customer.phone),
      }
    }
  }

  return null
}
