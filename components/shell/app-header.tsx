import Image from "next/image"

import { UserMenu, type UserMenuProps } from "./user-menu"
import { connectToDatabase } from "@/lib/db"
import { Notification } from "@/models/notification"

/**
 * A floating bar that matches the rail: rounded, shadowed, sitting on the page
 * rather than ruled off from it.
 *
 * On a phone it carries the mark and nothing else — the greeting was being
 * truncated to "Hell…" between the logo and the controls, which is worse than
 * no greeting at all. It keeps the mark up to xl, because the rail that
 * otherwise shows it is hidden on tablets.
 */
export async function AppHeader({
  user,
  greeting,
}: {
  user: UserMenuProps
  greeting?: string
}) {
  await connectToDatabase()
  const unread = await Notification.countDocuments({ isRead: false })

  return (
    <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-4 rounded-3xl bg-card px-4 py-2.5 tile-float md:px-6 xl:top-4">
      <div className="flex min-w-0 items-center gap-3">
        {/* The rail is hidden on phones, so the mark lives here instead. On a
            light header the white artwork needs a dark chip behind it. */}
        <span className="flex items-center rounded-xl bg-sidebar px-2.5 py-2 xl:hidden">
          <Image
            src="/images/ancys-logo.png"
            alt="Ancy's"
            width={598}
            height={226}
            className="h-auto w-20"
          />
        </span>

        <div className="hidden min-w-0 md:block">
          <p className="truncate text-base font-semibold md:text-lg">
            {greeting ?? "Ancy's"}
          </p>
          <p className="text-xs text-muted-foreground">
            Measurements, orders and due dates in one place.
          </p>
        </div>
      </div>

      <UserMenu {...user} unreadCount={unread} />
    </header>
  )
}
