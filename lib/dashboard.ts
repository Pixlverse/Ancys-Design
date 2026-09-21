import type { PipelineStage } from "mongoose"

import { endOfDayIST, startOfDayIST } from "@/lib/dates"
import { connectToDatabase } from "@/lib/db"
import { Customer } from "@/models/customer"
import { Notification } from "@/models/notification"
import { Order } from "@/models/order"
import type { OrderItemStatus, OrderStatus } from "@/schemas/order"

/**
 * Everything the dashboard shows, gathered in one place.
 *
 * Counted with aggregations rather than by pulling orders back and reducing
 * them here — a shop with a thousand orders should still cost one small result
 * per figure. Every day boundary goes through lib/dates.ts in IST (rule 3).
 */

/** Work that is still the shop's problem. */
const LIVE_STATUSES: readonly OrderStatus[] = [
  "confirmed",
  "in_progress",
  "ready",
]

export interface DueGarment {
  orderId: string
  orderNo: string
  itemId: string
  garmentTypeName: string
  quantity: number
  dueDate: Date
  itemStatus: OrderItemStatus
  customerName: string
  customerPhone: string
}

export interface RecentOrder {
  id: string
  orderNo: string
  status: OrderStatus
  total: number
  balance: number
  customerName: string
  createdAt: Date
}

export interface DashboardData {
  overdue: number
  dueToday: number
  dueNextSevenDays: number
  awaitingConfirmation: number
  drafts: number
  /** All integer paise. */
  outstandingBalance: number
  liveOrderValue: number
  byStage: Record<OrderItemStatus, number>
  upcoming: DueGarment[]
  recentOrders: RecentOrder[]
  customers: { total: number; leads: number; active: number }
  unreadNotifications: number
}

interface StageRow {
  _id: OrderItemStatus
  count: number
}

interface DueBucketRow {
  _id: null
  overdue: number
  dueToday: number
  dueNextSevenDays: number
}

interface MoneyRow {
  _id: null
  balance: number
  total: number
}

interface CustomerRow {
  _id: string
  count: number
}

export async function loadDashboard(now: Date = new Date()): Promise<DashboardData> {
  await connectToDatabase()

  const todayStart = startOfDayIST(now)
  const todayEnd = endOfDayIST(now)
  const weekEnd = endOfDayIST(
    new Date(todayStart.getTime() + 7 * 24 * 60 * 60 * 1000)
  )

  // Garments still on the bench, whatever order they belong to.
  const liveItems: PipelineStage[] = [
    { $match: { isDeleted: false, status: { $in: LIVE_STATUSES } } },
    { $unwind: "$items" },
    { $match: { "items.itemStatus": { $ne: "delivered" } } },
  ]

  const [
    stageRows,
    dueRows,
    moneyRows,
    awaitingConfirmation,
    drafts,
    upcomingRows,
    recentRows,
    customerRows,
    unreadNotifications,
  ] = await Promise.all([
    Order.aggregate<StageRow>([
      ...liveItems,
      { $group: { _id: "$items.itemStatus", count: { $sum: 1 } } },
    ]),

    Order.aggregate<DueBucketRow>([
      ...liveItems,
      {
        $group: {
          _id: null,
          overdue: {
            $sum: { $cond: [{ $lt: ["$items.dueDate", todayStart] }, 1, 0] },
          },
          dueToday: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gte: ["$items.dueDate", todayStart] },
                    { $lte: ["$items.dueDate", todayEnd] },
                  ],
                },
                1,
                0,
              ],
            },
          },
          dueNextSevenDays: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $gt: ["$items.dueDate", todayEnd] },
                    { $lte: ["$items.dueDate", weekEnd] },
                  ],
                },
                1,
                0,
              ],
            },
          },
        },
      },
    ]),

    Order.aggregate<MoneyRow>([
      {
        $match: {
          isDeleted: false,
          status: { $nin: ["cancelled", "draft"] },
        },
      },
      {
        $group: {
          _id: null,
          balance: { $sum: "$balance" },
          total: { $sum: "$total" },
        },
      },
    ]),

    Order.countDocuments({ isDeleted: false, status: "awaiting_confirmation" }),
    Order.countDocuments({ isDeleted: false, status: "draft" }),

    Order.aggregate<DueGarment & { _id: unknown }>([
      ...liveItems,
      { $match: { "items.dueDate": { $gte: todayStart } } },
      { $sort: { "items.dueDate": 1 } },
      { $limit: 8 },
      {
        $lookup: {
          from: "customers",
          localField: "customerId",
          foreignField: "_id",
          as: "customer",
        },
      },
      { $unwind: "$customer" },
      {
        $project: {
          _id: 0,
          orderId: { $toString: "$_id" },
          orderNo: 1,
          itemId: { $toString: "$items._id" },
          garmentTypeName: "$items.garmentTypeName",
          quantity: "$items.quantity",
          dueDate: "$items.dueDate",
          itemStatus: "$items.itemStatus",
          customerName: "$customer.name",
          customerPhone: "$customer.phone",
        },
      },
    ]),

    Order.find({ isDeleted: false })
      .select({ orderNo: 1, status: 1, total: 1, balance: 1, customerId: 1, createdAt: 1 })
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),

    Customer.aggregate<CustomerRow>([
      { $match: { isDeleted: false } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),

    Notification.countDocuments({ isRead: false }),
  ])

  const customerNames = await Customer.find({
    _id: { $in: recentRows.map((order) => order.customerId) },
  })
    .select({ name: 1 })
    .lean()
  const nameById = new Map(
    customerNames.map((customer) => [String(customer._id), customer.name])
  )

  const byStage: Record<OrderItemStatus, number> = {
    pending: 0,
    cutting: 0,
    stitching: 0,
    finishing: 0,
    ready: 0,
    delivered: 0,
  }
  for (const row of stageRows) byStage[row._id] = row.count

  const due = dueRows[0]
  const money = moneyRows[0]
  const leads = customerRows.find((row) => row._id === "lead")?.count ?? 0
  const active = customerRows.find((row) => row._id === "active")?.count ?? 0

  return {
    overdue: due?.overdue ?? 0,
    dueToday: due?.dueToday ?? 0,
    dueNextSevenDays: due?.dueNextSevenDays ?? 0,
    awaitingConfirmation,
    drafts,
    outstandingBalance: money?.balance ?? 0,
    liveOrderValue: money?.total ?? 0,
    byStage,
    upcoming: upcomingRows.map((row) => ({
      orderId: row.orderId,
      orderNo: row.orderNo,
      itemId: row.itemId,
      garmentTypeName: row.garmentTypeName,
      quantity: row.quantity,
      dueDate: row.dueDate,
      itemStatus: row.itemStatus,
      customerName: row.customerName,
      customerPhone: row.customerPhone,
    })),
    recentOrders: recentRows.map((order) => ({
      id: String(order._id),
      orderNo: order.orderNo,
      status: order.status,
      total: order.total,
      balance: order.balance,
      customerName: nameById.get(String(order.customerId)) ?? "—",
      createdAt: order.createdAt,
    })),
    customers: { total: leads + active, leads, active },
    unreadNotifications,
  }
}
