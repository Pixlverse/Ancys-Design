import Link from "next/link"
import { Types, isValidObjectId } from "mongoose"
import { ChevronRight, Search, Shirt, UserPlus } from "lucide-react"
import type { Metadata } from "next"

import { CustomerForm } from "@/components/domain/CustomerForm"
import {
  OrderBuilder,
  type ExistingMeasurementSet,
} from "@/components/domain/OrderBuilder"
import { EmptyState } from "@/components/shell/empty-state"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { buildCustomerSearch, comparePhoneFirst } from "@/lib/customers"
import { connectToDatabase } from "@/lib/db"
import { toRupees } from "@/lib/money"
import { formatPhone } from "@/lib/phone"
import { Customer } from "@/models/customer"
import { GarmentType } from "@/models/garmentType"
import {
  MeasurementSet,
  type MeasurementSetDocument,
} from "@/models/measurementSet"

export const metadata: Metadata = { title: "New order · Ancys Design" }

interface LatestSetRow {
  _id: Types.ObjectId
  latest: MeasurementSetDocument & { _id: Types.ObjectId }
}

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string; q?: string }>
}) {
  const { customerId, q = "" } = await searchParams
  await connectToDatabase()

  // Step one: whose order is this?
  if (!customerId || !isValidObjectId(customerId)) {
    return <PickCustomer query={q} />
  }

  const customer = await Customer.findOne({
    _id: customerId,
    isDeleted: false,
  })
    .select({ name: 1, phone: 1 })
    .lean()

  if (!customer) return <PickCustomer query={q} />

  const [garmentTypes, latestSets] = await Promise.all([
    GarmentType.find({ isDeleted: false, isActive: true })
      .sort({ name: 1 })
      .lean(),
    // The customer's latest set per garment type, so each item can offer reuse.
    MeasurementSet.aggregate<LatestSetRow>([
      { $match: { customerId: new Types.ObjectId(customerId) } },
      { $sort: { takenOn: -1 } },
      { $group: { _id: "$garmentTypeId", latest: { $first: "$$ROOT" } } },
    ]),
  ])

  if (garmentTypes.length === 0) {
    return (
      <div className="max-w-2xl space-y-6">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">New order</h1>
        <EmptyState
          icon={Shirt}
          title="No garment types are active"
          description="An order is made of garments, and each one carries its rate and measurements. Add or activate one first."
          action={
            <Button
              className="h-11"
              nativeButton={false}
              render={<Link href="/settings/garment-types">Open garment types</Link>}
            />
          }
        />
      </div>
    )
  }

  const existingSets: ExistingMeasurementSet[] = latestSets.map((row) => ({
    id: String(row.latest._id),
    garmentTypeId: String(row._id),
    takenOn: row.latest.takenOn.toISOString(),
    values: row.latest.values,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">New order</h1>
        <p className="text-sm text-muted-foreground">
          For{" "}
          <Link
            href={`/customers/${customerId}`}
            className="underline underline-offset-4"
          >
            {customer.name}
          </Link>{" "}
          · {formatPhone(customer.phone)} ·{" "}
          <Link href="/orders/new" className="underline underline-offset-4">
            change
          </Link>
        </p>
      </div>

      <OrderBuilder
        customerId={customerId}
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
      />
    </div>
  )
}

/** Phone-first search, same ranking as the customers list. */
async function PickCustomer({ query }: { query: string }) {
  const { filter, phoneDigits } = buildCustomerSearch(query)
  const customers = await Customer.find(filter)
    .select({ name: 1, phone: 1 })
    .limit(20)
    .lean()
  customers.sort((a, b) => comparePhoneFirst(a, b, phoneDigits))

  const searching = query.trim() !== ""

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">New order</h1>
        <p className="text-sm text-muted-foreground">Whose order is this?</p>
      </div>

      <form className="flex gap-2" action="/orders/new">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            name="q"
            defaultValue={query}
            type="search"
            inputMode="tel"
            placeholder="Phone or name"
            aria-label="Search customers by phone or name"
            className="h-11 pl-9"
          />
        </div>
        <Button type="submit" variant="outline" className="h-11">
          Search
        </Button>
      </form>

      {customers.length > 0 ? (
        <ul className="divide-y divide-border/60 overflow-hidden rounded-3xl bg-card tile-float">
          {customers.map((customer) => (
            <li key={String(customer._id)}>
              <Link
                href={`/orders/new?customerId=${String(customer._id)}`}
                className="flex min-h-16 items-center gap-4 px-4 py-3 transition-colors hover:bg-accent/40"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{customer.name}</p>
                  <p className="text-sm text-muted-foreground tabular-nums">
                    {formatPhone(customer.phone)}
                  </p>
                </div>
                <ChevronRight
                  className="size-4 shrink-0 text-muted-foreground"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      ) : searching ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
          Nobody matches &ldquo;{query.trim()}&rdquo;. Add them below and carry on
          with the order.
        </p>
      ) : null}

      <Card>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <UserPlus className="size-4 text-muted-foreground" aria-hidden />
            <h2 className="font-medium">New customer</h2>
          </div>
          <CustomerForm
            returnTo="order"
            defaultPhone={searching ? query.trim() : undefined}
            submitLabel="Save and start the order"
            cancelHref="/orders"
          />
        </CardContent>
      </Card>
    </div>
  )
}
