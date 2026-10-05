import { notFound, redirect } from "next/navigation"
import { isValidObjectId } from "mongoose"
import type { Metadata } from "next"

import {
  DeletePurchaseButton,
  PurchaseForm,
} from "@/components/domain/PurchaseForm"
import { auth } from "@/lib/auth"
import { formatDate, toDateInputIST } from "@/lib/dates"
import { connectToDatabase } from "@/lib/db"
import { toRupees } from "@/lib/money"
import { loadPurchaseTag } from "@/lib/purchases"
import { Purchase } from "@/models/purchase"
import { User } from "@/models/user"

export const metadata: Metadata = { title: "Purchase · Ancys Design" }

export default async function PurchasePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const session = await auth()
  const role = session?.user?.role
  if (role !== "owner" && role !== "staff") redirect("/purchases")

  const { id } = await params
  if (!isValidObjectId(id)) notFound()

  await connectToDatabase()
  const purchase = await Purchase.findOne({ _id: id, isDeleted: false }).lean()
  if (!purchase) notFound()

  const [tag, author] = await Promise.all([
    loadPurchaseTag(purchase.orderId, purchase.customerId),
    User.findById(purchase.createdBy).select({ name: 1 }).lean(),
  ])

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            Purchase
          </h1>
          <p className="text-sm text-muted-foreground">
            Added {formatDate(purchase.createdAt)}
            {author ? ` by ${author.name}` : ""}
          </p>
        </div>
        {role === "owner" ? <DeletePurchaseButton purchaseId={id} /> : null}
      </div>

      <PurchaseForm
        purchaseId={id}
        initial={{
          purchasedOn: toDateInputIST(purchase.purchasedOn),
          lines: purchase.lines.map((line) => ({
            description: line.description,
            amount: String(toRupees(line.amount)),
          })),
          vendor: purchase.vendor ?? "",
          paidBy: purchase.paidBy ?? "",
          notes: purchase.notes ?? "",
          billImages: purchase.billImages.map(({ url, publicId }) => ({
            url,
            publicId,
          })),
          tag,
        }}
        cancelHref="/purchases"
      />
    </div>
  )
}
