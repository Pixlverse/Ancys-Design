import type { PipelineStage } from "mongoose"

import { monthRangeIST } from "@/lib/calendar"
import { connectToDatabase } from "@/lib/db"
import { Customer } from "@/models/customer"
import { Order } from "@/models/order"
import type { OrderStatus } from "@/schemas/order"

/**
 * The month-end picture: what was taken, what it was worth, and what came in.
 *
 * A caveat worth stating on the report itself: the data model records
 * `advancePaid` as a running figure on the order, not as dated payments. So
 * "collected" means money received against orders *taken this month*, not cash
 * that arrived this month. A payment on an older order lands in that older
 * month. A dated payment log would be needed to report true monthly cash.
 */

export interface GarmentLine {
  garmentTypeName: string
  /** Number of order items. */
  items: number
  /** Total garments, counting quantity. */
  quantity: number
  /** Integer paise. */
  revenue: number
}

export interface MonthlyReport {
  /** The IST month this covers. */
  start: Date
  end: Date
  ordersTaken: number
  garments: number
  /** All integer paise. */
  gross: number
  discounts: number
  netBilled: number
  collected: number
  outstanding: number
  byGarment: GarmentLine[]
  byStatus: { status: OrderStatus; orders: number; value: number }[]
  deliveredInMonth: number
  newCustomers: number
  designOnlyItems: number
}

interface TotalsRow {
  _id: null
  ordersTaken: number
  gross: number
  discounts: number
  netBilled: number
  collected: number
  outstanding: number
}

interface StatusRow {
  _id: OrderStatus
  orders: number
  value: number
}

export async function loadMonthlyReport(
  anchor: Date = new Date()
): Promise<MonthlyReport> {
  await connectToDatabase()
  const { start, end } = monthRangeIST(anchor)

  // Orders taken in the month. Cancelled ones are excluded from the money —
  // a cancelled order is not income — but drafts are included, since the shop
  // has taken the work on.
  const taken: PipelineStage[] = [
    {
      $match: {
        isDeleted: false,
        status: { $ne: "cancelled" },
        createdAt: { $gte: start, $lte: end },
      },
    },
  ]

  const [totalsRows, garmentRows, statusRows, deliveredRows, newCustomers, designRows] =
    await Promise.all([
      Order.aggregate<TotalsRow>([
        ...taken,
        {
          $group: {
            _id: null,
            ordersTaken: { $sum: 1 },
            gross: { $sum: "$subtotal" },
            discounts: { $sum: "$discount" },
            netBilled: { $sum: "$total" },
            collected: { $sum: "$advancePaid" },
            outstanding: { $sum: "$balance" },
          },
        },
      ]),

      Order.aggregate<GarmentLine & { _id: string }>([
        ...taken,
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.garmentTypeName",
            items: { $sum: 1 },
            quantity: { $sum: "$items.quantity" },
            revenue: {
              $sum: { $multiply: ["$items.rate", "$items.quantity"] },
            },
          },
        },
        { $sort: { revenue: -1 } },
      ]),

      Order.aggregate<StatusRow>([
        ...taken,
        { $group: { _id: "$status", orders: { $sum: 1 }, value: { $sum: "$total" } } },
        { $sort: { value: -1 } },
      ]),

      // Genuinely delivered *in* this month, read from the audit trail rather
      // than from the order's current status.
      Order.aggregate<{ _id: null; count: number }>([
        { $match: { isDeleted: false } },
        { $unwind: "$statusHistory" },
        {
          $match: {
            "statusHistory.to": "delivered",
            "statusHistory.itemId": { $exists: false },
            "statusHistory.at": { $gte: start, $lte: end },
          },
        },
        { $group: { _id: null, count: { $sum: 1 } } },
      ]),

      Customer.countDocuments({
        isDeleted: false,
        createdAt: { $gte: start, $lte: end },
      }),

      Order.aggregate<{ _id: null; count: number }>([
        ...taken,
        { $unwind: "$items" },
        { $match: { "items.workType": "design_only" } },
        { $group: { _id: null, count: { $sum: 1 } } },
      ]),
    ])

  const totals = totalsRows[0]
  const byGarment: GarmentLine[] = garmentRows.map((row) => ({
    garmentTypeName: row._id,
    items: row.items,
    quantity: row.quantity,
    revenue: row.revenue,
  }))

  return {
    start,
    end,
    ordersTaken: totals?.ordersTaken ?? 0,
    garments: byGarment.reduce((sum, line) => sum + line.quantity, 0),
    gross: totals?.gross ?? 0,
    discounts: totals?.discounts ?? 0,
    netBilled: totals?.netBilled ?? 0,
    collected: totals?.collected ?? 0,
    outstanding: totals?.outstanding ?? 0,
    byGarment,
    byStatus: statusRows.map((row) => ({
      status: row._id,
      orders: row.orders,
      value: row.value,
    })),
    deliveredInMonth: deliveredRows[0]?.count ?? 0,
    newCustomers,
    designOnlyItems: designRows[0]?.count ?? 0,
  }
}
