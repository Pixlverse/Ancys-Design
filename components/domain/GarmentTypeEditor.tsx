"use client"

import { useActionState, useId, useState } from "react"
import Link from "next/link"
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react"

import {
  saveGarmentType,
  type GarmentTypeFormState,
} from "@/app/(portal)/settings/garment-types/actions"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  MEASUREMENT_UNITS,
  suggestKey,
  type MeasurementFieldInput,
  type MeasurementUnit,
} from "@/schemas/garmentType"

export interface GarmentTypeEditorValue {
  id: string
  name: string
  /** Rupees, as typed. Converted to paise server-side. */
  baseRate: string
  isActive: boolean
  measurementFields: MeasurementFieldInput[]
}

interface EditorRow extends MeasurementFieldInput {
  /** Stable React key — the measurement key can be blank while being typed. */
  rowId: string
  /** New rows may still have their key edited; saved ones may not. */
  isNew: boolean
}

const initialState: GarmentTypeFormState = {}

export function GarmentTypeEditor({
  garmentType,
}: {
  garmentType?: GarmentTypeEditorValue
}) {
  const [state, formAction, pending] = useActionState(
    saveGarmentType,
    initialState
  )
  const formId = useId()

  const [name, setName] = useState(garmentType?.name ?? "")
  const [baseRate, setBaseRate] = useState(garmentType?.baseRate ?? "")
  const [isActive, setIsActive] = useState(garmentType?.isActive ?? true)
  const [rows, setRows] = useState<EditorRow[]>(
    () =>
      garmentType?.measurementFields.map((field, index) => ({
        ...field,
        rowId: `saved-${index}`,
        isNew: false,
      })) ?? []
  )

  function updateRow(rowId: string, patch: Partial<EditorRow>) {
    setRows((current) =>
      current.map((row) => (row.rowId === rowId ? { ...row, ...patch } : row))
    )
  }

  function addRow() {
    setRows((current) => [
      ...current,
      {
        rowId: `new-${Date.now()}-${current.length}`,
        key: "",
        label: "",
        unit: "in",
        required: false,
        order: current.length,
        isNew: true,
      },
    ])
  }

  function removeRow(rowId: string) {
    setRows((current) => current.filter((row) => row.rowId !== rowId))
  }

  function moveRow(index: number, direction: -1 | 1) {
    const target = index + direction
    setRows((current) => {
      if (target < 0 || target >= current.length) return current
      const next = [...current]
      const [moved] = next.splice(index, 1)
      next.splice(target, 0, moved)
      return next
    })
  }

  const payload = rows.map(({ key, label, unit, required }, index) => ({
    key,
    label,
    unit,
    required,
    order: index,
  }))

  return (
    <form action={formAction} className="space-y-8">
      {garmentType ? <input type="hidden" name="id" value={garmentType.id} /> : null}
      <input
        type="hidden"
        name="measurementFields"
        value={JSON.stringify(payload)}
      />
      {isActive ? <input type="hidden" name="isActive" value="on" /> : null}

      <section className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor={`${formId}-name`}>Garment name</Label>
            <Input
              id={`${formId}-name`}
              name="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="e.g. Lehenga"
              className="h-11"
              required
            />
            <FieldError message={state.fieldErrors?.name} />
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${formId}-rate`}>Base rate (₹)</Label>
            <Input
              id={`${formId}-rate`}
              name="baseRate"
              value={baseRate}
              onChange={(event) => setBaseRate(event.target.value)}
              inputMode="decimal"
              placeholder="450"
              className="h-11"
              required
            />
            <p className="text-xs text-muted-foreground">
              Rupees. Copied onto each order item, so changing it later never
              alters a past order.
            </p>
            <FieldError message={state.fieldErrors?.baseRate} />
          </div>
        </div>

        <label className="flex items-center gap-3">
          <Switch checked={isActive} onCheckedChange={setIsActive} />
          <span className="text-sm">
            {isActive
              ? "Active — available when taking orders"
              : "Inactive — hidden from new orders, past orders unaffected"}
          </span>
        </label>
      </section>

      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-medium">Measurements</h2>
          <p className="text-sm text-muted-foreground">
            These become the measurement form for this garment, in this order.
          </p>
        </div>

        {rows.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            No measurements yet. Add the ones this garment needs — bust, waist,
            length, and so on.
          </p>
        ) : (
          <ul className="space-y-3">
            {rows.map((row, index) => (
              <li key={row.rowId} className="rounded-2xl bg-muted/40 p-3 sm:p-4">
                <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
                  <div className="space-y-1.5">
                    <Label htmlFor={`${row.rowId}-label`} className="text-xs">
                      Label
                    </Label>
                    <Input
                      id={`${row.rowId}-label`}
                      value={row.label}
                      className="h-11"
                      onChange={(event) => {
                        const label = event.target.value
                        updateRow(row.rowId, {
                          label,
                          // Only a brand new field follows its label; a saved key
                          // is what historical measurements are stored under.
                          ...(row.isNew ? { key: suggestKey(label) } : {}),
                        })
                      }}
                      placeholder="Sleeve length"
                    />
                    <FieldError
                      message={state.fieldErrors?.[`measurementFields.${index}.label`]}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor={`${row.rowId}-key`} className="text-xs">
                      Key
                    </Label>
                    <Input
                      id={`${row.rowId}-key`}
                      value={row.key}
                      className="h-11 font-mono text-sm"
                      disabled={!row.isNew}
                      onChange={(event) =>
                        updateRow(row.rowId, { key: event.target.value })
                      }
                      placeholder="sleeveLength"
                    />
                    <p className="text-xs text-muted-foreground">
                      {row.isNew
                        ? "Fixed once saved."
                        : "Locked — past measurements are stored under it."}
                    </p>
                    <FieldError
                      message={state.fieldErrors?.[`measurementFields.${index}.key`]}
                    />
                  </div>

                  <div className="flex items-end gap-1 sm:flex-col sm:items-stretch">
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-11"
                      aria-label={`Move ${row.label || "field"} up`}
                      disabled={index === 0}
                      onClick={() => moveRow(index, -1)}
                    >
                      <ArrowUp className="size-4" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-11"
                      aria-label={`Move ${row.label || "field"} down`}
                      disabled={index === rows.length - 1}
                      onClick={() => moveRow(index, 1)}
                    >
                      <ArrowDown className="size-4" aria-hidden />
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      className="size-11 text-destructive"
                      aria-label={`Remove ${row.label || "field"}`}
                      onClick={() => removeRow(row.rowId)}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Unit</span>
                    <select
                      value={row.unit}
                      onChange={(event) =>
                        updateRow(row.rowId, {
                          unit: event.target.value as MeasurementUnit,
                        })
                      }
                      className="h-9 rounded-lg border border-input bg-transparent px-2 text-sm"
                      aria-label={`Unit for ${row.label || "field"}`}
                    >
                      {MEASUREMENT_UNITS.map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex items-center gap-2 text-sm">
                    <Switch
                      checked={row.required}
                      onCheckedChange={(checked) =>
                        updateRow(row.rowId, { required: checked })
                      }
                    />
                    <span className="text-muted-foreground">Required</span>
                  </label>
                </div>
              </li>
            ))}
          </ul>
        )}

        <Button type="button" variant="outline" className="h-11" onClick={addRow}>
          <Plus className="size-4" aria-hidden />
          Add measurement
        </Button>
      </section>

      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex gap-3">
        <Button type="submit" className="h-11" disabled={pending}>
          {pending ? "Saving…" : "Save garment type"}
        </Button>
        <Button type="button" variant="ghost" className="h-11" render={<Link href="/settings/garment-types">Cancel</Link>} />
      </div>
    </form>
  )
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-sm text-destructive">{message}</p>
}
