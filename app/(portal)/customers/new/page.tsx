import type { Metadata } from "next"

import { CustomerForm } from "@/components/domain/CustomerForm"

export const metadata: Metadata = { title: "New customer · Ancys Design" }

export default async function NewCustomerPage({
  searchParams,
}: {
  searchParams: Promise<{ phone?: string }>
}) {
  // Carried over when staff searched for a number and found nobody.
  const { phone } = await searchParams

  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">New customer</h1>
        <p className="text-sm text-muted-foreground">
          Name and phone are enough to start. The rest can wait.
        </p>
      </div>
      <CustomerForm defaultPhone={phone} />
    </div>
  )
}
