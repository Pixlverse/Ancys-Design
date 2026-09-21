import { notFound } from "next/navigation"
import type { Metadata } from "next"

import { ConfirmPanel } from "./ConfirmPanel"
import { OrderItemImages } from "@/components/domain/OrderItemImages"
import { formatDate } from "@/lib/dates"
import { connectToDatabase } from "@/lib/db"
import { formatMoney } from "@/lib/money"
import { formatPhone } from "@/lib/phone"
import { isPublicToken } from "@/lib/orders/token"
import { readShopIdentity } from "@/lib/shop"
import { Customer } from "@/models/customer"
import { Order } from "@/models/order"

/**
 * The public order page: no login, reachable only with the 32-character token.
 * The order id never appears in the URL (CLAUDE.md section 7).
 *
 * Built for a phone held in one hand in a shop doorway — one column, large type,
 * photos big enough to actually check the cloth against.
 */
export const metadata: Metadata = {
  title: "Your order",
  // Nobody should index a page carrying a customer's order and phone number.
  robots: { index: false, follow: false },
}

export default async function PublicOrderPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  if (!isPublicToken(token)) notFound()

  await connectToDatabase()
  const order = await Order.findOne({
    "confirmation.publicToken": token,
    isDeleted: false,
  }).lean()

  if (!order) notFound()

  const customer = await Customer.findById(order.customerId)
    .select({ name: 1 })
    .lean()

  const shop = readShopIdentity()
  const confirmed = Boolean(order.confirmation.confirmedAt)

  // Record that they opened it, so the shop knows the link arrived. Not awaited
  // as a gate on rendering: a failed write must not cost the customer the page.
  void Order.updateOne(
    { _id: order._id, "confirmation.viewedAt": { $exists: false } },
    { $set: { "confirmation.viewedAt": new Date() } }
  ).catch(() => undefined)

  return (
    <main className="mx-auto min-h-svh w-full max-w-xl space-y-5 bg-background px-4 py-8">
      <header className="rounded-3xl px-6 py-8 text-center brand-fill tile-float">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">{shop.name}</h1>
        {shop.phone ? (
          <p className="text-sm opacity-90">{formatPhone(shop.phone)}</p>
        ) : null}
      </header>

      <section className="rounded-3xl bg-card p-5 tile-float">
        <p className="text-sm text-muted-foreground">Order</p>
        <p className="text-xl font-semibold tabular-nums">{order.orderNo}</p>
        <p className="mt-1">{customer?.name ?? "Your order"}</p>
      </section>

      <section className="space-y-4">
        {order.items.map((item) => (
          <article
            key={String(item._id)}
            className="space-y-3 rounded-3xl bg-card p-5 tile-float"
          >
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-medium">
                {item.garmentTypeName}
                {item.quantity > 1 ? ` × ${item.quantity}` : ""}
              </h2>
              <p className="tabular-nums">
                {formatMoney(item.rate * item.quantity)}
              </p>
            </div>

            <p className="text-sm text-muted-foreground">
              Ready by {formatDate(item.dueDate, { withYear: true })}
            </p>

            <OrderItemImages images={item.images} />

            {item.note ? (
              <p className="whitespace-pre-line rounded-md bg-muted/60 p-3 text-sm">
                {item.note}
              </p>
            ) : null}
          </article>
        ))}
      </section>

      <section className="rounded-3xl bg-card p-5 tile-float">
        <h2 className="mb-3 font-medium">Bill</h2>
        <dl className="space-y-2 text-sm">
          <Row label="Subtotal" value={formatMoney(order.subtotal)} />
          {order.discount > 0 ? (
            <Row label="Discount" value={`− ${formatMoney(order.discount)}`} />
          ) : null}
          <Row label="Total" value={formatMoney(order.total)} strong />
          {order.advancePaid > 0 ? (
            <Row
              label="Advance paid"
              value={`− ${formatMoney(order.advancePaid)}`}
            />
          ) : null}
          <Row
            label={order.balance < 0 ? "To refund" : "Balance"}
            value={formatMoney(Math.abs(order.balance))}
            strong
          />
        </dl>
      </section>

      <ConfirmPanel
        token={token}
        alreadyConfirmed={confirmed}
        shopPhone={shop.phone}
      />

      <footer className="pb-8 text-center text-xs text-muted-foreground">
        {shop.address ? <p>{shop.address}</p> : null}
        <p>This page is private to you. Please do not share the link.</p>
      </footer>
    </main>
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
