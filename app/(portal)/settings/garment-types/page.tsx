import Link from "next/link"
import { Pencil, Plus, Shirt } from "lucide-react"
import type { Metadata } from "next"

import { setGarmentTypeActive } from "./actions"
import { EmptyState } from "@/components/shell/empty-state"
import { Pagination } from "@/components/shell/pagination"
import { StatusPill } from "@/components/domain/StatusPill"
import { INACTIVE_TONE } from "@/lib/orders/labels"
import { Button } from "@/components/ui/button"
import { auth } from "@/lib/auth"
import { connectToDatabase } from "@/lib/db"
import { paginate, parsePage } from "@/lib/pagination"
import { formatMoney } from "@/lib/money"
import { GarmentType } from "@/models/garmentType"

export const metadata: Metadata = { title: "Garment types · Ancys Design" }

export default async function GarmentTypesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { page: pageParam } = await searchParams
  const session = await auth()
  const isOwner = session?.user?.role === "owner"

  await connectToDatabase()
  const info = paginate(
    await GarmentType.countDocuments({ isDeleted: false }),
    parsePage(pageParam)
  )
  const garmentTypes = await GarmentType.find({ isDeleted: false })
    .sort({ name: 1 })
    .skip(info.skip)
    .limit(info.pageSize)
    .lean()

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Garment types</h1>
          <p className="text-sm text-muted-foreground">
            The rate card, and the measurements each garment asks for.
          </p>
        </div>
        {isOwner ? (
          <Button
            className="h-11 brand-fill"
            nativeButton={false}
            render={
              <Link href="/settings/garment-types/new">
                <Plus className="size-4" aria-hidden />
                Add garment type
              </Link>
            }
          />
        ) : null}
      </div>

      {garmentTypes.length === 0 ? (
        <EmptyState
          icon={Shirt}
          title="No garment types yet"
          description={
            isOwner
              ? "Add the garments this shop stitches, each with its base rate and the measurements it needs. Orders and measurement forms are built from this list."
              : "The shop owner sets these up. Ask them to add the garments this shop stitches."
          }
          action={
            isOwner ? (
              <Button
                className="h-11 brand-fill"
                nativeButton={false}
                render={
                  <Link href="/settings/garment-types/new">
                    <Plus className="size-4" aria-hidden />
                    Add garment type
                  </Link>
                }
              />
            ) : undefined
          }
        />
      ) : (
        <ul className="space-y-3">
          {garmentTypes.map((garmentType) => {
            const id = String(garmentType._id)
            return (
              <li
                key={id}
                className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-2xl bg-card p-4 tile-float"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{garmentType.name}</span>
                    {garmentType.isActive ? null : (
                      <StatusPill tone={INACTIVE_TONE}>Inactive</StatusPill>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {formatMoney(garmentType.baseRate)} ·{" "}
                    {garmentType.measurementFields.length === 0
                      ? "no measurements"
                      : `${garmentType.measurementFields.length} measurement${
                          garmentType.measurementFields.length === 1 ? "" : "s"
                        }`}
                  </p>
                </div>

                {isOwner ? (
                  <div className="flex items-center gap-2">
                    <form action={setGarmentTypeActive}>
                      <input type="hidden" name="id" value={id} />
                      <input
                        type="hidden"
                        name="isActive"
                        value={garmentType.isActive ? "false" : "true"}
                      />
                      <Button type="submit" variant="outline" className="h-11">
                        {garmentType.isActive ? "Deactivate" : "Activate"}
                      </Button>
                    </form>
                    <Button
                      variant="outline"
                      className="h-11"
                      nativeButton={false}
                      render={
                        <Link href={`/settings/garment-types/${id}`}>
                          <Pencil className="size-4" aria-hidden />
                          Edit
                        </Link>
                      }
                    />
                  </div>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}

      <Pagination
        info={info}
        noun="garment types"
        hrefForPage={(page) =>
          page > 1
            ? `/settings/garment-types?page=${page}`
            : "/settings/garment-types"
        }
      />
    </div>
  )
}
