import { notFound, redirect } from "next/navigation"
import { isValidObjectId } from "mongoose"
import type { Metadata } from "next"

import { GarmentTypeEditor } from "@/components/domain/GarmentTypeEditor"
import { auth } from "@/lib/auth"
import { connectToDatabase } from "@/lib/db"
import { toRupees } from "@/lib/money"
import { GarmentType } from "@/models/garmentType"

export const metadata: Metadata = { title: "Edit garment type · Ancys Design" }

export default async function EditGarmentTypePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  if (session?.user?.role !== "owner") redirect("/settings/garment-types")

  const { id } = await params
  if (!isValidObjectId(id)) notFound()

  await connectToDatabase()
  const garmentType = await GarmentType.findOne({
    _id: id,
    isDeleted: false,
  }).lean()

  if (!garmentType) notFound()

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{garmentType.name}</h1>
        <p className="text-sm text-muted-foreground">
          Editing the rate here does not change any order already taken.
        </p>
      </div>

      <GarmentTypeEditor
        garmentType={{
          id: String(garmentType._id),
          name: garmentType.name,
          baseRate: String(toRupees(garmentType.baseRate)),
          isActive: garmentType.isActive,
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
        }}
      />
    </div>
  )
}
