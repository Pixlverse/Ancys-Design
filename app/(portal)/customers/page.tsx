import Link from "next/link"
import { ChevronRight, Plus, Search, UserPlus, Users } from "lucide-react"
import type { Metadata } from "next"

import { Initials } from "@/components/domain/Initials"
import { EmptyState } from "@/components/shell/empty-state"
import { Pagination } from "@/components/shell/pagination"
import { CustomerStatusPill } from "@/components/domain/StatusPill"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { buildCustomerSearch, customerRankStages } from "@/lib/customers"
import { connectToDatabase } from "@/lib/db"
import {
  CUSTOMER_PAGE_SIZE,
  paginate,
  parsePage,
} from "@/lib/pagination"
import { formatPhone } from "@/lib/phone"
import { Customer } from "@/models/customer"

export const metadata: Metadata = { title: "Customers · Ancys Design" }

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>
}) {
  const { q = "", page: pageParam } = await searchParams
  const { filter, phoneDigits } = buildCustomerSearch(q)

  await connectToDatabase()
  const info = paginate(
    await Customer.countDocuments(filter),
    parsePage(pageParam),
    CUSTOMER_PAGE_SIZE
  )

  // Ranked in the database: sorting a single page in JavaScript would rank
  // within that page, so a phone match on page two would lose to a name match
  // on page one.
  const customers = await Customer.aggregate<{
    _id: unknown
    name: string
    phone: string
    status: string
  }>([
    { $match: filter },
    ...customerRankStages(phoneDigits),
    { $skip: info.skip },
    { $limit: info.pageSize },
    { $project: { name: 1, phone: 1, status: 1 } },
  ])

  const searching = q.trim() !== ""

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Customers</h1>
        <Button
          className="h-11"
          nativeButton={false}
          render={
            <Link href="/customers/new">
              <Plus className="size-4" aria-hidden />
              Add customer
            </Link>
          }
        />
      </div>

      {/* A GET form, so search survives a reload and works without JS. */}
      <form action="/customers" className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          name="q"
          defaultValue={q}
          type="search"
          inputMode="tel"
          placeholder="Search by phone or name"
          aria-label="Search customers by phone or name"
          className="h-13 rounded-full bg-card pr-28 pl-11 tile-float"
        />
        <Button
          type="submit"
          className="absolute top-1/2 right-1.5 h-10 -translate-y-1/2 brand-fill"
        >
          Search
        </Button>
      </form>

      {customers.length === 0 ? (
        searching ? (
          <EmptyState
            icon={Search}
            title={`Nobody matches "${q.trim()}"`}
            description="Try fewer digits, or the other way round — search works on any part of a phone number, and on any part of a name."
            action={
              <Button
                className="h-11 brand-fill"
                nativeButton={false}
                render={
                  <Link href={`/customers/new?phone=${encodeURIComponent(q.trim())}`}>
                    <UserPlus className="size-4" aria-hidden />
                    Add them as a customer
                  </Link>
                }
              />
            }
          />
        ) : (
          <EmptyState
            icon={Users}
            title="No customers yet"
            description="Add a customer with their phone number, then record measurements and take their first order."
            action={
              <Button
                className="h-11 brand-fill"
                nativeButton={false}
                render={
                  <Link href="/customers/new">
                    <Plus className="size-4" aria-hidden />
                    Add customer
                  </Link>
                }
              />
            }
          />
        )
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {customers.map((customer) => (
            <li key={String(customer._id)}>
              <Link
                href={`/customers/${String(customer._id)}`}
                className="flex h-full items-center gap-3.5 rounded-3xl bg-card p-4 transition-transform tile-float hover:-translate-y-0.5"
              >
                <Initials name={customer.name} className="size-12 shrink-0" />

                {/* The name gets the full width of the row. The pill used to sit
                    beside it, which squeezed the column until names read "Ad…"
                    and the phone number wrapped over three lines. */}
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">
                    {customer.name}
                  </span>
                  <span className="mt-0.5 flex items-center gap-2">
                    <span className="truncate text-sm text-muted-foreground tabular-nums">
                      {formatPhone(customer.phone)}
                    </span>
                    <CustomerStatusPill status={customer.status} />
                  </span>
                </span>

                <ChevronRight
                  className="size-4 shrink-0 text-muted-foreground/60"
                  aria-hidden
                />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <Pagination
        info={info}
        noun="customers"
        hrefForPage={(page) =>
          `/customers?${new URLSearchParams({
            ...(q.trim() ? { q: q.trim() } : {}),
            ...(page > 1 ? { page: String(page) } : {}),
          })}`
        }
      />
    </div>
  )
}
