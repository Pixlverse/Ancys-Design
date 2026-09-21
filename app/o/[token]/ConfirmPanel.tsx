"use client"

import { useActionState, useState } from "react"
import { Check, MessageCircle, Phone } from "lucide-react"

import { confirmFromPublicPage, type ConfirmState } from "./actions"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"

const initialState: ConfirmState = {}

export function ConfirmPanel({
  token,
  alreadyConfirmed,
  shopPhone,
}: {
  token: string
  alreadyConfirmed: boolean
  shopPhone?: string
}) {
  const [state, formAction, pending] = useActionState(
    confirmFromPublicPage,
    initialState
  )
  const [showPhone, setShowPhone] = useState(false)

  if (alreadyConfirmed || state.confirmed) {
    return (
      <div className="rounded-lg border bg-card p-6 text-center">
        <Check className="mx-auto mb-2 size-8 text-green-600" aria-hidden />
        <p className="text-lg font-medium">Thank you</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Your order is confirmed and we have started work on it.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <form action={formAction}>
        <input type="hidden" name="token" value={token} />
        <Button type="submit" className="h-14 w-full text-base brand-fill" disabled={pending}>
          {pending ? "Confirming…" : "Confirm this order"}
        </Button>
      </form>

      {showPhone ? (
        <div className="rounded-3xl bg-card p-6 text-center tile-float">
          <p className="text-sm text-muted-foreground">
            Call the shop and we will sort it out.
          </p>
          {shopPhone ? (
            <Button
              variant="outline"
              className="mt-3 h-12 w-full"
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
      ) : (
        <Button
          type="button"
          variant="outline"
          className="h-14 w-full text-base"
          onClick={() => setShowPhone(true)}
        >
          <MessageCircle className="size-4" aria-hidden />
          I&rsquo;d like a change
        </Button>
      )}
    </div>
  )
}
