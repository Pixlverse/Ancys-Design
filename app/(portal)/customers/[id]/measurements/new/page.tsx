import Link from "next/link"
import { notFound } from "next/navigation"
import { isValidObjectId } from "mongoose"
import { ChevronRight, Shirt } from "lucide-react"
import type { Metadata } from "next"

import { EmptyState } from "@/components/shell/empty-state"
import { TakeMeasurementsForm } from "@/components/domain/TakeMeasurementsForm"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { formatDate } from "@/lib/dates"
import { connectToDatabase } from "@/lib/db"
import { Customer } from "@/models/customer"
import { GarmentType } from "@/models/garmentType"
import { MeasurementSet } from "@/models/measurementSet"

export const metadata: Metadata = { title: "Take measurements · Ancys Design" }

export default async function TakeMeasurementsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ garmentTypeId?: string }>
}) {
  const { id } = await params
  const { garmentTypeId } = await searchParams
  if (!isValidObjectId(id)) notFound()

  await connectToDatabase()
  const customer = await Customer.findOne({ _id: id, isDeleted: false })
    .select({ name: 1 })
    .lean()
  if (!customer) notFound()

  // Step one: which garment are we measuring for?
  if (!garmentTypeId || !isValidObjectId(garmentTypeId)) {
    const garmentTypes = await GarmentType.find({
      isDeleted: false,
      isActive: true,
    })
      .select({ name: 1, measurementFields: 1 })
      .sort({ name: 1 })
      .lean()

    return (
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Take measurements</h1>
          <p className="text-sm text-muted-foreground">
            For {customer.name}. Which garment?
          </p>
        </div>

        {garmentTypes.length === 0 ? (
          <EmptyState
            icon={Shirt}
            title="No garment types are active"
            description="Measurements are defined per garment. Add or activate one in Settings → Garment types first."
            action={
              <Button
                className="h-11 brand-fill"
                nativeButton={false}
                render={<Link href="/settings/garment-types">Open garment types</Link>}
              />
            }
          />
        ) : (
          <ul className="space-y-3">
            {garmentTypes.map((garmentType) => (
              <li key={String(garmentType._id)}>
                <Link
                  href={`/customers/${id}/measurements/new?garmentTypeId=${String(garmentType._id)}`}
                >
                  <Card className="transition-colors hover:bg-accent/40">
                    <CardContent className="flex min-h-16 items-center gap-4">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{garmentType.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {garmentType.measurementFields.length} measurement
                          {garmentType.measurementFields.length === 1 ? "" : "s"}
                        </p>
                      </div>
                      <ChevronRight
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden
                      />
                    </CardContent>
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}

        <Button
          variant="ghost"
          className="h-11"
          nativeButton={false}
          render={<Link href={`/customers/${id}`}>Back to {customer.name}</Link>}
        />
      </div>
    )
  }

  // Step two: the form itself, prefilled from the last set if there is one.
  const garmentType = await GarmentType.findOne({
    _id: garmentTypeId,
    isDeleted: false,
  }).lean()
  if (!garmentType) notFound()

  const latest = await MeasurementSet.findOne({
    customerId: id,
    garmentTypeId,
  })
    .sort({ takenOn: -1 })
    .lean()

  const fields = garmentType.measurementFields
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((field) => ({
      key: field.key,
      label: field.label,
      unit: field.unit,
      required: field.required,
      order: field.order,
    }))

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{garmentType.name}</h1>
        <p className="text-sm text-muted-foreground">
          Measurements for {customer.name}.
        </p>
      </div>

      {latest ? (
        <p className="rounded-2xl bg-accent/60 px-4 py-3 text-sm">
          Prefilled from the set taken{" "}
          <strong>{formatDate(latest.takenOn)}</strong>. Saving creates a new
          set — the old one is kept.
        </p>
      ) : null}

      <TakeMeasurementsForm
        customerId={id}
        garmentTypeId={garmentTypeId}
        fields={fields}
        defaultValues={latest?.values}
      />
    </div>
  )
}
