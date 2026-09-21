import Link from "next/link"
import { BellOff, Check } from "lucide-react"
import type { Metadata } from "next"

import {
  markAllNotificationsRead,
  markNotificationRead,
} from "./actions"
import { EmptyState } from "@/components/shell/empty-state"
import { Pagination } from "@/components/shell/pagination"
import { StatusPill } from "@/components/domain/StatusPill"
import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/dates"
import { connectToDatabase } from "@/lib/db"
import { paginate, parsePage } from "@/lib/pagination"
import { Notification } from "@/models/notification"
import {
  NOTIFICATION_TYPE_LABELS,
  NOTIFICATION_TYPE_TONES,
} from "@/schemas/notification"

export const metadata: Metadata = { title: "Notifications · Ancys Design" }


export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string; page?: string }>
}) {
  const { show, page: pageParam } = await searchParams
  const showAll = show === "all"
  const filter = showAll ? {} : { isRead: false }

  await connectToDatabase()
  const info = paginate(
    await Notification.countDocuments(filter),
    parsePage(pageParam)
  )
  const notifications = await Notification.find(filter)
    .sort({ isRead: 1, createdAt: -1 })
    .skip(info.skip)
    .limit(info.pageSize)
    .lean()

  const unread = await Notification.countDocuments({ isRead: false })

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Notifications</h1>
          <p className="text-sm text-muted-foreground">
            {unread === 0
              ? "Nothing needs your attention."
              : `${unread} unread.`}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            variant="ghost"
            className="h-11"
            nativeButton={false}
            render={
              <Link href={showAll ? "/notifications" : "/notifications?show=all"}>
                {showAll ? "Unread only" : "Show all"}
              </Link>
            }
          />
          {unread > 0 ? (
            <form action={markAllNotificationsRead}>
              <Button type="submit" variant="outline" className="h-11">
                <Check className="size-4" aria-hidden />
                Mark all as read
              </Button>
            </form>
          ) : null}
        </div>
      </div>

      {notifications.length === 0 ? (
        <EmptyState
          icon={BellOff}
          title={showAll ? "No notifications yet" : "Nothing unread"}
          description={
            showAll
              ? "Reminders about due dates and unanswered orders appear here each morning."
              : "Everything has been seen. Reminders arrive each morning at 7."
          }
        />
      ) : (
        <ul className="divide-y divide-border/60 overflow-hidden rounded-3xl bg-card tile-float">
          {notifications.map((notification) => (
            <li
              key={String(notification._id)}
              className={`flex flex-wrap items-center gap-3 px-4 py-3 ${
                notification.isRead ? "opacity-60" : ""
              }`}
            >
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusPill tone={NOTIFICATION_TYPE_TONES[notification.type]}>
                    {NOTIFICATION_TYPE_LABELS[notification.type]}
                  </StatusPill>
                  <span className="text-xs text-muted-foreground">
                    {formatDate(notification.createdAt)}
                  </span>
                </div>
                <Link
                  href={`/orders/${String(notification.orderId)}`}
                  className="block hover:underline"
                >
                  {notification.message}
                </Link>
              </div>

              {notification.isRead ? null : (
                <form action={markNotificationRead}>
                  <input
                    type="hidden"
                    name="id"
                    value={String(notification._id)}
                  />
                  <Button type="submit" variant="outline" className="h-11">
                    <Check className="size-4" aria-hidden />
                    Read
                  </Button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}

      <Pagination
        info={info}
        noun="notifications"
        hrefForPage={(page) =>
          `/notifications?${new URLSearchParams({
            ...(showAll ? { show: "all" } : {}),
            ...(page > 1 ? { page: String(page) } : {}),
          })}`
        }
      />
    </div>
  )
}
