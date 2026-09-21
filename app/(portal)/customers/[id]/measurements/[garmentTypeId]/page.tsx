import Link from "next/link"
import { notFound } from "next/navigation"
import { isValidObjectId } from "mongoose"
import { ArrowUpRight, Plus } from "lucide-react"
import type { Metadata } from "next"

import { StatusPill } from "@/components/domain/StatusPill"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDate } from "@/lib/dates"
import { connectToDatabase } from "@/lib/db"
import { changedKeys, formatMeasurement } from "@/lib/measurements"
import { Customer } from "@/models/customer"
import { GarmentType } from "@/models/garmentType"
import { MeasurementSet } from "@/models/measurementSet"
import { User } from "@/models/user"

export const metadata: Metadata = { title: "Measurement history · Ancys Design" }

export default async function MeasurementHistoryPage({
  params,
}: {
  params: Promise<{ id: string; garmentTypeId: string }>
}) {
  const { id, garmentTypeId } = await params
  if (!isValidObjectId(id) || !isValidObjectId(garmentTypeId)) notFound()

  await connectToDatabase()

  const [customer, garmentType, sets] = await Promise.all([
    Customer.findOne({ _id: id, isDeleted: false }).select({ name: 1 }).lean(),
    GarmentType.findOne({ _id: garmentTypeId, isDeleted: false }).lean(),
    MeasurementSet.find({ customerId: id, garmentTypeId })
      .sort({ takenOn: -1 })
      .populate<{ takenBy: { name: string } | null }>({
        path: "takenBy",
        select: "name",
        model: User,
      })
      .lean(),
  ])

  if (!customer || !garmentType) notFound()

  const fields = garmentType.measurementFields
    .slice()
    .sort((a, b) => a.order - b.order)

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{garmentType.name}</h1>
          <p className="text-sm text-muted-foreground">
            Measurement history for{" "}
            <Link
              href={`/customers/${id}`}
              className="underline underline-offset-4"
            >
              {customer.name}
            </Link>
          </p>
        </div>
        <Button
          className="h-11"
          nativeButton={false}
          render={
            <Link
              href={`/customers/${id}/measurements/new?garmentTypeId=${garmentTypeId}`}
            >
              <Plus className="size-4" aria-hidden />
              Take new
            </Link>
          }
        />
      </div>

      {sets.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
          No measurements taken for this garment yet.
        </p>
      ) : (
        <ol className="space-y-4">
          {sets.map((set, index) => {
            // Sets are newest first, so the previous set is the next one along.
            const previous = sets[index + 1]
            const changed = changedKeys(set.values, previous?.values)

            return (
              <li key={String(set._id)}>
                <Card>
                  <CardHeader>
                    <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                      {formatDate(set.takenOn, { withYear: true })}
                      {index === 0 ? (
                        <StatusPill tone="bg-emerald-100 text-emerald-800 ring-emerald-200">
                          Latest
                        </StatusPill>
                      ) : null}
                      {changed.size > 0 ? (
                        <StatusPill tone="bg-amber-100 text-amber-800 ring-amber-200">
                          {changed.size} changed
                        </StatusPill>
                      ) : null}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Taken by {set.takenBy?.name ?? "a staff member"}
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
                      {fields.map((field) => {
                        const value = set.values[field.key]
                        if (value === undefined) return null
                        const didChange = changed.has(field.key)
                        const before = previous?.values[field.key]

                        return (
                          <div key={field.key}>
                            <dt className="text-xs text-muted-foreground">
                              {field.label}
                            </dt>
                            <dd
                              className={
                                didChange
                                  ? "font-medium tabular-nums text-foreground"
                                  : "tabular-nums text-muted-foreground"
                              }
                            >
                              {formatMeasurement(value, field.unit)}
                              {didChange && before !== undefined ? (
                                <span className="ml-1.5 text-xs font-normal text-muted-foreground">
                                  <ArrowUpRight
                                    className={`inline size-3 ${
                                      value < before ? "rotate-90" : ""
                                    }`}
                                    aria-hidden
                                  />
                                  from {formatMeasurement(before, field.unit)}
                                </span>
                              ) : null}
                            </dd>
                          </div>
                        )
                      })}
                    </dl>

                    {set.notes ? (
                      <p className="whitespace-pre-line border-t pt-3 text-sm text-muted-foreground">
                        {set.notes}
                      </p>
                    ) : null}
                  </CardContent>
                </Card>
              </li>
            )
          })}
        </ol>
      )}
    </div>
  )
}
