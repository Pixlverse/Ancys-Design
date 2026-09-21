import { redirect } from "next/navigation"
import type { Metadata } from "next"

import { GarmentTypeEditor } from "@/components/domain/GarmentTypeEditor"
import { auth } from "@/lib/auth"

export const metadata: Metadata = { title: "New garment type · Ancys Design" }

export default async function NewGarmentTypePage() {
  const session = await auth()
  if (session?.user?.role !== "owner") redirect("/settings/garment-types")

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">New garment type</h1>
        <p className="text-sm text-muted-foreground">
          Its base rate and the measurements staff will be asked for.
        </p>
      </div>
      <GarmentTypeEditor />
    </div>
  )
}
