"use client"

import { useActionState } from "react"
import { Check, ExternalLink, Receipt, Send } from "lucide-react"

import {
  markConfirmedByStaff,
  sendBillToCustomer,
  sendForConfirmation,
  type SendConfirmationState,
} from "@/app/(portal)/orders/[id]/confirmation-actions"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const initialState: SendConfirmationState = {}

export interface ConfirmationCardProps {
  orderId: string
  status: string
  sentAt?: string
  viewedAt?: string
  confirmedAt?: string
  confirmedBy?: string
  billSentAt?: string
  publicUrl?: string
}

export function ConfirmationCard({
  orderId,
  status,
  sentAt,
  viewedAt,
  confirmedAt,
  confirmedBy,
  billSentAt,
  publicUrl,
}: ConfirmationCardProps) {
  const [state, formAction, pending] = useActionState(
    sendForConfirmation,
    initialState
  )
  const [billState, billAction, billPending] = useActionState(
    sendBillToCustomer,
    initialState
  )

  const canSend = status === "draft" || status === "awaiting_confirmation"
  const awaiting = status === "awaiting_confirmation"

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Customer confirmation</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ol className="space-y-1.5 text-sm">
          <Step label="Sent to the customer" at={sentAt} />
          <Step label="Opened by the customer" at={viewedAt} />
          <Step
            label={
              confirmedBy && confirmedBy !== "customer"
                ? `Confirmed — marked by ${confirmedBy}`
                : "Confirmed by the customer"
            }
            at={confirmedAt}
          />
          <Step label="Final bill sent" at={billSentAt} />
        </ol>

        {state.error || billState.error ? (
          <Alert variant="destructive">
            <AlertDescription>{state.error ?? billState.error}</AlertDescription>
          </Alert>
        ) : null}

        {/* The provider decides whether a person is needed; this page does not
            know which provider is active, or what it uses to deliver. */}
        {billState.openUrl ? (
          <Alert>
            <AlertDescription className="space-y-3">
              <span className="block">
                The final bill is ready. Open it and press send.
              </span>
              <Button
                className="h-12 w-full"
                nativeButton={false}
                render={
                  <a href={billState.openUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-4" aria-hidden />
                    Open the bill to send
                  </a>
                }
              />
            </AlertDescription>
          </Alert>
        ) : null}

        {state.openUrl ? (
          <Alert>
            <AlertDescription className="space-y-3">
              <span className="block">
                The message is ready. Open it and press send.
              </span>
              <Button
                className="h-12 w-full"
                nativeButton={false}
                render={
                  <a href={state.openUrl} target="_blank" rel="noreferrer">
                    <ExternalLink className="size-4" aria-hidden />
                    Open the message to send
                  </a>
                }
              />
            </AlertDescription>
          </Alert>
        ) : null}

        {state.sent ? (
          <Alert>
            <AlertDescription>
              Sent to the customer automatically.
            </AlertDescription>
          </Alert>
        ) : null}

        {canSend ? (
          <div className="flex flex-wrap gap-2">
            <form action={formAction}>
              <input type="hidden" name="orderId" value={orderId} />
              <Button type="submit" className="h-11" disabled={pending}>
                <Send className="size-4" aria-hidden />
                {pending
                  ? "Preparing…"
                  : sentAt
                    ? "Send again"
                    : "Send for confirmation"}
              </Button>
            </form>

            {awaiting ? (
              <form action={markConfirmedByStaff}>
                <input type="hidden" name="orderId" value={orderId} />
                <Button type="submit" variant="outline" className="h-11">
                  <Check className="size-4" aria-hidden />
                  They said yes — mark as confirmed
                </Button>
              </form>
            ) : null}
          </div>
        ) : null}

        {confirmedAt ? (
          <form action={billAction}>
            <input type="hidden" name="orderId" value={orderId} />
            <Button
              type="submit"
              className="h-11 w-full brand-fill"
              disabled={billPending}
            >
              <Receipt className="size-4" aria-hidden />
              {billPending
                ? "Preparing…"
                : billSentAt
                  ? "Send the bill again"
                  : "Send the final bill"}
            </Button>
          </form>
        ) : null}

        {publicUrl ? (
          <p className="text-xs break-all text-muted-foreground">
            Customer link:{" "}
            <a
              href={publicUrl}
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-4"
            >
              {publicUrl}
            </a>
          </p>
        ) : null}
      </CardContent>
    </Card>
  )
}

function Step({ label, at }: { label: string; at?: string }) {
  return (
    <li className="flex items-baseline justify-between gap-3">
      <span className={at ? "" : "text-muted-foreground"}>{label}</span>
      <span className="shrink-0 text-muted-foreground tabular-nums">
        {at ?? "—"}
      </span>
    </li>
  )
}
