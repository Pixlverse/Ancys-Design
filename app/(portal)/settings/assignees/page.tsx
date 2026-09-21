import Link from "next/link"
import { Phone, Users } from "lucide-react"
import type { Metadata } from "next"

import { setAssigneeActive } from "./actions"
import { AssigneeForm } from "@/components/domain/AssigneeForm"
import { EmptyState } from "@/components/shell/empty-state"
import { Pagination } from "@/components/shell/pagination"
import { StatusPill } from "@/components/domain/StatusPill"
import { INACTIVE_TONE } from "@/lib/orders/labels"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { connectToDatabase } from "@/lib/db"
import { paginate, parsePage } from "@/lib/pagination"
import { formatPhone } from "@/lib/phone"
import { Assignee } from "@/models/assignee"

export const metadata: Metadata = { title: "Assignees · Ancys Design" }

export default async function AssigneesPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const { page: pageParam } = await searchParams
  await connectToDatabase()
  const info = paginate(
    await Assignee.countDocuments({ isDeleted: false }),
    parsePage(pageParam)
  )
  const assignees = await Assignee.find({ isDeleted: false })
    .sort({ name: 1 })
    .skip(info.skip)
    .limit(info.pageSize)
    .lean()

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Assignees</h1>
        <p className="text-sm text-muted-foreground">
          The people work is given to. They do not sign in — this is just so a
          garment can be assigned and you can ring them.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Add someone</CardTitle>
        </CardHeader>
        <CardContent>
          <AssigneeForm />
        </CardContent>
      </Card>

      {assignees.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nobody on the list yet"
          description="Add the tailors and helpers this shop gives work to. Their names then appear on every garment."
        />
      ) : (
        <ul className="divide-y divide-border/60 overflow-hidden rounded-3xl bg-card tile-float">
          {assignees.map((assignee) => {
            const id = String(assignee._id)
            return (
              <li
                key={id}
                className="flex min-h-16 flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{assignee.name}</span>
                    {assignee.isActive ? null : (
                      <StatusPill tone={INACTIVE_TONE}>Inactive</StatusPill>
                    )}
                  </div>
                  {assignee.phone ? (
                    <p className="text-sm text-muted-foreground tabular-nums">
                      {formatPhone(assignee.phone)}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground/70">
                      No phone number
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {assignee.phone ? (
                    <Button
                      variant="outline"
                      className="h-11"
                      nativeButton={false}
                      render={
                        <a href={`tel:${assignee.phone}`}>
                          <Phone className="size-4" aria-hidden />
                          Call
                        </a>
                      }
                    />
                  ) : null}
                  <form action={setAssigneeActive}>
                    <input type="hidden" name="id" value={id} />
                    <input
                      type="hidden"
                      name="isActive"
                      value={assignee.isActive ? "false" : "true"}
                    />
                    <Button type="submit" variant="outline" className="h-11">
                      {assignee.isActive ? "Deactivate" : "Activate"}
                    </Button>
                  </form>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      <Pagination
        info={info}
        noun="assignees"
        hrefForPage={(page) =>
          page > 1 ? `/settings/assignees?page=${page}` : "/settings/assignees"
        }
      />

      <Button
        variant="ghost"
        className="h-11"
        nativeButton={false}
        render={<Link href="/settings">Back to settings</Link>}
      />
    </div>
  )
}
