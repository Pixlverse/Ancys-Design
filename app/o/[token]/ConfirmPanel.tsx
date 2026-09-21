"use client"

import { useActionState, useState } from "react"
import { Check, MessageCircle, Phone, X } from "lucide-react"

import {
  confirmFromPublicPage,
  respondFromPublicPage,
  type ConfirmState,
} from "./actions"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

const initialState: ConfirmState = {}

/** Which secondary answer the customer is part-way through giving. */
type Asking = "changes_requested" | "declined" | null

export function ConfirmPanel({
  token,
  alreadyConfirmed,
  alreadyResponded,
  shopPhone,
}: {
  token: string
  alreadyConfirmed: boolean
  /** Set when they have already asked for a change or declined. */
  alreadyResponded?: "changes_requested" | "declined"
  shopPhone?: string
}) {
  const [state, confirmAction, confirming] = useActionState(
    confirmFromPublicPage,
    initialState
  )
  const [respondState, respondAction, responding] = useActionState(
    respondFromPublicPage,
    initialState
  )
  const [asking, setAsking] = useState<Asking>(null)

  const responded = respondState.responded ?? alreadyResponded
  const error = state.error ?? respondState.error

  if (alreadyConfirmed || state.confirmed) {
    return (
      <Outcome
        icon={<Check className="mx-auto mb-2 size-8 text-emerald-600" aria-hidden />}
        title="Thank you"
        body="Your order is confirmed and we have started work on it."
      />
    )
  }

  if (responded === "declined") {
    return (
      <Outcome
        icon={<X className="mx-auto mb-2 size-8 text-rose-600" aria-hidden />}
        title="Order cancelled"
        body="We have let the shop know. Call us if you change your mind."
        shopPhone={shopPhone}
      />
    )
  }

  if (responded === "changes_requested") {
    return (
      <Outcome
        icon={
          <MessageCircle
            className="mx-auto mb-2 size-8 text-fuchsia-600"
            aria-hidden
          />
        }
        title="We will take another look"
        body="The shop has your note and will send an updated order shortly."
        shopPhone={shopPhone}
      />
    )
  }

  const busy = confirming || responding

  return (
    <div className="space-y-3">
      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {/* The reason box only appears once they have chosen which answer they
          are giving, so the common case — Confirm — stays a single tap. */}
      {asking ? (
        <form action={respondAction} className="space-y-3 rounded-3xl bg-card p-5 tile-float">
          <input type="hidden" name="token" value={token} />
          <input type="hidden" name="response" value={asking} />

          <label htmlFor="note" className="block text-sm font-medium">
            {asking === "declined"
              ? "Tell us why, if you like"
              : "What would you like changed?"}
          </label>
          <textarea
            id="note"
            name="note"
            rows={3}
            maxLength={500}
            autoFocus
            placeholder={
              asking === "declined"
                ? "Optional"
                : "For example: make the sleeves a little longer"
            }
            className="w-full rounded-2xl border border-border bg-background p-3 text-base"
          />

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-12 flex-1"
              onClick={() => setAsking(null)}
              disabled={busy}
            >
              Back
            </Button>
            <Button type="submit" className="h-12 flex-1 brand-fill" disabled={busy}>
              {responding ? "Sending…" : "Send to the shop"}
            </Button>
          </div>
        </form>
      ) : (
        <>
          <form action={confirmAction}>
            <input type="hidden" name="token" value={token} />
            <Button
              type="submit"
              className="h-14 w-full text-base brand-fill"
              disabled={busy}
            >
              {confirming ? "Confirming…" : "Confirm this order"}
            </Button>
          </form>

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-14 flex-1 text-base"
              onClick={() => setAsking("changes_requested")}
              disabled={busy}
            >
              <MessageCircle className="size-4" aria-hidden />
              Request a change
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-14 flex-1 text-base text-destructive"
              onClick={() => setAsking("declined")}
              disabled={busy}
            >
              <X className="size-4" aria-hidden />
              Decline
            </Button>
          </div>
        </>
      )}
    </div>
  )
}

function Outcome({
  icon,
  title,
  body,
  shopPhone,
}: {
  icon: React.ReactNode
  title: string
  body: string
  shopPhone?: string
}) {
  return (
    <div className="rounded-3xl bg-card p-6 text-center tile-float">
      {icon}
      <p className="text-lg font-medium">{title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{body}</p>
      {shopPhone ? (
        <Button
          variant="outline"
          className="mt-4 h-12 w-full"
          nativeButton={false}
          render={
            <a href={`tel:${shopPhone}`}>
              <Phone className="size-4" aria-hidden />
              {shopPhone}
            </a>
          }
        />
      ) : null}
    </div>
  )
}
