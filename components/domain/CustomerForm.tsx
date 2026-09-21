"use client"

import { useActionState, useId } from "react"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

import {
  createCustomer,
  type CustomerFormState,
} from "@/app/(portal)/customers/actions"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { formatPhone } from "@/lib/phone"

const initialState: CustomerFormState = {}

export interface CustomerFormProps {
  defaultPhone?: string
  /** "order" sends staff back to the order they were writing after saving. */
  returnTo?: "order"
  submitLabel?: string
  cancelHref?: string
}

export function CustomerForm({
  defaultPhone,
  returnTo,
  submitLabel = "Save customer",
  cancelHref = "/customers",
}: CustomerFormProps) {
  const [state, formAction, pending] = useActionState(
    createCustomer,
    initialState
  )
  const formId = useId()

  return (
    <form action={formAction} className="space-y-6">
      {returnTo ? <input type="hidden" name="returnTo" value={returnTo} /> : null}

      {state.duplicate ? (
        <Alert>
          <AlertDescription className="space-y-3">
            <span className="block">
              <strong>{state.duplicate.name}</strong> already has{" "}
              {formatPhone(state.duplicate.phone)}. Open them instead of adding a
              second record.
            </span>
            <Button
              className="h-11"
              nativeButton={false}
              render={
                <Link
                  href={
                    returnTo === "order"
                      ? `/orders/new?customerId=${state.duplicate.id}`
                      : `/customers/${state.duplicate.id}`
                  }
                >
                  {returnTo === "order" ? "Use" : "Open"} {state.duplicate.name}
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              }
            />
          </AlertDescription>
        </Alert>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor={`${formId}-name`}>Name</Label>
        <Input
          id={`${formId}-name`}
          name="name"
          className="h-11"
          autoComplete="name"
          required
          autoFocus
        />
        <FieldError message={state.fieldErrors?.name} />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${formId}-phone`}>Phone</Label>
        <Input
          id={`${formId}-phone`}
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          className="h-11"
          placeholder="98765 43210"
          defaultValue={defaultPhone}
          required
        />
        <p className="text-xs text-muted-foreground">
          Indian mobile. +91 is added for you.
        </p>
        <FieldError message={state.fieldErrors?.phone} />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${formId}-alt-phone`}>
          Alternate phone <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Input
          id={`${formId}-alt-phone`}
          name="altPhone"
          type="tel"
          inputMode="tel"
          className="h-11"
        />
        <FieldError message={state.fieldErrors?.altPhone} />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${formId}-address`}>
          Address <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Textarea id={`${formId}-address`} name="address" rows={2} />
        <FieldError message={state.fieldErrors?.address} />
      </div>

      <div className="space-y-2">
        <Label htmlFor={`${formId}-notes`}>
          Notes <span className="text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id={`${formId}-notes`}
          name="notes"
          rows={3}
          placeholder="Preferences, referrals, anything worth remembering."
        />
        <FieldError message={state.fieldErrors?.notes} />
      </div>

      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex gap-3">
        <Button type="submit" className="h-11" disabled={pending}>
          {pending ? "Saving…" : submitLabel}
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
  )
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-sm text-destructive">{message}</p>
}
