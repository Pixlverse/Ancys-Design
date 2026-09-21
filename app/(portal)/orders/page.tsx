import Link from "next/link"
import { ClipboardList, Plus } from "lucide-react"
import type { Metadata } from "next"
import type { QueryFilter } from "mongoose"

import { Initials } from "@/components/domain/Initials"
import { EmptyState } from "@/components/shell/empty-state"
import { Pagination } from "@/components/shell/pagination"
import { OrderStatusPill } from "@/components/domain/StatusPill"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { daysUntil, endOfDayIST, formatDate, startOfDayIST } from "@/lib/dates"
import { connectToDatabase } from "@/lib/db"
import { paginate, parsePage } from "@/lib/pagination"
import { formatMoney } from "@/lib/money"
import { ORDER_STATUS_LABELS } from "@/lib/orders/labels"
import { Customer } from "@/models/customer"
import { Order, type OrderDocument } from "@/models/order"
import { ORDER_STATUSES, orderStatusSchema } from "@/schemas/order"

export const metadata: Metadata = { title: "Orders · Ancys Design" }

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string
    from?: string
    to?: string
    page?: string
  }>
}) {
  const { status, from, to, page: pageParam } = await searchParams

  // Mongoose 9 renamed FilterQuery to QueryFilter.
  const filter: QueryFilter<OrderDocument> = { isDeleted: false }

  const parsedStatus = orderStatusSchema.safeParse(status)
  if (parsedStatus.success) filter.status = parsedStatus.data

  // Due-date range, bounded on IST days rather than raw instants (rule 3).
  const dueRange: Record<string, Date> = {}
  if (from) {
    const start = startOfDayIST(new Date(`${from}T12:00:00.000Z`))
    if (!Number.isNaN(start.getTime())) dueRange.$gte = start
  }
  if (to) {
    const end = endOfDayIST(new Date(`${to}T12:00:00.000Z`))
    if (!Number.isNaN(end.getTime())) dueRange.$lte = end
  }
  if (Object.keys(dueRange).length > 0) filter.promisedDate = dueRange

  await connectToDatabase()
  const info = paginate(
    await Order.countDocuments(filter),
    parsePage(pageParam)
  )
  const orders = await Order.find(filter)
    // Soonest due first. Orders with no promised date sort last.
    .sort({ promisedDate: 1, createdAt: -1 })
    .skip(info.skip)
    .limit(info.pageSize)
    .lean()

  const customers = await Customer.find({
    _id: { $in: orders.map((order) => order.customerId) },
  })
    .select({ name: 1 })
    .lean()
  const customerName = new Map(
    customers.map((customer) => [String(customer._id), customer.name])
  )

  const filtered = Boolean(parsedStatus.success || from || to)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Orders</h1>
        <Button
          className="h-11"
          nativeButton={false}
          render={
            <Link href="/orders/new">
              <Plus className="size-4" aria-hidden />
              New order
            </Link>
          }
        />
      </div>

      {/* A GET form, so a filtered list is a shareable, reloadable URL. */}
      <form
        action="/orders"
        className="flex flex-wrap items-end gap-3 rounded-3xl bg-card p-4 tile-float"
      >
        <div className="space-y-1.5">
          <label htmlFor="status" className="block text-xs text-muted-foreground">
            Status
          </label>
          <select
            id="status"
            name="status"
            defaultValue={parsedStatus.success ? parsedStatus.data : ""}
            className="h-11 w-44 rounded-md border border-input bg-transparent px-3 text-sm"
          >
            <option value="">Any status</option>
            {ORDER_STATUSES.map((value) => (
              <option key={value} value={value}>
                {ORDER_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="from" className="block text-xs text-muted-foreground">
            Due from
          </label>
          <Input
            id="from"
            name="from"
            type="date"
            defaultValue={from ?? ""}
            className="h-11"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="to" className="block text-xs text-muted-foreground">
            Due to
          </label>
          <Input
            id="to"
            name="to"
            type="date"
            defaultValue={to ?? ""}
            className="h-11"
          />
        </div>

        <Button type="submit" variant="outline" className="h-11">
          Filter
        </Button>
        {filtered ? (
          <Button
            variant="ghost"
            className="h-11"
            nativeButton={false}
            render={<Link href="/orders">Clear</Link>}
          />
        ) : null}
      </form>

      {orders.length === 0 ? (
        filtered ? (
          <EmptyState
            icon={ClipboardList}
            title="No orders match those filters"
            description="Widen the date range, or clear the filters to see everything on the books."
            action={
              <Button
                variant="outline"
                className="h-11"
                nativeButton={false}
                render={<Link href="/orders">Clear filters</Link>}
              />
            }
          />
        ) : (
          <EmptyState
            icon={ClipboardList}
            title="No orders yet"
            description="Start an order from a customer's page, or straight from here. Add the garments, their cloth and their due dates."
            action={
              <Button
                className="h-11 brand-fill"
                nativeButton={false}
                render={
                  <Link href="/orders/new">
                    <Plus className="size-4" aria-hidden />
                    New order
                  </Link>
                }
              />
            }
          />
        )
      ) : (
        <div className="lg:overflow-hidden lg:rounded-3xl lg:bg-card lg:tile-float">
          {/* Eight columns, every one of them carrying a value. Slack is split
              between four flexible columns rather than pooling behind the
              customer name, which is what left a hole in the middle of the row. */}
          <div className="hidden grid-cols-[7rem_minmax(0,1.1fr)_minmax(0,1.3fr)_4.5rem_minmax(0,0.8fr)_minmax(0,0.9fr)_minmax(0,0.8fr)_9.5rem] gap-x-4 border-b border-border/60 bg-muted/40 px-5 py-2.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase lg:grid">
            <span>Order</span>
            <span>Customer</span>
            <span>Garments</span>
            <span className="text-center">Items</span>
            <span className="text-right">Total</span>
            <span className="text-right">Balance</span>
            <span className="text-right">Due</span>
            <span className="text-right">Status</span>
          </div>

          <ul className="space-y-3 lg:space-y-0 lg:divide-y lg:divide-border/50">
            {orders.map((order) => {
              const due = order.promisedDate
                ? daysUntil(order.promisedDate)
                : undefined
              const overdue =
                due !== undefined &&
                due < 0 &&
                order.status !== "delivered" &&
                order.status !== "cancelled"
              const customer =
                customerName.get(String(order.customerId)) ?? "—"
              const garments = order.items
                .map(
                  (item) =>
                    item.garmentTypeName +
                    (item.quantity > 1 ? ` ×${item.quantity}` : "")
                )
                .join(", ")

              return (
                <li
                  key={String(order._id)}
                  className="overflow-hidden rounded-3xl bg-card tile-float lg:rounded-none lg:bg-transparent lg:shadow-none"
                >
                  <Link
                    href={`/orders/${String(order._id)}`}
                    className="block transition-colors hover:bg-accent/45"
                  >
                    {/* Phone: a card, because the desktop columns folded into a
                        stack that read as loose facts rather than one order. */}
                    <span className="block space-y-3 px-4 py-4 lg:hidden">
                      <span className="flex items-start gap-3">
                        <Initials name={customer} className="size-10" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">
                            {customer}
                          </span>
                          <span className="block text-xs font-semibold tabular-nums text-muted-foreground">
                            {order.orderNo}
                          </span>
                        </span>
                        <OrderStatusPill status={order.status} short />
                      </span>

                      <span className="block truncate text-sm text-muted-foreground">
                        {garments}
                      </span>

                      <span className="flex items-end justify-between gap-3 border-t border-border/50 pt-3">
                        <span>
                          <span className="block text-base font-semibold tabular-nums">
                            {formatMoney(order.total)}
                          </span>
                          <span className="block text-xs tabular-nums">
                            {order.balance > 0 ? (
                              <span className="text-muted-foreground">
                                {formatMoney(order.balance)} due
                              </span>
                            ) : (
                              <span className="text-muted-foreground/60">
                                settled
                              </span>
                            )}
                          </span>
                        </span>

                        <span className="text-right">
                          <span className="block text-[11px] tracking-wide text-muted-foreground uppercase">
                            Due
                          </span>
                          <span
                            className={`block text-sm font-semibold tabular-nums ${
                              overdue ? "text-destructive" : ""
                            }`}
                          >
                            {order.promisedDate
                              ? formatDate(order.promisedDate)
                              : "—"}
                            {overdue ? ` · ${Math.abs(due)}d late` : ""}
                            {due === 0 ? " · today" : ""}
                          </span>
                        </span>
                      </span>
                    </span>

                    {/* Desktop: the table row. */}
                    <span className="hidden grid-cols-[7rem_minmax(0,1.1fr)_minmax(0,1.3fr)_4.5rem_minmax(0,0.8fr)_minmax(0,0.9fr)_minmax(0,0.8fr)_9.5rem] items-center gap-x-4 px-5 py-3.5 lg:grid">
                      <span className="text-sm font-semibold tabular-nums text-primary">
                        {order.orderNo}
                      </span>

                      <span className="min-w-0 truncate font-semibold">
                        {customer}
                      </span>

                      <span className="min-w-0 truncate text-sm text-muted-foreground">
                        {garments}
                      </span>

                      <span className="text-center text-sm text-muted-foreground">
                        {order.items.length}
                      </span>

                      <span className="text-right text-sm font-semibold tabular-nums">
                        {formatMoney(order.total)}
                      </span>

                      <span className="text-right text-sm tabular-nums">
                        {order.balance > 0 ? (
                          <span className="text-muted-foreground">
                            {formatMoney(order.balance)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50">settled</span>
                        )}
                      </span>

                      <span className="text-right text-sm tabular-nums">
                        {order.promisedDate ? (
                          <span
                            className={
                              overdue
                                ? "font-semibold text-destructive"
                                : "text-muted-foreground"
                            }
                          >
                            {formatDate(order.promisedDate)}
                            {overdue ? (
                              <span className="block text-xs">
                                {Math.abs(due)}d late
                              </span>
                            ) : due === 0 ? (
                              <span className="block text-xs font-semibold text-primary">
                                today
                              </span>
                            ) : null}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </span>

                      <span className="flex justify-end">
                        <OrderStatusPill status={order.status} />
                      </span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      <Pagination
        info={info}
        noun="orders"
        hrefForPage={(page) =>
          `/orders?${new URLSearchParams({
            ...(parsedStatus.success ? { status: parsedStatus.data } : {}),
            ...(from ? { from } : {}),
            ...(to ? { to } : {}),
            ...(page > 1 ? { page: String(page) } : {}),
          })}`
        }
      />
    </div>
  )
}
