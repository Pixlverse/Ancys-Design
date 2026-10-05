import { NextResponse, type NextRequest } from "next/server"
import type { QueryFilter } from "mongoose"

import { AuthorizationError, requireRole } from "@/lib/auth"
import { buildCustomerSearch, escapeRegExp } from "@/lib/customers"
import { connectToDatabase } from "@/lib/db"
import { formatPhone } from "@/lib/phone"
import { Customer } from "@/models/customer"
import { Order, type OrderDocument } from "@/models/order"

export interface TagOrderResult {
  id: string
  orderNo: string
  customerName: string
  garments: string
}

export interface TagCustomerResult {
  id: string
  name: string
  phone: string
}

export interface TagSearchResponse {
  orders: TagOrderResult[]
  customers: TagCustomerResult[]
}

/**
 * Feeds the purchase form's "for which order or customer" picker. Searches by
 * order number, phone or name. With nothing typed, offers the open orders most
 * recently taken — what staff are usually buying for.
 */
export async function GET(request: NextRequest) {
  try {
    await requireRole("owner", "staff")
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    throw error
  }

  const query = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 60)

  await connectToDatabase()

  const customers =
    query === ""
      ? []
      : await Customer.find(buildCustomerSearch(query).filter)
          .select({ name: 1, phone: 1 })
          .sort({ name: 1 })
          .limit(5)
          .lean()

  const orderFilter: QueryFilter<OrderDocument> = { isDeleted: false }
  if (query === "") {
    orderFilter.status = { $nin: ["delivered", "cancelled"] }
  } else {
    const conditions: QueryFilter<OrderDocument>[] = [
      { customerId: { $in: customers.map((customer) => customer._id) } },
    ]
    if (/\d/.test(query)) {
      conditions.push({ orderNo: { $regex: escapeRegExp(query) } })
    }
    orderFilter.$or = conditions
  }

  const orders = await Order.find(orderFilter)
    .select({ orderNo: 1, customerId: 1, items: 1 })
    .sort({ createdAt: -1 })
    .limit(8)
    .lean()

  // Orders found by number may belong to customers the name search missed.
  const names = new Map(
    customers.map((customer) => [String(customer._id), customer.name])
  )
  const missing = orders
    .map((order) => order.customerId)
    .filter((id) => !names.has(String(id)))
  if (missing.length > 0) {
    const extra = await Customer.find({ _id: { $in: missing } })
      .select({ name: 1 })
      .lean()
    for (const customer of extra) names.set(String(customer._id), customer.name)
  }

  const body: TagSearchResponse = {
    orders: orders.map((order) => ({
      id: String(order._id),
      orderNo: order.orderNo,
      customerName: names.get(String(order.customerId)) ?? "—",
      garments: order.items.map((item) => item.garmentTypeName).join(", "),
    })),
    customers: customers.map((customer) => ({
      id: String(customer._id),
      name: customer.name,
      phone: formatPhone(customer.phone),
    })),
  }

  return NextResponse.json(body)
}
