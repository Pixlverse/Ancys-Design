import { redirect } from "next/navigation"
import { isValidObjectId } from "mongoose"
import type { Metadata } from "next"

import { PurchaseForm } from "@/components/domain/PurchaseForm"
import { auth } from "@/lib/auth"
import { toDateInputIST } from "@/lib/dates"
import { connectToDatabase } from "@/lib/db"
import { loadPurchaseTag } from "@/lib/purchases"

export const metadata: Metadata = { title: "Add purchase · Ancys Design" }

export default async function NewPurchasePage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string; customerId?: string }>
}) {
  const session = await auth()
  if (session?.user?.role !== "owner" && session?.user?.role !== "staff") {
    redirect("/purchases")
  }

  const { orderId, customerId } = await searchParams

  // Opened from an order or customer page: start with that tag in place.
  await connectToDatabase()
  const tag = await loadPurchaseTag(
    orderId && isValidObjectId(orderId) ? orderId : undefined,
    customerId && isValidObjectId(customerId) ? customerId : undefined
  )
  const fromOrder = tag?.kind === "order"

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Add purchase
        </h1>
        <p className="text-sm text-muted-foreground">
          Something bought for the shop. It is an expense, not part of any bill.
        </p>
      </div>

      <PurchaseForm
        initial={{
          purchasedOn: toDateInputIST(new Date()),
          lines: [],
          vendor: "",
          paidBy: "",
          notes: "",
          billImages: [],
          tag,
        }}
        returnTo={fromOrder ? "order" : undefined}
        cancelHref={
          fromOrder
            ? `/orders/${tag.id}`
            : tag?.kind === "customer"
              ? `/customers/${tag.id}`
              : "/purchases"
        }
      />
    </div>
  )
}
