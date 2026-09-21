"use client"

import { useActionState } from "react"
import { UserPlus } from "lucide-react"

import {
  createAssignee,
  type AssigneeFormState,
} from "@/app/(portal)/settings/assignees/actions"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const initialState: AssigneeFormState = {}

/** Name and phone, nothing else — adding someone should take ten seconds. */
export function AssigneeForm() {
  const [state, formAction, pending] = useActionState(
    createAssignee,
    initialState
  )

  return (
    <form action={formAction} className="space-y-4" key={state.added ?? "new"}>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="assignee-name">Name</Label>
          <Input
            id="assignee-name"
            name="name"
            className="h-11"
            autoComplete="off"
            placeholder="Rajan"
            required
          />
          {state.fieldErrors?.name ? (
            <p className="text-sm text-destructive">{state.fieldErrors.name}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <Label htmlFor="assignee-phone">
            Phone <span className="text-muted-foreground">(optional)</span>
          </Label>
          <Input
            id="assignee-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            className="h-11"
            autoComplete="off"
            placeholder="98765 43210"
          />
          {state.fieldErrors?.phone ? (
            <p className="text-sm text-destructive">{state.fieldErrors.phone}</p>
          ) : null}
        </div>
      </div>

      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      {state.added ? (
        <Alert>
          <AlertDescription>{state.added} was added.</AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" className="h-11" disabled={pending}>
        <UserPlus className="size-4" aria-hidden />
        {pending ? "Adding…" : "Add assignee"}
      </Button>
    </form>
  )
}
