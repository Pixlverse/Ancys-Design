"use client"

import { useFormStatus } from "react-dom"
import { Loader2 } from "lucide-react"

import { assignAssignee } from "@/app/(portal)/orders/[id]/actions"

export interface AssigneeOption {
  id: string
  name: string
}

/**
 * Who is making this garment. Changing the dropdown saves immediately — a
 * separate Assign button was one tap too many, and left the screen showing a
 * name that was not yet true.
 */
export function AssignAssignee({
  orderId,
  itemId,
  assignedTo,
  assignees,
}: {
  orderId: string
  itemId: string
  assignedTo?: string
  assignees: AssigneeOption[]
}) {
  if (assignees.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Nobody to assign to yet.{" "}
        <a href="/settings/assignees" className="underline underline-offset-4">
          Add assignees in Settings
        </a>
        .
      </p>
    )
  }

  return (
    <form action={assignAssignee}>
      <input type="hidden" name="orderId" value={orderId} />
      <input type="hidden" name="itemId" value={itemId} />
      <AssigneeSelect
        itemId={itemId}
        assignedTo={assignedTo}
        assignees={assignees}
      />
    </form>
  )
}

/** Split out so useFormStatus can read the enclosing form's pending state. */
function AssigneeSelect({
  itemId,
  assignedTo,
  assignees,
}: {
  itemId: string
  assignedTo?: string
  assignees: AssigneeOption[]
}) {
  const { pending } = useFormStatus()

  return (
    <div className="flex items-center gap-2.5">
      <label className="sr-only" htmlFor={`${itemId}-assignee`}>
        Assign to
      </label>
      <select
        // Remount when the assignment changes, and opt out of the browser's
        // form restore. An uncontrolled select otherwise keeps whatever the DOM
        // last held — and a stale value here would reassign the wrong person.
        key={assignedTo ?? "unassigned"}
        id={`${itemId}-assignee`}
        name="assigneeId"
        defaultValue={assignedTo ?? ""}
        autoComplete="off"
        disabled={pending}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="h-11 rounded-xl border border-input bg-transparent px-3 text-sm disabled:opacity-60"
      >
        <option value="">{assignedTo ? "Unassign" : "Nobody yet"}</option>
        {assignees.map((assignee) => (
          <option key={assignee.id} value={assignee.id}>
            {assignee.name}
          </option>
        ))}
      </select>

      {pending ? (
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          Saving…
        </span>
      ) : null}

      {/* Without JavaScript the change event cannot submit, so keep a way out. */}
      <noscript>
        <button
          type="submit"
          className="h-11 rounded-xl border border-input px-3 text-sm"
        >
          Assign
        </button>
      </noscript>
    </div>
  )
}
