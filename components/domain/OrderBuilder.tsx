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

/** One garment's own cloth, photos and note, when a line's pieces differ. */
export interface OrderBuilderPiece {
  clothSource?: ClothSource
  clothLength: string
  images: UploadedImage[]
  note: string
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
  pieces?: OrderBuilderPiece[]
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
  /**
   * Whether each piece on this line gets its own cloth, photos and note. Only
   * offered when the quantity is more than one.
   */
  piecesDiffer: boolean
  /** One per piece while `piecesDiffer`; kept in step with the quantity. */
  pieces: OrderBuilderPiece[]
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
          piecesDiffer: Boolean(item.pieces && item.pieces.length > 1),
          pieces: item.pieces ?? [],
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

  function changeQuantity(item: BuilderItem, quantity: string) {
    const count = pieceCount(quantity)
    if (!item.piecesDiffer || count === item.pieces.length) {
      updateItem(item.rowId, { quantity })
      return
    }

    if (count > item.pieces.length) {
      updateItem(item.rowId, {
        quantity,
        pieces: [
          ...item.pieces,
          ...Array.from({ length: count - item.pieces.length }, () =>
            blankPiece(item)
          ),
        ],
      })
      return
    }

    // Lowering the quantity throws pieces away. If any of them had photos or a
    // note, that is work somebody did, so ask first.
    const dropped = item.pieces.slice(count)
    if (
      dropped.some(hasContent) &&
      !window.confirm(
        `This removes piece${dropped.length > 1 ? "s" : ""} ${count + 1}` +
          `${dropped.length > 1 ? `–${item.pieces.length}` : ""}` +
          ` and their photos and notes. Continue?`
      )
    ) {
      return
    }

    if (count === 1) {
      updateItem(item.rowId, { quantity, ...collapsePieces(item) })
    } else {
      updateItem(item.rowId, { quantity, pieces: item.pieces.slice(0, count) })
    }
  }

  function setPiecesDiffer(item: BuilderItem, differ: boolean) {
    if (differ === item.piecesDiffer) return

    if (differ) {
      // Whatever was already filled in becomes piece 1, and the rest start
      // from the same cloth source so staff only change what is different.
      const count = pieceCount(item.quantity)
      updateItem(item.rowId, {
        piecesDiffer: true,
        pieces: [
          {
            clothSource: item.clothSource,
            clothLength: item.clothLength,
            images: item.images,
            note: "",
          },
          ...Array.from({ length: count - 1 }, () => blankPiece(item)),
        ],
        images: [],
      })
      return
    }

    if (
      item.pieces.slice(1).some(hasContent) &&
      !window.confirm(
        "Only piece 1's cloth and photos will be kept for all of them. Continue?"
      )
    ) {
      return
    }
    updateItem(item.rowId, collapsePieces(item))
  }

  function updatePiece(
    rowId: string,
    index: number,
    patch: Partial<OrderBuilderPiece>
  ) {
    setItems((current) =>
      current.map((item) =>
        item.rowId === rowId
          ? {
              ...item,
              pieces: item.pieces.map((piece, i) =>
                i === index ? { ...piece, ...patch } : piece
              ),
            }
          : item
      )
    )
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
      const differ = item.piecesDiffer && pieceCount(item.quantity) > 1
      return {
        ...(item.itemId ? { itemId: item.itemId } : {}),
        garmentTypeId: item.garmentTypeId,
        rate: item.rate,
        quantity: Number(item.quantity) || 1,
        workType: item.workType,
        ...(differ
          ? {
              images: [],
              pieces: item.pieces.map((piece) => ({
                ...(item.workType === "stitching"
                  ? {
                      clothSource: piece.clothSource ?? "customer",
                      clothLength: piece.clothLength,
                    }
                  : {}),
                images: piece.images,
                note: piece.note,
              })),
            }
          : {
              ...(item.workType === "stitching"
                ? {
                    clothSource: item.clothSource ?? "customer",
                    clothLength: item.clothLength,
                  }
                : {}),
              images: item.images,
            }),
        note: item.note,
        dueDate: item.dueDate,
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
            const count = pieceCount(item.quantity)
            const differ = item.piecesDiffer && count > 1

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
                            pieces: item.pieces.map((piece) =>
                              value === "design_only"
                                ? { ...piece, clothSource: undefined, clothLength: "" }
                                : { ...piece, clothSource: piece.clothSource ?? "customer" }
                            ),
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
                          changeQuantity(item, event.target.value)
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

                  {count > 1 ? (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">
                        Cloth, photos and notes for these {count}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <ChoiceButton
                          active={!differ}
                          onClick={() => setPiecesDiffer(item, false)}
                        >
                          Same for all {count}
                        </ChoiceButton>
                        <ChoiceButton
                          active={differ}
                          onClick={() => setPiecesDiffer(item, true)}
                        >
                          Different for each piece
                        </ChoiceButton>
                      </div>
                    </div>
                  ) : null}

                  {item.workType === "stitching" && !differ ? (
                    <ClothFields
                      idPrefix={item.rowId}
                      clothSource={item.clothSource}
                      clothLength={item.clothLength}
                      onChange={(patch) => updateItem(item.rowId, patch)}
                    />
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

                  {differ ? (
                    <div className="space-y-3 border-t pt-4">
                      {item.pieces.map((piece, pieceIndex) => (
                        <div
                          key={pieceIndex}
                          className="space-y-4 rounded-2xl border p-4"
                        >
                          <p className="text-sm font-semibold">
                            Piece {pieceIndex + 1}
                            {garmentType ? ` — ${garmentType.name}` : ""}
                          </p>
                          {item.workType === "stitching" ? (
                            <ClothFields
                              idPrefix={`${item.rowId}-p${pieceIndex}`}
                              clothSource={piece.clothSource}
                              clothLength={piece.clothLength}
                              onChange={(patch) =>
                                updatePiece(item.rowId, pieceIndex, patch)
                              }
                            />
                          ) : null}
                          <ImageFields
                            workType={item.workType}
                            images={piece.images}
                            disabled={pending}
                            onChange={(images) =>
                              updatePiece(item.rowId, pieceIndex, { images })
                            }
                          />
                          <div className="space-y-2">
                            <Label htmlFor={`${item.rowId}-p${pieceIndex}-note`}>
                              Note for piece {pieceIndex + 1}{" "}
                              <span className="text-muted-foreground">(optional)</span>
                            </Label>
                            <Textarea
                              id={`${item.rowId}-p${pieceIndex}-note`}
                              value={piece.note}
                              rows={2}
                              placeholder="Neck style, colour of piping, anything just for this one."
                              onChange={(event) =>
                                updatePiece(item.rowId, pieceIndex, {
                                  note: event.target.value,
                                })
                              }
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="border-t pt-4">
                      <ImageFields
                        workType={item.workType}
                        images={item.images}
                        disabled={pending}
                        onChange={(images) => updateItem(item.rowId, { images })}
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <Label htmlFor={`${item.rowId}-note`}>
                      {differ ? `Note for all ${count}` : "Note"}{" "}
                      <span className="text-muted-foreground">(optional)</span>
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
    piecesDiffer: false,
    pieces: [],
  }
}

/** How many garments a quantity box means, treating half-typed as one. */
function pieceCount(quantity: string): number {
  return Math.min(99, Math.max(1, Math.floor(Number(quantity)) || 1))
}

function blankPiece(item: BuilderItem): OrderBuilderPiece {
  return {
    clothSource: item.workType === "stitching" ? "customer" : undefined,
    clothLength: "",
    images: [],
    note: "",
  }
}

function hasContent(piece: OrderBuilderPiece): boolean {
  return piece.images.length > 0 || piece.note.trim() !== ""
}

/** Back to one description for every piece, taken from piece 1. */
function collapsePieces(item: BuilderItem): Partial<BuilderItem> {
  const first = item.pieces[0]
  return {
    piecesDiffer: false,
    pieces: [],
    ...(first
      ? {
          clothSource: first.clothSource ?? item.clothSource,
          clothLength: first.clothLength,
          images: first.images,
          // Piece 1's own note is not lost: it joins the shared one.
          note: [item.note.trim(), first.note.trim()].filter(Boolean).join("\n"),
        }
      : {}),
  }
}

function ClothFields({
  idPrefix,
  clothSource,
  clothLength,
  onChange,
}: {
  idPrefix: string
  clothSource?: ClothSource
  clothLength: string
  onChange: (patch: { clothSource?: ClothSource; clothLength?: string }) => void
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Cloth</legend>
        <div className="flex flex-wrap gap-2">
          {CLOTH_SOURCES.map((source) => (
            <label
              key={source}
              className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm ${
                clothSource === source ? "border-primary bg-accent" : ""
              }`}
            >
              <input
                type="radio"
                name={`${idPrefix}-cloth`}
                checked={clothSource === source}
                onChange={() => onChange({ clothSource: source })}
              />
              {CLOTH_SOURCE_LABELS[source]}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="space-y-2">
        <Label htmlFor={`${idPrefix}-cloth-length`}>Cloth length (m)</Label>
        <Input
          id={`${idPrefix}-cloth-length`}
          value={clothLength}
          inputMode="decimal"
          placeholder="2.5"
          className="h-11 tabular-nums"
          onChange={(event) => onChange({ clothLength: event.target.value })}
        />
      </div>
    </div>
  )
}

function ImageFields({
  workType,
  images,
  disabled,
  onChange,
}: {
  workType: WorkType
  images: UploadedImage[]
  disabled: boolean
  onChange: (images: UploadedImage[]) => void
}) {
  return (
    <div className="space-y-4">
      {(workType === "design_only"
        ? IMAGE_KINDS.filter(({ kind }) => kind === "reference")
        : IMAGE_KINDS
      ).map(({ kind, label, hint }) => (
        <ImageUploader
          key={kind}
          kind={kind}
          label={label}
          hint={hint}
          disabled={disabled}
          images={images.filter((image) => image.kind === kind)}
          onChange={(next) =>
            // Replace only this kind, leave the other two alone.
            onChange([...images.filter((image) => image.kind !== kind), ...next])
          }
        />
      ))}
    </div>
  )
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
