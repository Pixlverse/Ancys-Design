import Link from "next/link"
import { notFound } from "next/navigation"
import { isValidObjectId } from "mongoose"
import { Check, Download, Phone, Wallet } from "lucide-react"
import type { Metadata } from "next"

import {
  AssignAssignee,
  type AssigneeOption,
} from "@/components/domain/AssignAssignee"
import { markFullyPaid } from "./actions"
import { ConfirmationCard } from "@/components/domain/ConfirmationCard"
import {
  ItemStatusPill,
  OrderStatusPill,
  StatusPill,
} from "@/components/domain/StatusPill"
import { OrderItemImages } from "@/components/domain/OrderItemImages"
import {
  ItemStageTracker,
  OrderStageTracker,
  OrderStatusActions,
} from "@/components/domain/StatusActions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DUE_TONE_CLASSES, dueTone } from "@/lib/calendar"
import { daysUntil, formatDate } from "@/lib/dates"
import { connectToDatabase } from "@/lib/db"
import { formatMeasurement } from "@/lib/measurements"
import { formatMoney } from "@/lib/money"
import { formatPhone } from "@/lib/phone"
import { Customer } from "@/models/customer"
import { GarmentType } from "@/models/garmentType"
import { MeasurementSet } from "@/models/measurementSet"
import { Order } from "@/models/order"
import { Assignee } from "@/models/assignee"

export const metadata: Metadata = { title: "Order · Ancys Design" }

export default async function OrderPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (!isValidObjectId(id)) notFound()

  await connectToDatabase()
  const order = await Order.findOne({ _id: id, isDeleted: false }).lean()
  if (!order) notFound()

  const [customer, garmentTypes, measurementSets, assigneeDocs] = await Promise.all([
    Customer.findById(order.customerId).select({ name: 1, phone: 1 }).lean(),
    GarmentType.find({
      _id: { $in: order.items.map((item) => item.garmentTypeId) },
    })
      .select({ measurementFields: 1 })
      .lean(),
    MeasurementSet.find({
      _id: {
        $in: order.items
          .map((item) => item.measurementSetId)
          .filter((value) => value !== undefined),
      },
    }).lean(),
    Assignee.find({ isActive: true, isDeleted: false })
      .select({ name: 1 })
      .sort({ name: 1 })
      .lean(),
  ])

  const assignees: AssigneeOption[] = assigneeDocs.map((assignee) => ({
    id: String(assignee._id),
    name: assignee.name,
  }))
  const assigneeName = new Map(assignees.map((a) => [a.id, a.name]))

  const fieldsByGarmentType = new Map(
    garmentTypes.map((garmentType) => [
      String(garmentType._id),
      garmentType.measurementFields.slice().sort((a, b) => a.order - b.order),
    ])
  )
  const setById = new Map(
    measurementSets.map((set) => [String(set._id), set])
  )

  return (
    <div className="space-y-5">
      {/* One summary block: who, when, how much and where it has got to — so
          the answers sit together instead of scattered down the page. */}
      <section className="space-y-4 rounded-3xl bg-card p-5 tile-float">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-2xl font-semibold tabular-nums">
                {order.orderNo}
              </h1>
              <OrderStatusPill status={order.status} />
            </div>
            {customer ? (
              <p className="mt-1 text-sm text-muted-foreground">
                <Link
                  href={`/customers/${String(customer._id)}`}
                  className="font-medium text-foreground underline underline-offset-4"
                >
                  {customer.name}
                </Link>{" "}
                ·{" "}
                <span className="tabular-nums">
                  {formatPhone(customer.phone)}
                </span>{" "}
                · taken {formatDate(order.createdAt)}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="h-11"
              nativeButton={false}
              render={
                <a
                  href={`/api/orders/${id}/invoice`}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Download className="size-4" aria-hidden />
                  Invoice
                </a>
              }
            />
            {customer ? (
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
            ) : null}
            {order.status === "delivered" ||
            order.status === "cancelled" ? null : (
              <Button
                className="h-11 brand-fill"
                nativeButton={false}
                render={<Link href={`/orders/${id}/edit`}>Edit order</Link>}
              />
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 border-t border-border/60 pt-4">
          <OrderStageTracker status={order.status} />
          <dl className="ml-auto flex flex-wrap items-baseline gap-x-6 gap-y-1 text-sm">
            <div className="flex items-baseline gap-2">
              <dt className="text-muted-foreground">Total</dt>
              <dd className="font-semibold tabular-nums">
                {formatMoney(order.total)}
              </dd>
            </div>
            <div className="flex items-baseline gap-2">
              <dt className="text-muted-foreground">
                {order.balance < 0 ? "To refund" : "Balance"}
              </dt>
              <dd className="font-semibold tabular-nums text-primary">
                {formatMoney(Math.abs(order.balance))}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {/* Garments on the left, everything about the order on the right. */}
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start">
        <div className="space-y-4">
          <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            {order.items.length} garment{order.items.length === 1 ? "" : "s"}
          </h2>

          {order.items.map((item) => {
            const fields =
              fieldsByGarmentType.get(String(item.garmentTypeId)) ?? []
            const set = item.measurementSetId
              ? setById.get(String(item.measurementSetId))
              : undefined
            const due = daysUntil(item.dueDate)
            const overdue = due < 0 && item.itemStatus !== "delivered"

            return (
              <Card key={String(item._id)}>
                <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3">
                  <CardTitle className="text-lg">
                    {item.garmentTypeName}
                    {item.quantity > 1 ? (
                      <span className="text-muted-foreground"> × {item.quantity}</span>
                    ) : null}
                  </CardTitle>
                  <div className="flex flex-wrap items-center gap-2">
                    <ItemStatusPill status={item.itemStatus} />
                    <StatusPill
                      tone={DUE_TONE_CLASSES[dueTone(item.dueDate, item.itemStatus)]}
                    >
                      Due {formatDate(item.dueDate)}
                      {overdue ? ` · ${Math.abs(due)}d late` : ""}
                      {due === 0 ? " · today" : ""}
                    </StatusPill>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Facts as a labelled grid, so they are scannable rather
                      than a run-on sentence. */}
                  <dl className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-2xl bg-muted/50 p-3.5 text-sm sm:grid-cols-4">
                    <Fact label="Rate" value={formatMoney(item.rate)} />
                    <Fact
                      label="Line total"
                      value={formatMoney(item.rate * item.quantity)}
                    />
                    <Fact
                      label={item.workType === "design_only" ? "Work" : "Cloth"}
                      value={
                        item.workType === "design_only"
                          ? "Design only"
                          : item.clothSource === "customer"
                            ? `Customer brought${item.clothLength ? ` · ${item.clothLength}m` : ""}`
                            : `Shop provides${item.clothLength ? ` · ${item.clothLength}m` : ""}`
                      }
                    />
                    <Fact
                      label="With"
                      value={
                        item.assignedTo
                          ? (assigneeName.get(String(item.assignedTo)) ??
                            "someone")
                          : "Nobody yet"
                      }
                    />
                  </dl>

                  <div className={item.workType === "design_only" ? "hidden" : ""}>
                    <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                      Measurements
                    </p>
                    {set ? (
                      <>
                        <p className="text-sm tabular-nums">
                          {fields
                            .filter(
                              (field) => set.values[field.key] !== undefined
                            )
                            .map(
                              (field) =>
                                `${field.label} ${formatMeasurement(set.values[field.key], field.unit)}`
                            )
                            .join(" · ")}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Taken {formatDate(set.takenOn)}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        None attached to this garment.
                      </p>
                    )}
                  </div>

                  <OrderItemImages images={item.images} />

                  {item.note ? (
                    <div>
                      <p className="mb-1.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        Note
                      </p>
                      <p className="rounded-2xl bg-accent/50 p-3 text-sm whitespace-pre-line">
                        {item.note}
                      </p>
                    </div>
                  ) : null}

                  <div className="space-y-3 border-t border-border/60 pt-4">
                    <div>
                      <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        Progress
                      </p>
                      <ItemStageTracker
                        orderId={id}
                        itemId={String(item._id)}
                        status={item.itemStatus}
                      />
                    </div>

                    <div>
                      <p className="mb-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        Assignee
                      </p>
                      <AssignAssignee
                        orderId={id}
                        itemId={String(item._id)}
                        assignedTo={
                          item.assignedTo ? String(item.assignedTo) : undefined
                        }
                        assignees={assignees}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Bill</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="space-y-2 text-sm">
                <Row label="Subtotal" value={formatMoney(order.subtotal)} />
                {order.discount > 0 ? (
                  <Row
                    label="Discount"
                    value={`− ${formatMoney(order.discount)}`}
                  />
                ) : null}
                <Row label="Total" value={formatMoney(order.total)} strong />
                {order.advancePaid > 0 ? (
                  <Row
                    label="Advance paid"
                    value={`− ${formatMoney(order.advancePaid)}`}
                  />
                ) : null}
                <div className="flex justify-between gap-3 rounded-2xl bg-accent/60 px-3 py-2.5">
                  <dt className="font-semibold">
                    {order.balance < 0 ? "To refund" : "Balance"}
                  </dt>
                  <dd className="font-semibold tabular-nums">
                    {formatMoney(Math.abs(order.balance))}
                  </dd>
                </div>
              </dl>

              {order.balance > 0 &&
              order.status !== "cancelled" ? (
                <form action={markFullyPaid} className="mt-4">
                  <input type="hidden" name="orderId" value={id} />
                  <Button type="submit" className="h-11 w-full brand-fill">
                    <Wallet className="size-4" aria-hidden />
                    Mark {formatMoney(order.balance)} as paid
                  </Button>
                </form>
              ) : order.balance === 0 ? (
                <p className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-emerald-50 py-2.5 text-sm font-semibold text-emerald-800">
                  <Check className="size-4" aria-hidden />
                  Fully paid
                </p>
              ) : null}
            </CardContent>
          </Card>

          <ConfirmationCard
            orderId={id}
            status={order.status}
            sentAt={
              order.confirmation.sentAt
                ? formatDate(order.confirmation.sentAt, { withYear: true })
                : undefined
            }
            viewedAt={
              order.confirmation.viewedAt
                ? formatDate(order.confirmation.viewedAt, { withYear: true })
                : undefined
            }
            confirmedAt={
              order.confirmation.confirmedAt
                ? formatDate(order.confirmation.confirmedAt, { withYear: true })
                : undefined
            }
            confirmedBy={order.confirmation.confirmedBy}
            billSentAt={
              order.confirmation.billSentAt
                ? formatDate(order.confirmation.billSentAt, { withYear: true })
                : undefined
            }
            publicUrl={
              order.confirmation.publicToken
                ? `${process.env.NEXT_PUBLIC_APP_URL ?? ""}/o/${order.confirmation.publicToken}`
                : undefined
            }
            customerNote={order.confirmation.customerNote}
            respondedAt={
              order.confirmation.respondedAt
                ? formatDate(order.confirmation.respondedAt, { withYear: true })
                : undefined
            }
          />

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Order actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <OrderStatusActions orderId={id} status={order.status} />

              {order.statusHistory.length > 0 ? (
                <div className="border-t border-border/60 pt-4">
                  <p className="mb-2.5 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                    History
                  </p>
                  {/* A timeline rather than a wall of arrows. */}
                  <ol className="space-y-2.5">
                    {order.statusHistory
                      .slice()
                      .reverse()
                      .map((change, index) => (
                        <li
                          key={`${change.at.toISOString()}-${index}`}
                          className="flex items-start gap-2.5 text-sm"
                        >
                          <span
                            aria-hidden
                            className={`mt-1.5 size-2 shrink-0 rounded-full ${index === 0 ? "bg-primary" : "bg-border"}`}
                          />
                          <span className="min-w-0">
                            <span className="block">
                              <span className="text-muted-foreground">
                                {change.from.replace(/_/g, " ")}
                              </span>
                              {" → "}
                              <span className="font-medium">
                                {change.to.replace(/_/g, " ")}
                              </span>
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {formatDate(change.at)}
                              {change.itemId ? " · a garment" : ""}
                              {change.note ? ` · ${change.note}` : ""}
                            </span>
                          </span>
                        </li>
                      ))}
                  </ol>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Button
            variant="ghost"
            className="h-11 w-full"
            nativeButton={false}
            render={<Link href="/orders">Back to orders</Link>}
          />
        </aside>
      </div>
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate font-medium tabular-nums">{value}</dd>
    </div>
  )
}

function Row({
  label,
  value,
  strong = false,
}: {
  label: string
  value: string
  strong?: boolean
}) {
  return (
    <div className="flex justify-between gap-3">
      <dt className={strong ? "font-medium" : "text-muted-foreground"}>
        {label}
      </dt>
      <dd className={`tabular-nums ${strong ? "font-medium" : ""}`}>{value}</dd>
    </div>
  )
}
