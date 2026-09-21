import Link from "next/link"
import { notFound } from "next/navigation"
import { Types, isValidObjectId } from "mongoose"
import { ChevronRight, ClipboardList, Phone, Plus, Ruler } from "lucide-react"
import type { Metadata } from "next"

import {
  CustomerStatusPill,
  OrderStatusPill,
} from "@/components/domain/StatusPill"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { connectToDatabase } from "@/lib/db"
import { formatDate } from "@/lib/dates"
import { formatMeasurement } from "@/lib/measurements"
import { formatMoney } from "@/lib/money"
import { formatPhone } from "@/lib/phone"
import { Customer } from "@/models/customer"
import { GarmentType } from "@/models/garmentType"
import { MeasurementSet, type MeasurementSetDocument } from "@/models/measurementSet"
import { Order } from "@/models/order"

export const metadata: Metadata = { title: "Customer · Ancys Design" }

export default async function CustomerPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (!isValidObjectId(id)) notFound()

  await connectToDatabase()
  const customer = await Customer.findOne({ _id: id, isDeleted: false }).lean()
  if (!customer) notFound()

  // The latest set per garment type, plus how many there are in total. Grouped
  // in Mongo rather than pulled back and reduced here, so a customer measured
  // fifty times still costs one small result.
  const latestByGarment = await MeasurementSet.aggregate<LatestMeasurementRow>([
    { $match: { customerId: new Types.ObjectId(id) } },
    { $sort: { takenOn: -1 } },
    {
      $group: {
        _id: "$garmentTypeId",
        latest: { $first: "$$ROOT" },
        count: { $sum: 1 },
      },
    },
  ])

  const orders = await Order.find({ customerId: id, isDeleted: false })
    .select({
      orderNo: 1,
      status: 1,
      items: 1,
      total: 1,
      balance: 1,
      promisedDate: 1,
    })
    .sort({ createdAt: -1 })
    .limit(20)
    .lean()

  const garmentTypes = await GarmentType.find({
    _id: { $in: latestByGarment.map((row) => row._id) },
  })
    .select({ name: 1, measurementFields: 1 })
    .lean()

  const garmentTypeById = new Map(
    garmentTypes.map((garmentType) => [String(garmentType._id), garmentType])
  )

  const measurementCards = latestByGarment
    .map((row) => ({ row, garmentType: garmentTypeById.get(String(row._id)) }))
    .filter(
      (entry): entry is { row: LatestMeasurementRow; garmentType: NonNullable<typeof entry.garmentType> } =>
        entry.garmentType !== undefined
    )
    .sort((a, b) => a.garmentType.name.localeCompare(b.garmentType.name))

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{customer.name}</h1>
            <CustomerStatusPill status={customer.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            Added {formatDate(customer.createdAt)}
          </p>
        </div>

        <Button
          variant="outline"
          className="h-11"
          nativeButton={false}
          render={
            <a href={`tel:${customer.phone}`}>
              <Phone className="size-4" aria-hidden />
              Call
            </a>
          }
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Contact</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <Detail label="Phone">
            <a
              href={`tel:${customer.phone}`}
              className="tabular-nums underline-offset-4 hover:underline"
            >
              {formatPhone(customer.phone)}
            </a>
          </Detail>

          {customer.altPhone ? (
            <Detail label="Alternate">
              <a
                href={`tel:${customer.altPhone}`}
                className="tabular-nums underline-offset-4 hover:underline"
              >
                {formatPhone(customer.altPhone)}
              </a>
            </Detail>
          ) : null}

          {customer.address ? (
            <Detail label="Address">
              <span className="whitespace-pre-line">{customer.address}</span>
            </Detail>
          ) : null}

          {customer.notes ? (
            <Detail label="Notes">
              <span className="whitespace-pre-line">{customer.notes}</span>
            </Detail>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base">Orders</CardTitle>
          <Button
            variant="outline"
            className="h-11"
            nativeButton={false}
            render={
              <Link href={`/orders/new?customerId=${id}`}>
                <Plus className="size-4" aria-hidden />
                New order
              </Link>
            }
          />
        </CardHeader>
        <CardContent className="space-y-3">
          {orders.length === 0 ? (
            <SectionEmpty
              icon={ClipboardList}
              text="No orders yet. Start one and it will show up here."
            />
          ) : (
            orders.map((order) => (
              <Link
                key={String(order._id)}
                href={`/orders/${String(order._id)}`}
                className="flex items-center gap-4 rounded-2xl bg-muted/50 px-4 py-3 transition-colors hover:bg-accent"
              >
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-medium tabular-nums">
                      {order.orderNo}
                    </span>
                    <OrderStatusPill status={order.status} />
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {order.items.length} garment
                    {order.items.length === 1 ? "" : "s"} ·{" "}
                    <span className="tabular-nums">
                      {formatMoney(order.total)}
                    </span>
                    {order.balance > 0 ? (
                      <>
                        {" "}
                        · balance{" "}
                        <span className="tabular-nums">
                          {formatMoney(order.balance)}
                        </span>
                      </>
                    ) : null}
                    {order.promisedDate
                      ? ` · due ${formatDate(order.promisedDate)}`
                      : ""}
                  </p>
                </div>
                <ChevronRight
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
              </Link>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base">Measurements</CardTitle>
          <Button
            variant="outline"
            className="h-11"
            nativeButton={false}
            render={
              <Link href={`/customers/${id}/measurements/new`}>
                <Plus className="size-4" aria-hidden />
                Take measurements
              </Link>
            }
          />
        </CardHeader>
        <CardContent className="space-y-3">
          {measurementCards.length === 0 ? (
            <SectionEmpty
              icon={Ruler}
              text="No measurements yet. Take them per garment — the fields come from that garment's setup."
            />
          ) : (
            measurementCards.map(({ row, garmentType }) => {
              const fields = garmentType.measurementFields
                .slice()
                .sort((a, b) => a.order - b.order)
                .filter((field) => row.latest.values[field.key] !== undefined)

              return (
                <Link
                  key={String(row._id)}
                  href={`/customers/${id}/measurements/${String(row._id)}`}
                  className="flex items-start gap-4 rounded-2xl bg-muted/50 px-4 py-3 transition-colors hover:bg-accent"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="font-medium">{garmentType.name}</p>
                    <p className="text-sm text-muted-foreground tabular-nums">
                      {fields
                        .map(
                          (field) =>
                            `${field.label} ${formatMeasurement(row.latest.values[field.key], field.unit)}`
                        )
                        .join(" · ")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Taken {formatDate(row.latest.takenOn)}
                      {row.count > 1 ? ` · ${row.count} sets on record` : null}
                    </p>
                  </div>
                  <ChevronRight
                    className="mt-1 size-4 shrink-0 text-muted-foreground"
                    aria-hidden
                  />
                </Link>
              )
            })
          )}
        </CardContent>
      </Card>

      <Button
        variant="ghost"
        className="h-11"
        nativeButton={false}
        render={<Link href="/customers">Back to customers</Link>}
      />
    </div>
  )
}

function Detail({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="grid gap-0.5 sm:grid-cols-[8rem_1fr] sm:gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span>{children}</span>
    </div>
  )
}

function SectionEmpty({
  icon: Icon,
  text,
}: {
  icon: React.ComponentType<{ className?: string }>
  text: string
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
      <Icon className="size-4 shrink-0" />
      {text}
    </div>
  )
}

/** One row of the "latest set per garment type" aggregation. */
interface LatestMeasurementRow {
  _id: Types.ObjectId
  latest: MeasurementSetDocument
  count: number
}
