import Link from "next/link"
import { Paperclip, Plus, ShoppingBag } from "lucide-react"
import type { Metadata } from "next"

import { EmptyState } from "@/components/shell/empty-state"
import { Pagination } from "@/components/shell/pagination"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatDate } from "@/lib/dates"
import { connectToDatabase } from "@/lib/db"
import { formatMoney } from "@/lib/money"
import { paginate, parsePage } from "@/lib/pagination"
import { buildPurchaseFilter } from "@/lib/purchases"
import { Customer } from "@/models/customer"
import { Purchase } from "@/models/purchase"

export const metadata: Metadata = { title: "Purchases · Ancys Design" }

export default async function PurchasesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; from?: string; to?: string; page?: string }>
}) {
  const { q = "", from = "", to = "", page: pageParam } = await searchParams

  await connectToDatabase()
  const filter = await buildPurchaseFilter({ q, from, to })

  const [count, sums] = await Promise.all([
    Purchase.countDocuments(filter),
    Purchase.aggregate<{ _id: null; total: number }>([
      { $match: filter },
      { $group: { _id: null, total: { $sum: "$total" } } },
    ]),
  ])
  const spent = sums[0]?.total ?? 0

  const info = paginate(count, parsePage(pageParam))
  const purchases = await Purchase.find(filter)
    .sort({ purchasedOn: -1, createdAt: -1 })
    .skip(info.skip)
    .limit(info.pageSize)
    .lean()

  const customerIds = purchases
    .map((purchase) => purchase.customerId)
    .filter((id) => id !== undefined)
  const customers = await Customer.find({ _id: { $in: customerIds } })
    .select({ name: 1 })
    .lean()
  const customerName = new Map(
    customers.map((customer) => [String(customer._id), customer.name])
  )

  const filtered = Boolean(q.trim() || from || to)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
          Purchases
        </h1>
        <Button
          className="h-11"
          nativeButton={false}
          render={
            <Link href="/purchases/new">
              <Plus className="size-4" aria-hidden />
              Add purchase
            </Link>
          }
        />
      </div>

      {/* A GET form, so a filtered list is a shareable, reloadable URL. */}
      <form
        action="/purchases"
        className="flex flex-wrap items-end gap-3 rounded-3xl bg-card p-4 tile-float"
      >
        <div className="min-w-48 flex-1 space-y-1.5">
          <label htmlFor="q" className="block text-xs text-muted-foreground">
            Search
          </label>
          <Input
            id="q"
            name="q"
            type="search"
            defaultValue={q}
            placeholder="Item, shop, order no., customer phone"
            className="h-11"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="from" className="block text-xs text-muted-foreground">
            From
          </label>
          <Input id="from" name="from" type="date" defaultValue={from} className="h-11" />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="to" className="block text-xs text-muted-foreground">
            To
          </label>
          <Input id="to" name="to" type="date" defaultValue={to} className="h-11" />
        </div>

        <Button type="submit" variant="outline" className="h-11">
          Filter
        </Button>
        {filtered ? (
          <Button
            variant="ghost"
            className="h-11"
            nativeButton={false}
            render={<Link href="/purchases">Clear</Link>}
          />
        ) : null}
      </form>

      {count > 0 ? (
        <div className="flex items-baseline justify-between rounded-3xl bg-card px-5 py-4 tile-float">
          <span className="text-sm text-muted-foreground">
            {filtered ? "Spent in this selection" : "Spent in total"}
          </span>
          <span className="text-xl font-semibold tabular-nums">
            {formatMoney(spent)}
          </span>
        </div>
      ) : null}

      {purchases.length === 0 ? (
        filtered ? (
          <EmptyState
            icon={ShoppingBag}
            title="No purchases match"
            description="Try a different word or a wider date range, or clear the filters."
            action={
              <Button
                variant="outline"
                className="h-11"
                nativeButton={false}
                render={<Link href="/purchases">Clear filters</Link>}
              />
            }
          />
        ) : (
          <EmptyState
            icon={ShoppingBag}
            title="No purchases recorded yet"
            description="When someone buys thread, lining or anything else for the shop, add it here with the amount and a photo of the bill."
            action={
              <Button
                className="h-11 brand-fill"
                nativeButton={false}
                render={
                  <Link href="/purchases/new">
                    <Plus className="size-4" aria-hidden />
                    Add purchase
                  </Link>
                }
              />
            }
          />
        )
      ) : (
        <ul className="space-y-3">
          {purchases.map((purchase) => {
            const items = purchase.lines.map((line) => line.description).join(", ")
            const customer = purchase.customerId
              ? customerName.get(String(purchase.customerId))
              : undefined
            const tag = [purchase.orderNo, customer].filter(Boolean).join(" · ")
            const meta = [purchase.vendor, purchase.paidBy && `paid by ${purchase.paidBy}`]
              .filter(Boolean)
              .join(" · ")

            return (
              <li key={String(purchase._id)}>
                <Link
                  href={`/purchases/${String(purchase._id)}`}
                  className="flex items-baseline gap-4 rounded-3xl bg-card px-4 py-4 tile-float transition-colors hover:bg-accent/45 sm:px-5"
                >
                  <span className="w-14 shrink-0 text-sm font-semibold tabular-nums text-muted-foreground">
                    {formatDate(purchase.purchasedOn)}
                  </span>
                  <span className="min-w-0 flex-1 space-y-0.5">
                    <span className="block truncate font-semibold">{items}</span>
                    {meta ? (
                      <span className="block truncate text-sm text-muted-foreground">
                        {meta}
                      </span>
                    ) : null}
                    {tag ? (
                      <span className="block truncate text-xs font-semibold text-primary">
                        For {tag}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 text-right">
                    <span className="block font-semibold tabular-nums">
                      {formatMoney(purchase.total)}
                    </span>
                    {purchase.billImages.length > 0 ? (
                      <span className="mt-0.5 flex items-center justify-end gap-1 text-xs text-muted-foreground">
                        <Paperclip className="size-3" aria-hidden />
                        bill
                      </span>
                    ) : null}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      )}

      <Pagination
        info={info}
        noun="purchases"
        hrefForPage={(page) =>
          `/purchases?${new URLSearchParams({
            ...(q.trim() ? { q: q.trim() } : {}),
            ...(from ? { from } : {}),
            ...(to ? { to } : {}),
            ...(page > 1 ? { page: String(page) } : {}),
          })}`
        }
      />
    </div>
  )
}
