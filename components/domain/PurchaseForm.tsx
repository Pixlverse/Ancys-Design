"use client"

import { useActionState, useEffect, useState } from "react"
import Link from "next/link"
import { ClipboardList, Loader2, Plus, Search, Trash2, User, X } from "lucide-react"

import { ImageUploader, type UploadedImage } from "./ImageUploader"
import {
  createPurchase,
  deletePurchase,
  updatePurchase,
  type PurchaseFormState,
} from "@/app/(portal)/purchases/actions"
import type { TagSearchResponse } from "@/app/api/purchases/tags/route"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { formatMoney, toPaise } from "@/lib/money"

/** An order or a customer the purchase is tagged to, for reference only. */
export interface PurchaseTag {
  kind: "order" | "customer"
  id: string
  label: string
  detail: string
}

export interface PurchaseFormLine {
  description: string
  /** Rupees, as typed. */
  amount: string
}

export interface PurchaseFormInitial {
  /** yyyy-MM-dd, an IST day. */
  purchasedOn: string
  lines: PurchaseFormLine[]
  vendor: string
  paidBy: string
  notes: string
  billImages: { url: string; publicId: string }[]
  tag: PurchaseTag | null
}

export interface PurchaseFormProps {
  purchaseId?: string
  initial: PurchaseFormInitial
  /** Set when opened from an order, so saving goes back there. */
  returnTo?: "order"
  cancelHref: string
}

const initialState: PurchaseFormState = {}

interface LineRow extends PurchaseFormLine {
  rowId: string
}

let rowCounter = 0
const nextRowId = () => `line-${rowCounter++}`

const blankLine = (): LineRow => ({ rowId: nextRowId(), description: "", amount: "" })

export function PurchaseForm({
  purchaseId,
  initial,
  returnTo,
  cancelHref,
}: PurchaseFormProps) {
  const [state, formAction, pending] = useActionState(
    purchaseId ? updatePurchase : createPurchase,
    initialState
  )

  const [purchasedOn, setPurchasedOn] = useState(initial.purchasedOn)
  const [lines, setLines] = useState<LineRow[]>(() =>
    initial.lines.length > 0
      ? initial.lines.map((line) => ({ ...line, rowId: nextRowId() }))
      : [blankLine()]
  )
  const [vendor, setVendor] = useState(initial.vendor)
  const [paidBy, setPaidBy] = useState(initial.paidBy)
  const [notes, setNotes] = useState(initial.notes)
  const [billImages, setBillImages] = useState<UploadedImage<"bill">[]>(() =>
    initial.billImages.map((image) => ({ ...image, kind: "bill" as const }))
  )
  const [tag, setTag] = useState<PurchaseTag | null>(initial.tag)

  // The browser's total is only a guide; the server adds the lines up again.
  const total = lines.reduce((sum, line) => sum + safePaise(line.amount), 0)

  const payload = {
    purchasedOn,
    lines: lines.map(({ description, amount }) => ({ description, amount })),
    vendor,
    paidBy,
    notes,
    billImages: billImages.map(({ url, publicId }) => ({ url, publicId })),
    orderId: tag?.kind === "order" ? tag.id : undefined,
    customerId: tag?.kind === "customer" ? tag.id : undefined,
  }

  const errors = state.fieldErrors ?? {}
  const lineErrorKeys = new Set(
    Object.keys(errors).filter((key) => key.startsWith("lines."))
  )
  const otherErrors = Object.entries(errors).filter(
    ([key]) => !lineErrorKeys.has(key)
  )

  function updateLine(rowId: string, patch: Partial<PurchaseFormLine>) {
    setLines((current) =>
      current.map((line) => (line.rowId === rowId ? { ...line, ...patch } : line))
    )
  }

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-6">
        <input type="hidden" name="purchase" value={JSON.stringify(payload)} />
        {purchaseId ? (
          <input type="hidden" name="purchaseId" value={purchaseId} />
        ) : null}
        {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}

        <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">What was bought</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {lines.map((line, index) => {
                  const descriptionError = errors[`lines.${index}.description`]
                  const amountError = errors[`lines.${index}.amount`]
                  return (
                    <div key={line.rowId} className="space-y-1">
                      <div className="flex items-end gap-2">
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <Label
                            htmlFor={`${line.rowId}-description`}
                            className={index > 0 ? "sr-only" : undefined}
                          >
                            Item
                          </Label>
                          <Input
                            id={`${line.rowId}-description`}
                            value={line.description}
                            placeholder="Thread, lining, buttons…"
                            className="h-11"
                            aria-invalid={Boolean(descriptionError)}
                            onChange={(event) =>
                              updateLine(line.rowId, {
                                description: event.target.value,
                              })
                            }
                          />
                        </div>
                        <div className="w-28 space-y-1.5">
                          <Label
                            htmlFor={`${line.rowId}-amount`}
                            className={index > 0 ? "sr-only" : undefined}
                          >
                            Amount (₹)
                          </Label>
                          <Input
                            id={`${line.rowId}-amount`}
                            value={line.amount}
                            inputMode="decimal"
                            placeholder="0"
                            className="h-11 tabular-nums"
                            aria-invalid={Boolean(amountError)}
                            onChange={(event) =>
                              updateLine(line.rowId, { amount: event.target.value })
                            }
                          />
                        </div>
                        {lines.length > 1 ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className="size-11 shrink-0 text-destructive"
                            aria-label={`Remove item ${index + 1}`}
                            onClick={() =>
                              setLines((current) =>
                                current.filter((row) => row.rowId !== line.rowId)
                              )
                            }
                          >
                            <Trash2 className="size-4" aria-hidden />
                          </Button>
                        ) : null}
                      </div>
                      {descriptionError || amountError ? (
                        <p className="text-xs text-destructive">
                          {descriptionError ?? amountError}
                        </p>
                      ) : null}
                    </div>
                  )
                })}

                <Button
                  type="button"
                  variant="outline"
                  className="h-11 w-full"
                  onClick={() => setLines((current) => [...current, blankLine()])}
                >
                  <Plus className="size-4" aria-hidden />
                  Add another item
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Bill photo</CardTitle>
              </CardHeader>
              <CardContent>
                <ImageUploader
                  kind="bill"
                  label="Bill"
                  hint="Optional. A photo of the paper bill, if the shop gave one."
                  images={billImages}
                  onChange={setBillImages}
                  disabled={pending}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">For an order or customer</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  Optional, for reference. It is not added to their bill.
                </p>
                <TagPicker tag={tag} onChange={setTag} disabled={pending} />
              </CardContent>
            </Card>
          </div>

          <Card className="lg:sticky lg:top-20">
            <CardHeader>
              <CardTitle className="text-base">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="purchasedOn">Bought on</Label>
                <Input
                  id="purchasedOn"
                  type="date"
                  value={purchasedOn}
                  className="h-11"
                  onChange={(event) => setPurchasedOn(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="vendor">
                  From <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="vendor"
                  value={vendor}
                  placeholder="Shop name"
                  className="h-11"
                  onChange={(event) => setVendor(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="paidBy">
                  Paid by <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Input
                  id="paidBy"
                  value={paidBy}
                  placeholder="Who went and paid"
                  className="h-11"
                  onChange={(event) => setPaidBy(event.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">
                  Notes <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Textarea
                  id="notes"
                  value={notes}
                  rows={2}
                  onChange={(event) => setNotes(event.target.value)}
                />
              </div>

              <div className="flex items-baseline justify-between border-t pt-3">
                <span className="text-sm font-semibold">Total</span>
                <span className="text-lg font-semibold tabular-nums">
                  {formatMoney(total)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>

        {state.error ? (
          <Alert variant="destructive">
            <AlertDescription>{state.error}</AlertDescription>
          </Alert>
        ) : null}

        {otherErrors.length > 0 ? (
          <Alert variant="destructive">
            <AlertDescription>
              <ul className="space-y-1">
                {otherErrors.map(([key, message]) => (
                  <li key={key}>{message}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <Button type="submit" className="h-11" disabled={pending}>
            {pending ? "Saving…" : purchaseId ? "Save changes" : "Save purchase"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-11"
            nativeButton={false}
            render={<Link href={cancelHref}>Cancel</Link>}
          />
        </div>
      </form>
    </div>
  )
}

/** Owner only — the page decides whether to render it. */
export function DeletePurchaseButton({ purchaseId }: { purchaseId: string }) {
  return (
    <form
      action={deletePurchase}
      onSubmit={(event) => {
        if (!window.confirm("Delete this purchase? It will no longer count in the expenses.")) {
          event.preventDefault()
        }
      }}
    >
      <input type="hidden" name="purchaseId" value={purchaseId} />
      <Button type="submit" variant="outline" className="h-11 text-destructive">
        <Trash2 className="size-4" aria-hidden />
        Delete
      </Button>
    </form>
  )
}

function TagPicker({
  tag,
  onChange,
  disabled,
}: {
  tag: PurchaseTag | null
  onChange: (tag: PurchaseTag | null) => void
  disabled: boolean
}) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<TagSearchResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!open || tag) return
    const controller = new AbortController()
    // Short pause so each keystroke does not fire its own search.
    const timer = setTimeout(async () => {
      setLoading(true)
      setFailed(false)
      try {
        const response = await fetch(
          `/api/purchases/tags?${new URLSearchParams({ q: query.trim() })}`,
          { signal: controller.signal }
        )
        if (!response.ok) throw new Error(String(response.status))
        setResults((await response.json()) as TagSearchResponse)
      } catch (error) {
        if (!controller.signal.aborted) {
          setFailed(true)
          console.error(error)
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, 250)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query, open, tag])

  if (tag) {
    const Icon = tag.kind === "order" ? ClipboardList : User
    return (
      <div className="flex items-center gap-3 rounded-2xl border p-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted">
          <Icon className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{tag.label}</p>
          <p className="truncate text-xs text-muted-foreground">{tag.detail}</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-11"
          aria-label="Remove tag"
          disabled={disabled}
          onClick={() => {
            onChange(null)
            setQuery("")
          }}
        >
          <X className="size-4" aria-hidden />
        </Button>
      </div>
    )
  }

  const hasResults =
    results && (results.orders.length > 0 || results.customers.length > 0)

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          value={query}
          placeholder="Order no., phone or name"
          className="h-11 pl-9"
          disabled={disabled}
          aria-label="Search orders and customers"
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value)
            setOpen(true)
          }}
        />
        {loading ? (
          <Loader2
            className="absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin text-muted-foreground"
            aria-hidden
          />
        ) : null}
      </div>

      {open ? (
        failed ? (
          <p className="text-sm text-destructive">
            Could not search. Check the connection and try again.
          </p>
        ) : results && !hasResults ? (
          <p className="text-sm text-muted-foreground">
            {query.trim() === ""
              ? "No open orders. Type a phone number or name to find a customer."
              : "Nothing matches. Try the order number or the customer's phone."}
          </p>
        ) : results ? (
          <ul className="divide-y rounded-2xl border">
            {query.trim() === "" && results.orders.length > 0 ? (
              <li className="px-3 py-2 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                Open orders
              </li>
            ) : null}
            {results.orders.map((order) => (
              <li key={`o-${order.id}`}>
                <TagOption
                  icon="order"
                  label={`${order.orderNo} · ${order.customerName}`}
                  detail={order.garments || "Order"}
                  onPick={() =>
                    onChange({
                      kind: "order",
                      id: order.id,
                      label: `${order.orderNo} · ${order.customerName}`,
                      detail: order.garments || "Order",
                    })
                  }
                />
              </li>
            ))}
            {results.customers.map((customer) => (
              <li key={`c-${customer.id}`}>
                <TagOption
                  icon="customer"
                  label={customer.name}
                  detail={`${customer.phone} · customer, no particular order`}
                  onPick={() =>
                    onChange({
                      kind: "customer",
                      id: customer.id,
                      label: customer.name,
                      detail: customer.phone,
                    })
                  }
                />
              </li>
            ))}
          </ul>
        ) : null
      ) : null}
    </div>
  )
}

function TagOption({
  icon,
  label,
  detail,
  onPick,
}: {
  icon: "order" | "customer"
  label: string
  detail: string
  onPick: () => void
}) {
  const Icon = icon === "order" ? ClipboardList : User
  return (
    <button
      type="button"
      onClick={onPick}
      className="flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-accent/45"
    >
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{label}</span>
        <span className="block truncate text-xs text-muted-foreground">{detail}</span>
      </span>
    </button>
  )
}

function safePaise(value: string): number {
  if (value.trim() === "") return 0
  try {
    return toPaise(value)
  } catch {
    return 0
  }
}
