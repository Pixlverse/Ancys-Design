import Link from "next/link"
import { Types } from "mongoose"
import { CalendarDays, ChevronLeft, ChevronRight, Phone } from "lucide-react"
import type { Metadata } from "next"
import type { PipelineStage } from "mongoose"

import { ItemStatusPill } from "@/components/domain/StatusPill"
import { Button } from "@/components/ui/button"
import {
  DUE_TONE_CLASSES,
  DUE_TONE_LABELS,
  type DueTone,
  dayRangeIST,
  dueTone,
  monthGridIST,
  monthGridRangeIST,
  monthRangeIST,
  weekRangeIST,
} from "@/lib/calendar"
import {
  dayNumberIST,
  daysUntil,
  formatDate,
  parseDateInputIST,
  startOfDayIST,
  toDateInputIST,
  weekdayIST,
} from "@/lib/dates"
import { connectToDatabase } from "@/lib/db"
import { ORDER_STATUS_LABELS } from "@/lib/orders/labels"
import { formatPhone } from "@/lib/phone"
import { GarmentType } from "@/models/garmentType"
import { Order } from "@/models/order"
import { Assignee } from "@/models/assignee"
import { ORDER_STATUSES, orderStatusSchema } from "@/schemas/order"
import type { OrderItemStatus, OrderStatus } from "@/schemas/order"

export const metadata: Metadata = { title: "Calendar · Ancys Design" }

type View = "month" | "week" | "day"

/** One garment due on one day — everything a chip or a day list needs. */
interface DueItem {
  orderId: Types.ObjectId
  orderNo: string
  orderStatus: OrderStatus
  itemId: Types.ObjectId
  garmentTypeName: string
  quantity: number
  dueDate: Date
  itemStatus: OrderItemStatus
  customerName: string
  customerPhone: string
}

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string
    date?: string
    status?: string
    garmentTypeId?: string
    assigneeId?: string
  }>
}) {
  const query = await searchParams
  const view: View =
    query.view === "week" || query.view === "day" ? query.view : "month"

  // The anchor is a day in the shop's calendar, so it is parsed as one — and
  // validated, because ?date= comes from the URL and may be anything at all.
  const anchor = (query.date ? parseDateInputIST(query.date) : null) ?? new Date()

  const range =
    view === "month"
      ? monthGridRangeIST(anchor)
      : view === "week"
        ? weekRangeIST(anchor)
        : dayRangeIST(anchor)

  await connectToDatabase()

  const parsedStatus = orderStatusSchema.safeParse(query.status)
  const garmentTypeId =
    query.garmentTypeId && Types.ObjectId.isValid(query.garmentTypeId)
      ? new Types.ObjectId(query.garmentTypeId)
      : undefined
  const assigneeId =
    query.assigneeId && Types.ObjectId.isValid(query.assigneeId)
      ? new Types.ObjectId(query.assigneeId)
      : undefined

  /**
   * One month must not load the order book. The first $match uses the
   * {isDeleted, items.dueDate} index to pick only orders with an item in the
   * window; the second $match narrows to the matching *elements*, because the
   * first selects whole documents. Only chip-sized fields come back.
   */
  const pipeline: PipelineStage[] = [
    {
      $match: {
        isDeleted: false,
        "items.dueDate": { $gte: range.start, $lte: range.end },
        ...(parsedStatus.success ? { status: parsedStatus.data } : {}),
      },
    },
    { $unwind: "$items" },
    {
      $match: {
        "items.dueDate": { $gte: range.start, $lte: range.end },
        ...(garmentTypeId ? { "items.garmentTypeId": garmentTypeId } : {}),
        ...(assigneeId ? { "items.assignedTo": assigneeId } : {}),
      },
    },
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
        orderId: "$_id",
        orderNo: 1,
        orderStatus: "$status",
        itemId: "$items._id",
        garmentTypeName: "$items.garmentTypeName",
        quantity: "$items.quantity",
        dueDate: "$items.dueDate",
        itemStatus: "$items.itemStatus",
        customerName: "$customer.name",
        customerPhone: "$customer.phone",
      },
    },
    { $sort: { dueDate: 1, customerName: 1 } },
  ]

  const [items, garmentTypes, assignees] = await Promise.all([
    Order.aggregate<DueItem>(pipeline),
    GarmentType.find({ isDeleted: false }).select({ name: 1 }).sort({ name: 1 }).lean(),
    Assignee.find({ isActive: true, isDeleted: false })
      .select({ name: 1 })
      .sort({ name: 1 })
      .lean(),
  ])

  // Bucket by IST day, so a garment due at 23:00 IST lands on the right cell.
  const byDay = new Map<string, DueItem[]>()
  for (const item of items) {
    const key = toDateInputIST(item.dueDate)
    const bucket = byDay.get(key)
    if (bucket) bucket.push(item)
    else byDay.set(key, [item])
  }

  const anchorParam = toDateInputIST(anchor)
  const link = (overrides: Record<string, string | undefined>) => {
    const params = new URLSearchParams()
    const merged = {
      view,
      date: anchorParam,
      status: parsedStatus.success ? parsedStatus.data : undefined,
      garmentTypeId: query.garmentTypeId,
      assigneeId: query.assigneeId,
      ...overrides,
    }
    for (const [key, value] of Object.entries(merged)) {
      if (value) params.set(key, value)
    }
    return `/calendar?${params.toString()}`
  }

  const step = (direction: -1 | 1) => {
    const days = view === "month" ? 0 : view === "week" ? 7 * direction : direction
    const base = new Date(anchor)
    if (view === "month") base.setUTCMonth(base.getUTCMonth() + direction)
    else base.setUTCDate(base.getUTCDate() + days)
    return link({ date: toDateInputIST(base) })
  }

  const heading =
    view === "month"
      ? formatDate(monthRangeIST(anchor).start, { withYear: true }).replace(
          /^\d+ /,
          ""
        )
      : view === "week"
        ? `${formatDate(weekRangeIST(anchor).start)} – ${formatDate(weekRangeIST(anchor).end, { withYear: true })}`
        : formatDate(anchor, { withYear: true })

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Calendar</h1>
        <div className="flex items-center gap-1 rounded-full bg-card p-1 tile-float">
          {(["month", "week", "day"] as const).map((option) => (
            <Link
              key={option}
              href={link({ view: option })}
              className={`min-h-9 rounded-full px-3.5 py-1.5 text-sm capitalize ${
                view === option ? "brand-fill font-semibold" : "text-muted-foreground"
              }`}
            >
              {option}
            </Link>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            className="size-11"
            aria-label="Previous"
            nativeButton={false}
            render={
              <Link href={step(-1)}>
                <ChevronLeft className="size-4" aria-hidden />
              </Link>
            }
          />
          <h2 className="min-w-40 text-center text-lg font-medium">{heading}</h2>
          <Button
            variant="outline"
            size="icon"
            className="size-11"
            aria-label="Next"
            nativeButton={false}
            render={
              <Link href={step(1)}>
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            }
          />
          <Button
            variant="ghost"
            className="h-11"
            nativeButton={false}
            render={<Link href={link({ date: toDateInputIST(new Date()) })}>Today</Link>}
          />
        </div>

        <form
          action="/calendar"
          className="flex flex-wrap items-center gap-2 rounded-2xl bg-card p-2 tile-float"
        >
          <input type="hidden" name="view" value={view} />
          <input type="hidden" name="date" value={anchorParam} />
          <select
            name="status"
            defaultValue={parsedStatus.success ? parsedStatus.data : ""}
            aria-label="Filter by order status"
            className="h-11 rounded-xl border border-input bg-transparent px-3 text-sm"
          >
            <option value="">Any status</option>
            {ORDER_STATUSES.map((value) => (
              <option key={value} value={value}>
                {ORDER_STATUS_LABELS[value]}
              </option>
            ))}
          </select>
          <select
            name="garmentTypeId"
            defaultValue={query.garmentTypeId ?? ""}
            aria-label="Filter by garment type"
            className="h-11 rounded-xl border border-input bg-transparent px-3 text-sm"
          >
            <option value="">Any garment</option>
            {garmentTypes.map((garmentType) => (
              <option key={String(garmentType._id)} value={String(garmentType._id)}>
                {garmentType.name}
              </option>
            ))}
          </select>
          <select
            name="assigneeId"
            defaultValue={query.assigneeId ?? ""}
            aria-label="Filter by assignee"
            className="h-11 rounded-xl border border-input bg-transparent px-3 text-sm"
          >
            <option value="">Any assignee</option>
            {assignees.map((assignee) => (
              <option key={String(assignee._id)} value={String(assignee._id)}>
                {assignee.name}
              </option>
            ))}
          </select>
          <Button type="submit" variant="outline" className="h-11">
            Filter
          </Button>
        </form>
      </div>

      <Legend />

      {view === "month" ? (
        <>
          {/* A month grid needs width. On a phone it becomes a 44rem sideways
              scroller showing three mostly-empty columns, so the same month is
              given as an agenda instead: only the days that have work. */}
          <div className="hidden md:block">
            <MonthView anchor={anchor} byDay={byDay} link={link} />
          </div>
          <div className="md:hidden">
            <DayList days={daysWithWork(anchor, byDay)} byDay={byDay} />
          </div>
        </>
      ) : (
        <DayList
          days={
            view === "week"
              ? sevenDaysFrom(weekRangeIST(anchor).start)
              : [startOfDayIST(anchor)]
          }
          byDay={byDay}
        />
      )}

      {items.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
          <CalendarDays className="mx-auto mb-3 size-6" aria-hidden />
          Nothing is due in this {view}. Take an order and its due dates appear
          here.
        </p>
      ) : null}
    </div>
  )
}

/** The days of this month that actually have garments due, for the phone agenda. */
function daysWithWork(anchor: Date, byDay: Map<string, DueItem[]>): Date[] {
  const month = monthRangeIST(anchor)
  return monthGridIST(anchor)
    .flat()
    .filter(
      (day) =>
        day.getTime() >= month.start.getTime() &&
        day.getTime() <= month.end.getTime() &&
        (byDay.get(toDateInputIST(day))?.length ?? 0) > 0
    )
}

function sevenDaysFrom(start: Date): Date[] {
  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start)
    day.setUTCDate(day.getUTCDate() + index)
    return day
  })
}

function Legend() {
  return (
    <ul className="flex flex-wrap gap-2 text-xs">
      {(Object.keys(DUE_TONE_LABELS) as DueTone[]).map((tone) => (
        <li
          key={tone}
          className={`rounded px-2 py-1 ring-1 ${DUE_TONE_CLASSES[tone]}`}
        >
          {DUE_TONE_LABELS[tone]}
        </li>
      ))}
    </ul>
  )
}

function MonthView({
  anchor,
  byDay,
  link,
}: {
  anchor: Date
  byDay: Map<string, DueItem[]>
  link: (overrides: Record<string, string | undefined>) => string
}) {
  const grid = monthGridIST(anchor)
  const month = monthRangeIST(anchor)
  const todayKey = toDateInputIST(new Date())

  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[44rem] grid-cols-7 gap-px rounded-lg bg-border">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
          <div
            key={day}
            className="bg-card px-2 py-1.5 text-center text-xs font-medium text-muted-foreground"
          >
            {day}
          </div>
        ))}

        {grid.flat().map((day) => {
          const key = toDateInputIST(day)
          const dayItems = byDay.get(key) ?? []
          const inMonth =
            day.getTime() >= month.start.getTime() &&
            day.getTime() <= month.end.getTime()

          return (
            <div
              key={key}
              className={`min-h-24 space-y-1 bg-card p-1.5 lg:min-h-28 ${inMonth ? "" : "opacity-45"}`}
            >
              <div className="flex items-center justify-between">
                <Link
                  href={link({ view: "day", date: key })}
                  className={`rounded px-1.5 py-0.5 text-sm ${
                    key === todayKey ? "bg-foreground font-semibold text-background" : ""
                  }`}
                >
                  {formatDate(day, { withYear: false }).split(" ")[0]}
                </Link>
                {dayItems.length > 0 ? (
                  <span
                    className="text-xs text-muted-foreground tabular-nums"
                    title={`${dayItems.length} garments due`}
                  >
                    {dayItems.length}
                  </span>
                ) : null}
              </div>

              {dayItems.slice(0, 4).map((item) => (
                <Chip key={String(item.itemId)} item={item} />
              ))}

              {dayItems.length > 4 ? (
                <Link
                  href={link({ view: "day", date: key })}
                  className="block px-1 text-xs text-muted-foreground underline"
                >
                  {dayItems.length - 4} more
                </Link>
              ) : null}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function Chip({ item }: { item: DueItem }) {
  const tone = dueTone(item.dueDate, item.itemStatus)
  return (
    <Link
      href={`/orders/${String(item.orderId)}`}
      className={`block truncate rounded px-1.5 py-1 text-xs ring-1 ${DUE_TONE_CLASSES[tone]}`}
      title={`${item.customerName} — ${item.garmentTypeName} (${item.orderNo})`}
    >
      {item.customerName} · {item.garmentTypeName}
    </Link>
  )
}

/**
 * Week, day, and the phone's month agenda.
 *
 * The date leads and carries the urgency — every garment under it shares that
 * date, so colouring the header says more than repeating a due badge on each
 * row. The rows then carry what is actually different between them: which
 * garment, and how far along it is.
 */
function DayList({
  days,
  byDay,
}: {
  days: Date[]
  byDay: Map<string, DueItem[]>
}) {
  return (
    <div className="space-y-4">
      {days.map((day) => {
        const key = toDateInputIST(day)
        const dayItems = byDay.get(key) ?? []
        const away = daysUntil(day)

        // The day's own urgency: the worst of anything still outstanding on it.
        const liveTone: DueTone = dayItems.some(
          (item) => item.itemStatus !== "delivered"
        )
          ? away < 0
            ? "overdue"
            : away === 0
              ? "today"
              : away <= 3
                ? "soon"
                : "later"
          : "delivered"

        const relative =
          away === 0
            ? "Today"
            : away === 1
              ? "Tomorrow"
              : away === -1
                ? "Yesterday"
                : away < 0
                  ? `${Math.abs(away)} days ago`
                  : `In ${away} days`

        return (
          <section
            key={key}
            className="overflow-hidden rounded-3xl bg-card tile-float"
          >
            <header
              className={`flex items-center gap-3.5 px-4 py-3 ring-1 ring-inset ${DUE_TONE_CLASSES[liveTone]}`}
            >
              <span className="flex size-12 shrink-0 flex-col items-center justify-center rounded-2xl bg-card/70">
                <span className="text-lg leading-none font-bold tabular-nums">
                  {dayNumberIST(day)}
                </span>
                <span className="text-[10px] font-semibold uppercase opacity-70">
                  {weekdayIST(day)}
                </span>
              </span>

              <span className="min-w-0">
                <span className="block font-semibold">
                  {formatDate(day, { withYear: true })}
                </span>
                <span className="block text-xs font-semibold opacity-75">
                  {relative}
                  {dayItems.length > 0
                    ? ` · ${dayItems.length} garment${dayItems.length === 1 ? "" : "s"}`
                    : ""}
                </span>
              </span>

              {dayItems.length > 0 ? (
                <span className="ml-auto text-xs font-semibold tracking-wide uppercase opacity-80">
                  {DUE_TONE_LABELS[liveTone]}
                </span>
              ) : null}
            </header>

            {dayItems.length === 0 ? (
              <p className="px-4 py-5 text-sm text-muted-foreground">
                Nothing due.
              </p>
            ) : (
              <ul className="divide-y divide-border/50">
                {dayItems.map((item) => (
                  <li
                    key={String(item.itemId)}
                    className="flex flex-wrap items-center gap-x-3 gap-y-2.5 px-4 py-3.5"
                  >
                    <Link
                      href={`/orders/${String(item.orderId)}`}
                      className="min-w-0 flex-1"
                    >
                      <span className="block truncate font-semibold">
                        {item.customerName}
                      </span>
                      <span className="mt-0.5 flex items-center gap-2 text-xs">
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

                    {/* What is actually different between rows: the stage. */}
                    <ItemStatusPill status={item.itemStatus} />

                    <Button
                      variant="outline"
                      className="h-11 w-full sm:w-auto"
                      nativeButton={false}
                      render={
                        <a href={`tel:${item.customerPhone}`}>
                          <Phone className="size-4" aria-hidden />
                          <span className="tabular-nums">
                            {formatPhone(item.customerPhone)}
                          </span>
                        </a>
                      }
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </div>
  )
}
