"use client"

import { useActionState } from "react"
import Link from "next/link"

import { MeasurementForm } from "./MeasurementForm"
import {
  saveMeasurementSet,
  type MeasurementFormState,
} from "@/app/(portal)/customers/[id]/measurements/actions"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import type { MeasurementFieldInput } from "@/schemas/garmentType"
import type { MeasurementValues } from "@/schemas/measurementSet"

const initialState: MeasurementFormState = {}

export interface TakeMeasurementsFormProps {
  customerId: string
  garmentTypeId: string
  fields: readonly MeasurementFieldInput[]
  /** The latest existing set for this garment, if the customer has one. */
  defaultValues?: MeasurementValues
}

export function TakeMeasurementsForm({
  customerId,
  garmentTypeId,
  fields,
  defaultValues,
}: TakeMeasurementsFormProps) {
  const [state, formAction, pending] = useActionState(
    saveMeasurementSet,
    initialState
  )

  const invalidFields = Object.entries(state.fieldErrors ?? {})

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="customerId" value={customerId} />
      <input type="hidden" name="garmentTypeId" value={garmentTypeId} />

      <MeasurementForm
        fields={fields}
        defaultValues={defaultValues}
        name="values"
        disabled={pending}
      />

      {invalidFields.length > 0 ? (
        <Alert variant="destructive">
          <AlertDescription>
            <ul className="space-y-1">
              {invalidFields.map(([key, message]) => (
                <li key={key}>
                  {labelFor(fields, key)}: {message}
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="measurement-notes">
          Notes <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id="measurement-notes"
          name="notes"
          rows={3}
          placeholder="Anything about how these were taken, or what the customer asked for."
        />
      </div>

      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex gap-3">
        <Button type="submit" className="h-11" disabled={pending}>
          {pending ? "Saving…" : "Save measurements"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          className="h-11"
          nativeButton={false}
          render={<Link href={`/customers/${customerId}`}>Cancel</Link>}
        />
      </div>
    </form>
  )
}

function labelFor(
  fields: readonly MeasurementFieldInput[],
  key: string
): string {
  return fields.find((field) => field.key === key)?.label ?? key
}
