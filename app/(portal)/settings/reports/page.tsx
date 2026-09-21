import Link from "next/link"
import { redirect } from "next/navigation"
import { Download } from "lucide-react"
import type { Metadata } from "next"

import { StatusPill } from "@/components/domain/StatusPill"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { auth } from "@/lib/auth"
import { monthRangeIST } from "@/lib/calendar"
import { formatDate, parseDateInputIST, toDateInputIST } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import { ORDER_STATUS_LABELS, ORDER_STATUS_TONES } from "@/lib/orders/labels"
import { loadMonthlyReport } from "@/lib/reports/monthly"

export const metadata: Metadata = { title: "Sales report · Ancys Design" }

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>
}) {
  // The shop's takings: the owner's business, not every staff member's.
  const session = await auth()
  if (session?.user?.role !== "owner") redirect("/settings")

  const { month } = await searchParams
  const anchor = (month ? parseDateInputIST(`${month}-01`) : null) ?? new Date()
  const report = await loadMonthlyReport(anchor)

  const monthValue = toDateInputIST(report.start).slice(0, 7)
  const monthLabel = formatDate(report.start, { withYear: true }).replace(
    /^\d+\s/,
    ""
  )
  const step = (direction: -1 | 1) => {
    const moved = new Date(report.start)
    moved.setUTCMonth(moved.getUTCMonth() + direction)
    return `/settings/reports?month=${toDateInputIST(monthRangeIST(moved).start).slice(0, 7)}`
  }

  return (
    <div className="max-w-4xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Sales report
          </h1>
          <p className="text-sm text-muted-foreground">
            Orders taken between {formatDate(report.start)} and{" "}
            {formatDate(report.end, { withYear: true })}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            className="h-11"
            nativeButton={false}
            render={<Link href={step(-1)}>Previous</Link>}
          />
          <span className="min-w-32 text-center font-semibold">{monthLabel}</span>
          <Button
            variant="outline"
            className="h-11"
            nativeButton={false}
            render={<Link href={step(1)}>Next</Link>}
          />
          <Button
            className="h-11 brand-fill"
            nativeButton={false}
            render={
              <a href={`/api/reports/monthly?month=${monthValue}`}>
                <Download className="size-4" aria-hidden />
                Download PDF
              </a>
            }
          />
        </div>
      </div>

      <section className="grid gap-4 sm:grid-cols-3">
        <Tile label="Billed" value={formatMoney(report.netBilled)} accent />
        <Tile label="Collected" value={formatMoney(report.collected)} />
        <Tile label="Still to collect" value={formatMoney(report.outstanding)} />
      </section>

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <Tile label="Orders taken" value={String(report.ordersTaken)} small />
        <Tile label="Garments" value={String(report.garments)} small />
        <Tile
          label="Orders delivered"
          value={String(report.deliveredInMonth)}
          small
        />
        <Tile label="New customers" value={String(report.newCustomers)} small />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">What was made</CardTitle>
        </CardHeader>
        <CardContent>
          {report.byGarment.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No orders were taken in {monthLabel}.
            </p>
          ) : (
            <div className="overflow-hidden rounded-2xl">
              <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_5rem_7rem] gap-3 border-b border-border/60 bg-muted/40 px-4 py-2.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                <span>Garment</span>
                <span className="text-right">Orders</span>
                <span className="text-right">Qty</span>
                <span className="text-right">Revenue</span>
              </div>
              <ul className="divide-y divide-border/50">
                {report.byGarment.map((line) => (
                  <li
                    key={line.garmentTypeName}
                    className="grid grid-cols-[minmax(0,1fr)_4.5rem_5rem_7rem] gap-3 px-4 py-3"
                  >
                    <span className="truncate font-medium">
                      {line.garmentTypeName}
                    </span>
                    <span className="text-right tabular-nums">{line.items}</span>
                    <span className="text-right tabular-nums">
                      {line.quantity}
                    </span>
                    <span className="text-right font-semibold tabular-nums">
                      {formatMoney(line.revenue)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="grid grid-cols-[minmax(0,1fr)_4.5rem_5rem_7rem] gap-3 border-t border-border px-4 py-3 font-semibold">
                <span>Total</span>
                <span className="text-right tabular-nums">
                  {report.byGarment.reduce((sum, l) => sum + l.items, 0)}
                </span>
                <span className="text-right tabular-nums">{report.garments}</span>
                <span className="text-right tabular-nums">
                  {formatMoney(report.gross)}
                </span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {report.byStatus.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Orders by status</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border/50">
              {report.byStatus.map((line) => (
                <li
                  key={line.status}
                  className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <StatusPill tone={ORDER_STATUS_TONES[line.status]}>
                    {ORDER_STATUS_LABELS[line.status]}
                  </StatusPill>
                  <span className="ml-auto text-sm text-muted-foreground tabular-nums">
                    {line.orders} order{line.orders === 1 ? "" : "s"}
                  </span>
                  <span className="w-24 text-right font-semibold tabular-nums">
                    {formatMoney(line.value)}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <p className="rounded-2xl border border-dashed border-border px-4 py-3 text-xs text-muted-foreground">
        Cancelled orders are excluded. <strong>Collected</strong> is money
        received against orders taken this month, not cash that arrived during
        the month — a payment made today on an older order counts against that
        older month. Tracking true monthly cash would need a dated payment log.
      </p>

      <Button
        variant="ghost"
        className="h-11"
        nativeButton={false}
        render={<Link href="/settings">Back to settings</Link>}
      />
    </div>
  )
}

function Tile({
  label,
  value,
  accent = false,
  small = false,
}: {
  label: string
  value: string
  accent?: boolean
  small?: boolean
}) {
  return (
    <div
      className={`rounded-3xl p-5 tile-float ${accent ? "brand-fill" : "bg-card"}`}
    >
      <p
        className={`font-semibold tabular-nums ${small ? "text-xl" : "text-2xl"}`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-xs font-semibold opacity-70">{label}</p>
    </div>
  )
}
