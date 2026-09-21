"use client"

import { useActionState, useMemo, useState } from "react"
import Link from "next/link"
import { Plus, Trash2 } from "lucide-react"

import { ImageUploader, type UploadedImage } from "./ImageUploader"
import { MeasurementForm } from "./MeasurementForm"
import {
  createOrder,
  updateOrder,
  type OrderFormState,
} from "@/app/(portal)/orders/actions"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { StatusPill } from "./StatusPill"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { formatDate } from "@/lib/dates"
import { formatMoney, toPaise } from "@/lib/money"
import { calculateTotals } from "@/lib/orders/totals"
import {
  CLOTH_SOURCES,
  type ClothSource,
  type WorkType,
} from "@/schemas/order"
import type { MeasurementFieldInput } from "@/schemas/garmentType"
import type { MeasurementValues } from "@/schemas/measurementSet"

export interface GarmentTypeOption {
  id: string
  name: string
  /** Rupees, as a string, ready to drop into the rate input. */
  baseRate: string
  measurementFields: MeasurementFieldInput[]
}

export interface ExistingMeasurementSet {
  id: string
  garmentTypeId: string
  takenOn: string
  values: MeasurementValues
}

/** An item as it already exists on an order being edited. */
export interface OrderBuilderInitialItem {
  itemId: string
  garmentTypeId: string
  rate: string
  quantity: string
  workType: WorkType
  clothLength: string
  clothSource?: ClothSource
  note: string
  dueDate: string
  images: UploadedImage[]
  measurementSetId?: string
}

export interface OrderBuilderProps {
  customerId: string
  customerName: string
  garmentTypes: GarmentTypeOption[]
  /** The customer's latest set per garment type, for reuse. */
  existingSets: ExistingMeasurementSet[]
  /** Present when editing a draft rather than writing a new order. */
  orderId?: string
  initialItems?: OrderBuilderInitialItem[]
  initialDiscount?: string
  initialAdvancePaid?: string
}

type MeasurementChoice = "existing" | "new"

interface BuilderItem {
  rowId: string
  garmentTypeId: string
  rate: string
  quantity: string
  workType: WorkType
  clothLength: string
  clothSource?: ClothSource
  note: string
  dueDate: string
  measurementChoice: MeasurementChoice
  newMeasurements: MeasurementValues
  images: UploadedImage[]
  /** The set this item already points at, when editing. */
  measurementSetId?: string
  /** The garment this row already is, when editing. */
  itemId?: string
}

const initialState: OrderFormState = {}

const CLOTH_SOURCE_LABELS: Record<ClothSource, string> = {
  customer: "Customer brought cloth",
  shop: "Shop provides cloth",
}

const WORK_TYPE_TABS = [
  {
    value: "stitching" as const,
    label: "Stitching",
    hint: "Measured, cut and sewn here",
  },
  {
    value: "design_only" as const,
    label: "Design only",
    hint: "We design it, someone else stitches",
  },
]

const IMAGE_KINDS = [
  {
    kind: "cloth" as const,
    label: "Cloth",
    hint: "The material the customer brought.",
  },
  {
    kind: "reference" as const,
    label: "Reference",
    hint: "What they want it to look like.",
  },
  {
    kind: "pattern" as const,
    label: "Pattern",
    hint: "Any pattern or drawing to work from.",
  },
]

export function OrderBuilder({
  customerId,
  customerName,
  garmentTypes,
  existingSets,
  orderId,
  initialItems,
  initialDiscount,
  initialAdvancePaid,
}: OrderBuilderProps) {
  const [state, formAction, pending] = useActionState(
    orderId ? updateOrder : createOrder,
    initialState
  )

  const [items, setItems] = useState<BuilderItem[]>(() =>
    initialItems && initialItems.length > 0
      ? initialItems.map((item, index) => ({
          ...item,
          rowId: `existing-${index}`,
          measurementChoice: item.measurementSetId
            ? ("existing" as const)
            : ("new" as const),
          newMeasurements: {},
        }))
      : [blankItem(0)]
  )
  const [discount, setDiscount] = useState(initialDiscount ?? "")
  const [advancePaid, setAdvancePaid] = useState(initialAdvancePaid ?? "")

  const garmentTypeById = useMemo(
    () => new Map(garmentTypes.map((garmentType) => [garmentType.id, garmentType])),
    [garmentTypes]
  )
  const latestSetFor = useMemo(
    () => new Map(existingSets.map((set) => [set.garmentTypeId, set])),
    [existingSets]
  )

  function updateItem(rowId: string, patch: Partial<BuilderItem>) {
    setItems((current) =>
      current.map((item) => (item.rowId === rowId ? { ...item, ...patch } : item))
    )
  }

  function chooseGarmentType(rowId: string, garmentTypeId: string) {
    const garmentType = garmentTypeById.get(garmentTypeId)
    updateItem(rowId, {
      garmentTypeId,
      // The rate card fills it in; staff can still overrule it for this order.
      rate: garmentType?.baseRate ?? "",
      measurementChoice: latestSetFor.has(garmentTypeId) ? "existing" : "new",
      newMeasurements: {},
      measurementSetId: undefined,
    })
  }

  // The live bill. Anything not yet a valid amount simply does not count yet.
  const totals = useMemo(() => {
    const billable = items.map((item) => ({
      rate: safePaise(item.rate),
      quantity: Math.max(1, Number(item.quantity) || 1),
    }))
    try {
      return calculateTotals(billable, safePaise(discount), safePaise(advancePaid))
    } catch {
      return calculateTotals([], 0, 0)
    }
  }, [items, discount, advancePaid])

  const payload = {
    customerId,
    discount: discount.trim() === "" ? "0" : discount,
    advancePaid: advancePaid.trim() === "" ? "0" : advancePaid,
    items: items.map((item) => {
      // An item being edited keeps its own set; a new one offers the latest.
      const reusableSetId =
        item.measurementSetId ?? latestSetFor.get(item.garmentTypeId)?.id
      const useExisting =
        item.workType === "stitching" &&
        item.measurementChoice === "existing" &&
        reusableSetId
      return {
        ...(item.itemId ? { itemId: item.itemId } : {}),
        garmentTypeId: item.garmentTypeId,
        rate: item.rate,
        quantity: Number(item.quantity) || 1,
        workType: item.workType,
        ...(item.workType === "stitching"
          ? {
              clothSource: item.clothSource ?? "customer",
              clothLength: item.clothLength,
            }
          : {}),
        note: item.note,
        dueDate: item.dueDate,
        images: item.images,
        ...(useExisting
          ? { measurementSetId: reusableSetId }
          : item.workType === "stitching" &&
              Object.keys(item.newMeasurements).length > 0
            ? { newMeasurements: item.newMeasurements }
            : {}),
      }
    }),
  }

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="order" value={JSON.stringify(payload)} />
      {orderId ? <input type="hidden" name="orderId" value={orderId} /> : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem] lg:items-start">
        <div className="space-y-4">
          {items.map((item, index) => {
            const garmentType = garmentTypeById.get(item.garmentTypeId)
            const existing = latestSetFor.get(item.garmentTypeId)

            return (
              <Card key={item.rowId}>
                <CardHeader className="flex flex-row items-center justify-between gap-3">
                  <CardTitle className="text-base">
                    Garment {index + 1}
                    {garmentType ? ` — ${garmentType.name}` : ""}
                  </CardTitle>
                  {items.length > 1 ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-11 text-destructive"
                      aria-label={`Remove garment ${index + 1}`}
                      onClick={() =>
                        setItems((current) =>
                          current.filter((row) => row.rowId !== item.rowId)
                        )
                      }
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  ) : null}
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* What kind of job this is. Design-only work asks for a
                      reference and notes, and nothing else — there is no cloth
                      and nothing to measure. */}
                  <div
                    role="tablist"
                    aria-label="What kind of work"
                    className="flex gap-1 rounded-2xl bg-muted p-1"
                  >
                    {WORK_TYPE_TABS.map(({ value, label, hint }) => (
                      <button
                        key={value}
                        type="button"
                        role="tab"
                        aria-selected={item.workType === value}
                        onClick={() =>
                          updateItem(item.rowId, {
                            workType: value,
                            ...(value === "design_only"
                              ? { clothSource: undefined, clothLength: "" }
                              : { clothSource: item.clothSource ?? "customer" }),
                          })
                        }
                        className={`flex-1 rounded-xl px-3 py-2.5 text-left transition-colors ${
                          item.workType === value
                            ? "bg-card shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        <span className="block text-sm font-semibold">
                          {label}
                        </span>
                        <span className="block text-xs opacity-70">{hint}</span>
                      </button>
                    ))}
                  </div>

                  <div className="grid gap-4 sm:grid-cols-3">
                    <div className="space-y-2 sm:col-span-3">
                      <Label htmlFor={`${item.rowId}-garment`}>Garment</Label>
                      <select
                        id={`${item.rowId}-garment`}
                        // React resets the form after a server action returns.
                        // A native reset drops a <select> back to its first
                        // option, and React does not re-apply the value because
                        // the prop never changed — so a failed submit left this
                        // reading "Choose a garment…" while the order still had
                        // one. Re-syncing on every commit repairs that.
                        ref={(el) => {
                          if (el && el.value !== item.garmentTypeId) {
                            el.value = item.garmentTypeId
                          }
                        }}
                        value={item.garmentTypeId}
                        onChange={(event) =>
                          chooseGarmentType(item.rowId, event.target.value)
                        }
                        className="h-11 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
                        required
                      >
                        <option value="">Choose a garment…</option>
                        {garmentTypes.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.name} — ₹{option.baseRate}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`${item.rowId}-rate`}>Rate (₹)</Label>
                      <Input
                        id={`${item.rowId}-rate`}
                        value={item.rate}
                        inputMode="decimal"
                        className="h-11 tabular-nums"
                        onChange={(event) =>
                          updateItem(item.rowId, { rate: event.target.value })
                        }
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`${item.rowId}-qty`}>Quantity</Label>
                      <Input
                        id={`${item.rowId}-qty`}
                        value={item.quantity}
                        inputMode="numeric"
                        className="h-11 tabular-nums"
                        onChange={(event) =>
                          updateItem(item.rowId, { quantity: event.target.value })
                        }
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`${item.rowId}-due`}>Due date</Label>
                      <Input
                        id={`${item.rowId}-due`}
                        type="date"
                        value={item.dueDate}
                        className="h-11"
                        onChange={(event) =>
                          updateItem(item.rowId, { dueDate: event.target.value })
                        }
                        required
                      />
                    </div>
                  </div>

                  {item.workType === "stitching" ? (
                    <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
                      <fieldset className="space-y-2">
                        <legend className="text-sm font-medium">Cloth</legend>
                        <div className="flex flex-wrap gap-2">
                          {CLOTH_SOURCES.map((source) => (
                            <label
                              key={source}
                              className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm ${
                                item.clothSource === source
                                  ? "border-primary bg-accent"
                                  : ""
                              }`}
                            >
                              <input
                                type="radio"
                                name={`${item.rowId}-cloth`}
                                checked={item.clothSource === source}
                                onChange={() =>
                                  updateItem(item.rowId, { clothSource: source })
                                }
                              />
                              {CLOTH_SOURCE_LABELS[source]}
                            </label>
                          ))}
                        </div>
                      </fieldset>

                      <div className="space-y-2">
                        <Label htmlFor={`${item.rowId}-cloth-length`}>
                          Cloth length (m)
                        </Label>
                        <Input
                          id={`${item.rowId}-cloth-length`}
                          value={item.clothLength}
                          inputMode="decimal"
                          placeholder="2.5"
                          className="h-11 tabular-nums"
                          onChange={(event) =>
                            updateItem(item.rowId, {
                              clothLength: event.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                  ) : null}

                  {garmentType && item.workType === "stitching" ? (
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <span className="text-sm font-medium">Measurements</span>
                        {existing ? (
                          <div className="flex gap-2">
                            <ChoiceButton
                              active={item.measurementChoice === "existing"}
                              onClick={() =>
                                updateItem(item.rowId, {
                                  measurementChoice: "existing",
                                })
                              }
                            >
                              Use set from {formatDate(new Date(existing.takenOn))}
                            </ChoiceButton>
                            <ChoiceButton
                              active={item.measurementChoice === "new"}
                              onClick={() =>
                                updateItem(item.rowId, { measurementChoice: "new" })
                              }
                            >
                              Take new
                            </ChoiceButton>
                          </div>
                        ) : (
                          <StatusPill tone="bg-slate-100 text-slate-600 ring-slate-200">
                            No measurements on record
                          </StatusPill>
                        )}
                      </div>

                      {item.measurementChoice === "new" ? (
                        <MeasurementForm
                          fields={garmentType.measurementFields}
                          defaultValues={existing?.values}
                          idPrefix={`${item.rowId}-m`}
                          onChange={(values) =>
                            updateItem(item.rowId, { newMeasurements: values })
                          }
                        />
                      ) : existing ? (
                        <p className="rounded-xl bg-muted px-3 py-2 text-sm text-muted-foreground">
                          Stitching from the set taken{" "}
                          {formatDate(new Date(existing.takenOn))}.
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <div className="space-y-4 border-t pt-4">
                    {(item.workType === "design_only"
                      ? IMAGE_KINDS.filter(({ kind }) => kind === "reference")
                      : IMAGE_KINDS
                    ).map(({ kind, label, hint }) => (
                      <ImageUploader
                        key={kind}
                        kind={kind}
                        label={label}
                        hint={hint}
                        disabled={pending}
                        images={item.images.filter((image) => image.kind === kind)}
                        onChange={(next) =>
                          updateItem(item.rowId, {
                            // Replace only this kind, leave the other two alone.
                            images: [
                              ...item.images.filter((image) => image.kind !== kind),
                              ...next,
                            ],
                          })
                        }
                      />
                    ))}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`${item.rowId}-note`}>
                      Note <span className="text-muted-foreground">(optional)</span>
                    </Label>
                    <Textarea
                      id={`${item.rowId}-note`}
                      value={item.note}
                      rows={2}
                      placeholder="Piping, lining, falls, anything whoever stitches it needs to know."
                      onChange={(event) =>
                        updateItem(item.rowId, { note: event.target.value })
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            )
          })}

          <Button
            type="button"
            variant="outline"
            className="h-11 w-full"
            onClick={() =>
              setItems((current) => [...current, blankItem(current.length)])
            }
          >
            <Plus className="size-4" aria-hidden />
            Add another garment
          </Button>
        </div>

        <Card className="lg:sticky lg:top-20">
          <CardHeader>
            <CardTitle className="text-base">Bill</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="space-y-2 text-sm">
              {items.map((item, index) => {
                const garmentType = garmentTypeById.get(item.garmentTypeId)
                const quantity = Math.max(1, Number(item.quantity) || 1)
                return (
                  <div key={item.rowId} className="flex justify-between gap-3">
                    <dt className="min-w-0 truncate text-muted-foreground">
                      {garmentType?.name ?? `Garment ${index + 1}`}
                      {quantity > 1 ? ` × ${quantity}` : ""}
                    </dt>
                    <dd className="tabular-nums">
                      {formatMoney(safePaise(item.rate) * quantity)}
                    </dd>
                  </div>
                )
              })}
            </dl>

            <div className="space-y-2 border-t pt-3">
              <Label htmlFor="discount">Discount (₹)</Label>
              <Input
                id="discount"
                value={discount}
                inputMode="decimal"
                placeholder="0"
                className="h-11 tabular-nums"
                onChange={(event) => setDiscount(event.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="advance">Advance paid (₹)</Label>
              <Input
                id="advance"
                value={advancePaid}
                inputMode="decimal"
                placeholder="0"
                className="h-11 tabular-nums"
                onChange={(event) => setAdvancePaid(event.target.value)}
              />
            </div>

            <dl className="space-y-2 border-t pt-3 text-sm">
              <Row label="Subtotal" value={formatMoney(totals.subtotal)} />
              {totals.discount > 0 ? (
                <Row label="Discount" value={`− ${formatMoney(totals.discount)}`} />
              ) : null}
              <Row label="Total" value={formatMoney(totals.total)} strong />
              {totals.advancePaid > 0 ? (
                <Row label="Advance" value={`− ${formatMoney(totals.advancePaid)}`} />
              ) : null}
              <Row
                label={totals.balance < 0 ? "To refund" : "Balance"}
                value={formatMoney(Math.abs(totals.balance))}
                strong
              />
            </dl>
          </CardContent>
        </Card>
      </div>

      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      {state.fieldErrors ? (
        <Alert variant="destructive">
          <AlertDescription>
            <ul className="space-y-1">
              {Object.entries(state.fieldErrors).map(([key, message]) => (
                <li key={key}>{message}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <Button type="submit" className="h-11" disabled={pending}>
          {pending ? "Saving…" : orderId ? "Save changes" : "Save as draft"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-11"
          nativeButton={false}
          render={
            <Link href={orderId ? `/orders/${orderId}` : `/customers/${customerId}`}>
              Cancel
            </Link>
          }
        />
        <p className="w-full text-sm text-muted-foreground">
          {orderId
            ? "Only drafts can be edited. Once an order has been sent, the customer has seen that bill."
            : `Saving keeps this as a draft for ${customerName}. Sending it to them for confirmation comes next.`}
        </p>
      </div>
    </form>
  )
}

function blankItem(index: number): BuilderItem {
  return {
    rowId: `item-${Date.now()}-${index}`,
    garmentTypeId: "",
    rate: "",
    quantity: "1",
    workType: "stitching",
    clothLength: "",
    clothSource: "customer",
    note: "",
    dueDate: "",
    measurementChoice: "new",
    newMeasurements: {},
    images: [],
  }
}

/** Rupee text to paise, treating anything half-typed as nothing yet. */
function safePaise(value: string): number {
  if (value.trim() === "") return 0
  try {
    return toPaise(value)
  } catch {
    return 0
  }
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
      <dt className={strong ? "font-medium" : "text-muted-foreground"}>{label}</dt>
      <dd className={`tabular-nums ${strong ? "font-medium" : ""}`}>{value}</dd>
    </div>
  )
}

function ChoiceButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-11 rounded-md border px-3 text-sm ${
        active ? "border-primary bg-accent font-medium" : "text-muted-foreground"
      }`}
    >
      {children}
    </button>
  )
}
