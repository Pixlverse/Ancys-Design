import Link from "next/link"
import { Paperclip, Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatDate } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import type { PurchaseDocument } from "@/models/purchase"

export type TaggedPurchase = Pick<
  PurchaseDocument,
  "purchasedOn" | "lines" | "total" | "vendor" | "billImages" | "orderNo"
> & { _id: unknown }

/**
 * What the shop bought for this order or customer. For reference only — these
 * are shop expenses and are never part of the customer's bill.
 */
export function TaggedPurchasesCard({
  purchases,
  addHref,
  emptyText,
  showOrderNo = false,
}: {
  purchases: TaggedPurchase[]
  /** Absent when the viewer cannot add purchases. */
  addHref?: string
  emptyText: string
  showOrderNo?: boolean
}) {
  const spent = purchases.reduce((sum, purchase) => sum + purchase.total, 0)

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <CardTitle className="text-base">Purchases</CardTitle>
        {addHref ? (
          <Button
            variant="outline"
            className="h-11"
            nativeButton={false}
            render={
              <Link href={addHref}>
                <Plus className="size-4" aria-hidden />
                Add purchase
              </Link>
            }
          />
        ) : null}
      </CardHeader>
      <CardContent className="space-y-2">
        {purchases.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <>
            <ul className="space-y-2">
              {purchases.map((purchase) => (
                <li key={String(purchase._id)}>
                  <Link
                    href={`/purchases/${String(purchase._id)}`}
                    className="flex items-start gap-3 rounded-2xl bg-muted/50 px-3 py-2.5 text-sm transition-colors hover:bg-accent"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {purchase.lines.map((line) => line.description).join(", ")}
                      </span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {[
                          formatDate(purchase.purchasedOn),
                          purchase.vendor,
                          showOrderNo ? purchase.orderNo : undefined,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block font-medium tabular-nums">
                        {formatMoney(purchase.total)}
                      </span>
                      {purchase.billImages.length > 0 ? (
                        <Paperclip
                          className="ml-auto size-3 text-muted-foreground"
                          aria-label="Bill attached"
                        />
                      ) : null}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <div className="flex justify-between gap-3 border-t pt-2 text-sm">
              <span className="text-muted-foreground">Spent by the shop</span>
              <span className="font-semibold tabular-nums">{formatMoney(spent)}</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Shop expenses, not part of the customer&apos;s bill.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  )
}
