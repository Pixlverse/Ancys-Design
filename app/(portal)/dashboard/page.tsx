import Link from "next/link"
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  ClipboardList,
  IndianRupee,
  MessageCircleWarning,
  Phone,
  Plus,
  Users,
} from "lucide-react"
import type { Metadata } from "next"
import type { LucideIcon } from "lucide-react"

import { OrderStatusPill } from "@/components/domain/StatusPill"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { daysUntil, formatDate } from "@/lib/dates"
import { loadDashboard } from "@/lib/dashboard"
import { formatMoney } from "@/lib/money"
import {
  ITEM_STAGE_ORDER,
  ORDER_ITEM_STATUS_LABELS,
  ORDER_ITEM_STATUS_TONES,
} from "@/lib/orders/labels"

export const metadata: Metadata = { title: "Dashboard · Ancys Design" }

export default async function DashboardPage() {
  const data = await loadDashboard()
  const onTheBench = ITEM_STAGE_ORDER.filter(
    (stage) => stage !== "delivered"
  ).reduce((sum, stage) => sum + data.byStage[stage], 0)

  return (
    <div className="space-y-5">
      {/* The four things that decide what the shop does this morning. */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          icon={AlertTriangle}
          label="Overdue"
          value={data.overdue}
          hint={data.overdue === 0 ? "Nothing late" : "garments past their date"}
          href="/calendar?view=month"
          tone={data.overdue > 0 ? "alarm" : "calm"}
        />
        <StatTile
          icon={CalendarClock}
          label="Due today"
          value={data.dueToday}
          hint={`${data.dueNextSevenDays} more in the next 7 days`}
          href="/calendar?view=day"
          tone={data.dueToday > 0 ? "warn" : "calm"}
        />
        <StatTile
          icon={MessageCircleWarning}
          label="Awaiting the customer"
          value={data.awaitingConfirmation}
          hint={`${data.drafts} draft${data.drafts === 1 ? "" : "s"} not sent`}
          href="/orders?status=awaiting_confirmation"
          tone="info"
        />
        <StatTile
          icon={IndianRupee}
          label="Still to collect"
          value={formatMoney(data.outstandingBalance)}
          hint={`${formatMoney(data.liveOrderValue)} booked`}
          href="/orders"
          tone="brand"
        />
      </section>

      {/* The workbench: where every live garment currently sits. */}
      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
          <CardTitle className="text-base">On the bench</CardTitle>
          <span className="text-sm text-muted-foreground">
            {onTheBench} garment{onTheBench === 1 ? "" : "s"} in hand
          </span>
        </CardHeader>
        <CardContent>
          {onTheBench === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nothing in progress. Confirmed orders show up here as work starts.
            </p>
          ) : (
            <ol className="grid grid-cols-2 gap-2.5 sm:grid-cols-5">
              {ITEM_STAGE_ORDER.filter((stage) => stage !== "delivered").map(
                (stage) => {
                  const count = data.byStage[stage]
                  const share = onTheBench > 0 ? (count / onTheBench) * 100 : 0
                  return (
                    <li
                      key={stage}
                      className={`rounded-2xl p-3 ring-1 ${count > 0 ? ORDER_ITEM_STATUS_TONES[stage] : "bg-muted/60 text-muted-foreground/60 ring-transparent"}`}
                    >
                      <p className="text-2xl font-semibold tabular-nums">
                        {count}
                      </p>
                      <p className="text-xs font-semibold">
                        {ORDER_ITEM_STATUS_LABELS[stage]}
                      </p>
                      <span
                        aria-hidden
                        className="mt-2 block h-1 rounded-full bg-current/25"
                      >
                        <span
                          className="block h-full rounded-full bg-current"
                          style={{ width: `${Math.max(share, count > 0 ? 8 : 0)}%` }}
                        />
                      </span>
                    </li>
                  )
                }
              )}
            </ol>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:items-start">
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
            <CardTitle className="text-base">Due next</CardTitle>
            <Button
              variant="ghost"
              className="h-9"
              nativeButton={false}
              render={
                <Link href="/calendar">
                  Calendar
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              }
            />
          </CardHeader>
          <CardContent>
            {data.upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nothing due. Take an order and its dates land here.
              </p>
            ) : (
              <ul className="divide-y divide-border/50">
                {data.upcoming.map((item) => {
                  const days = daysUntil(item.dueDate)
                  return (
                    <li
                      key={item.itemId}
                      className="grid grid-cols-[minmax(0,1fr)_5.5rem_2.5rem] items-center gap-3 py-3 first:pt-0 last:pb-0"
                    >
                      <Link href={`/orders/${item.orderId}`} className="min-w-0">
                        <p className="truncate font-medium">
                          {item.customerName}
                        </p>
                        <span className="mt-1 flex items-center gap-2 text-xs">
                          <span className="truncate text-muted-foreground">
                            {item.garmentTypeName}
                            {item.quantity > 1 ? ` × ${item.quantity}` : ""}
                          </span>
                          <span
                            aria-hidden
                            className="size-1 shrink-0 rounded-full bg-border"
                          />
                          <span className="shrink-0 font-semibold tabular-nums text-foreground/65">
                            {item.orderNo}
                          </span>
                        </span>
                      </Link>

                      <span className="text-right text-sm">
                        <span className="block font-medium tabular-nums">
                          {formatDate(item.dueDate)}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {days === 0
                            ? "today"
                            : days === 1
                              ? "tomorrow"
                              : `in ${days} days`}
                        </span>
                      </span>

                      <Button
                        variant="outline"
                        size="icon"
                        className="size-10 justify-self-end"
                        aria-label={`Call ${item.customerName}`}
                        nativeButton={false}
                        render={
                          <a href={`tel:${item.customerPhone}`}>
                            <Phone className="size-4" aria-hidden />
                          </a>
                        }
                      />
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base">Latest orders</CardTitle>
              <Button
                variant="outline"
                className="h-9"
                nativeButton={false}
                render={
                  <Link href="/orders/new">
                    <Plus className="size-4" aria-hidden />
                    New order
                  </Link>
                }
              />
            </CardHeader>
            <CardContent>
              {data.recentOrders.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No orders yet. The first one shows up here.
                </p>
              ) : (
                <ul className="divide-y divide-border/50">
                  {data.recentOrders.map((order) => (
                    <li key={order.id}>
                      {/* A grid, not a flex row: the status pill sized itself to
                          its longest label and shoved every amount out of line. */}
                      <Link
                        href={`/orders/${order.id}`}
                        className="grid grid-cols-[minmax(0,1fr)_5rem_5.5rem] items-center gap-3 py-3 first:pt-0 last:pb-0"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">
                            {order.customerName}
                          </span>
                          <span className="mt-1 flex items-center gap-2 text-xs">
                            <span className="font-semibold tabular-nums text-foreground/65">
                              {order.orderNo}
                            </span>
                            <span
                              aria-hidden
                              className="size-1 shrink-0 rounded-full bg-border"
                            />
                            <span className="tabular-nums text-muted-foreground">
                              {formatDate(order.createdAt)}
                            </span>
                          </span>
                        </span>
                        <span className="text-right text-sm font-semibold tabular-nums">
                          {formatMoney(order.total)}
                        </span>
                        <span className="flex justify-end">
                          <OrderStatusPill status={order.status} short />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <MiniTile
              icon={Users}
              label="Customers"
              value={data.customers.total}
              hint={`${data.customers.active} active · ${data.customers.leads} lead${data.customers.leads === 1 ? "" : "s"}`}
              href="/customers"
            />
            <MiniTile
              icon={ClipboardList}
              label="Unread alerts"
              value={data.unreadNotifications}
              hint={
                data.unreadNotifications === 0
                  ? "Nothing needs you"
                  : "reminders waiting"
              }
              href="/notifications"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

type Tone = "alarm" | "warn" | "info" | "brand" | "calm"

const TONES: Record<Tone, string> = {
  alarm: "bg-red-50 text-red-900 ring-red-200",
  warn: "bg-amber-50 text-amber-900 ring-amber-200",
  info: "bg-sky-50 text-sky-900 ring-sky-200",
  brand: "brand-fill ring-transparent",
  calm: "bg-card text-foreground ring-border",
}

const ICON_TONES: Record<Tone, string> = {
  alarm: "bg-red-100 text-red-700",
  warn: "bg-amber-100 text-amber-700",
  info: "bg-sky-100 text-sky-700",
  brand: "bg-white/15 text-current",
  calm: "bg-muted text-muted-foreground",
}

function StatTile({
  icon: Icon,
  label,
  value,
  hint,
  href,
  tone,
}: {
  icon: LucideIcon
  label: string
  value: number | string
  hint: string
  href: string
  tone: Tone
}) {
  return (
    <Link
      href={href}
      className={`flex flex-col gap-3 rounded-3xl p-5 ring-1 transition-transform tile-float hover:-translate-y-0.5 ${TONES[tone]}`}
    >
      <span className="flex items-center justify-between gap-3">
        <span
          className={`flex size-10 items-center justify-center rounded-2xl ${ICON_TONES[tone]}`}
        >
          <Icon className="size-5" aria-hidden />
        </span>
        <ArrowRight className="size-4 opacity-40" aria-hidden />
      </span>
      <span>
        <span className="block text-3xl font-semibold tabular-nums">
          {value}
        </span>
        <span className="block text-sm font-semibold">{label}</span>
        <span className="mt-0.5 block text-xs opacity-70">{hint}</span>
      </span>
    </Link>
  )
}

function MiniTile({
  icon: Icon,
  label,
  value,
  hint,
  href,
}: {
  icon: LucideIcon
  label: string
  value: number
  hint: string
  href: string
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-3xl bg-card p-4 transition-transform tile-float hover:-translate-y-0.5"
    >
      <span className="flex size-11 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
        <Icon className="size-5" aria-hidden />
      </span>
      <span className="min-w-0">
        <span className="block text-xl font-semibold tabular-nums">{value}</span>
        <span className="block text-xs font-semibold">{label}</span>
        <span className="block truncate text-xs text-muted-foreground">
          {hint}
        </span>
      </span>
    </Link>
  )
}
