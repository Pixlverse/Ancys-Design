import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { Types, isValidObjectId } from "mongoose"
import type { Metadata } from "next"

import {
  OrderBuilder,
  type ExistingMeasurementSet,
} from "@/components/domain/OrderBuilder"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { toDateInputIST } from "@/lib/dates"
import { ORDER_STATUS_LABELS } from "@/lib/orders/labels"
import { connectToDatabase } from "@/lib/db"
import { toRupees } from "@/lib/money"
import { Customer } from "@/models/customer"
import { GarmentType } from "@/models/garmentType"
import {
  MeasurementSet,
  type MeasurementSetDocument,
} from "@/models/measurementSet"
import { Order } from "@/models/order"

export const metadata: Metadata = { title: "Edit order · Ancys Design" }

interface LatestSetRow {
  _id: Types.ObjectId
  latest: MeasurementSetDocument & { _id: Types.ObjectId }
}

export default async function EditOrderPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (!isValidObjectId(id)) notFound()

  await connectToDatabase()
  const order = await Order.findOne({ _id: id, isDeleted: false }).lean()
  if (!order) notFound()

  // Anything still live can be edited. A delivered or cancelled order is
  // history, and rewriting it would change what the shop already did.
  if (order.status === "delivered" || order.status === "cancelled") {
    redirect(`/orders/${id}`)
  }

  const [customer, garmentTypes, latestSets] = await Promise.all([
    Customer.findById(order.customerId).select({ name: 1 }).lean(),
    GarmentType.find({ isDeleted: false, isActive: true }).sort({ name: 1 }).lean(),
    MeasurementSet.aggregate<LatestSetRow>([
      { $match: { customerId: order.customerId } },
      { $sort: { takenOn: -1 } },
      { $group: { _id: "$garmentTypeId", latest: { $first: "$$ROOT" } } },
    ]),
  ])

  if (!customer) notFound()

  const existingSets: ExistingMeasurementSet[] = latestSets.map((row) => ({
    id: String(row.latest._id),
    garmentTypeId: String(row._id),
    takenOn: row.latest.takenOn.toISOString(),
    values: row.latest.values,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tabular-nums">
          Edit {order.orderNo}
        </h1>
        <p className="text-sm text-muted-foreground">
          {ORDER_STATUS_LABELS[order.status]} · {customer.name}.{" "}
          <Link
            href={`/orders/${id}`}
            className="underline underline-offset-4"
          >
            Back to the order
          </Link>
        </p>
      </div>

      {order.confirmation.sentAt ? (
        <Alert>
          <AlertDescription>
            {order.confirmation.confirmedAt
              ? "This customer has already confirmed this order. If you change the garments or the price, tell them — and send it again so they see the new bill."
              : "This order has already gone to the customer. Their link updates straight away, so send it again if the bill changes."}
          </AlertDescription>
        </Alert>
      ) : null}

      <OrderBuilder
        orderId={id}
        customerId={String(order.customerId)}
        customerName={customer.name}
        garmentTypes={garmentTypes.map((garmentType) => ({
          id: String(garmentType._id),
          name: garmentType.name,
          baseRate: String(toRupees(garmentType.baseRate)),
          measurementFields: garmentType.measurementFields
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((field) => ({
              key: field.key,
              label: field.label,
              unit: field.unit,
              required: field.required,
              order: field.order,
            })),
        }))}
        existingSets={existingSets}
        initialItems={order.items.map((item) => ({
          itemId: String(item._id),
          garmentTypeId: String(item.garmentTypeId),
          rate: String(toRupees(item.rate)),
          quantity: String(item.quantity),
          workType: item.workType,
          clothLength: item.clothLength ? String(item.clothLength) : "",
          clothSource: item.clothSource,
          note: item.note ?? "",
          dueDate: toDateInputIST(item.dueDate),
          images: item.images.map((image) => ({
            url: image.url,
            publicId: image.publicId,
            kind: image.kind,
          })),
          measurementSetId: item.measurementSetId
            ? String(item.measurementSetId)
            : undefined,
        }))}
        initialDiscount={order.discount > 0 ? String(toRupees(order.discount)) : ""}
        initialAdvancePaid={
          order.advancePaid > 0 ? String(toRupees(order.advancePaid)) : ""
        }
      />

      <Button
        variant="ghost"
        className="h-11"
        nativeButton={false}
        render={<Link href={`/orders/${id}`}>Back to the order</Link>}
      />
    </div>
  )
}
