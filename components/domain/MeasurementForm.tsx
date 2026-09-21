"use client"

import { useId, useState } from "react"

import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import type { MeasurementFieldInput } from "@/schemas/garmentType"
import type { MeasurementValues } from "@/schemas/measurementSet"

export interface MeasurementFormProps {
  /** The garment type's fields, in order. Resolved by the parent — see below. */
  fields: readonly MeasurementFieldInput[]
  /** Prefill, normally the customer's latest set for this garment. */
  defaultValues?: MeasurementValues
  /**
   * When set, the values are also emitted as a hidden JSON input under this
   * name, so the form drops into any `<form action={serverAction}>` without the
   * parent wiring anything up. Phase 2 uses one per order item.
   */
  name?: string
  /** Fires on every edit, for parents that need to react (a live bill panel). */
  onChange?: (values: MeasurementValues) => void
  /** Distinguishes input ids when more than one form is on the page. */
  idPrefix?: string
  disabled?: boolean
}

/**
 * Renders one numeric input per measurement field. It deliberately does not own
 * submission: on the customer page it sits in a form that saves a measurement
 * set, and in the order flow it sits inside the order form, once per item.
 *
 * Values are kept as raw text while typing — otherwise "32." collapses the moment
 * the decimal point is typed — and converted to numbers on the way out.
 */
export function MeasurementForm({
  fields,
  defaultValues,
  name,
  onChange,
  idPrefix,
  disabled = false,
}: MeasurementFormProps) {
  const generatedId = useId()
  const prefix = idPrefix ?? generatedId

  const [text, setText] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      fields.map((field) => [field.key, stringify(defaultValues?.[field.key])])
    )
  )

  function update(key: string, raw: string) {
    const next = { ...text, [key]: raw }
    setText(next)
    onChange?.(toValues(next))
  }

  if (fields.length === 0) {
    return (
      <p className="rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
        This garment has no measurements set up. Add them in Settings → Garment
        types.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      {name ? (
        <input type="hidden" name={name} value={JSON.stringify(toValues(text))} />
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((field) => {
          const inputId = `${prefix}-${field.key}`
          return (
            <div key={field.key} className="space-y-2">
              <Label htmlFor={inputId} className="flex items-baseline gap-1.5">
                {field.label}
                {field.required ? (
                  <span className="text-destructive" aria-hidden>
                    *
                  </span>
                ) : (
                  <span className="text-xs font-normal text-muted-foreground">
                    optional
                  </span>
                )}
              </Label>

              <div className="relative">
                <Input
                  id={inputId}
                  // Text plus inputMode gives phones the decimal keypad without
                  // type=number's spinners and scroll-wheel accidents.
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  className="h-12 pr-12 text-base tabular-nums"
                  value={text[field.key] ?? ""}
                  required={field.required}
                  disabled={disabled}
                  aria-describedby={`${inputId}-unit`}
                  onChange={(event) => update(field.key, event.target.value)}
                />
                <span
                  id={`${inputId}-unit`}
                  className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-sm text-muted-foreground"
                >
                  {field.unit}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function stringify(value: number | undefined): string {
  return value === undefined ? "" : String(value)
}

/** Raw text to numbers, dropping anything blank or not yet a valid number. */
function toValues(text: Record<string, string>): MeasurementValues {
  const values: MeasurementValues = {}
  for (const [key, raw] of Object.entries(text)) {
    const trimmed = raw.trim()
    if (trimmed === "") continue
    const parsed = Number(trimmed)
    if (Number.isFinite(parsed)) values[key] = parsed
  }
  return values
}
