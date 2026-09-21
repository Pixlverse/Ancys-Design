import { redirect } from "next/navigation"

import { AppHeader } from "@/components/shell/app-header"
import { AppSidebar } from "@/components/shell/app-sidebar"
import { MobileTabBar } from "@/components/shell/mobile-tab-bar"
import { auth } from "@/lib/auth"
import { LOGIN_PATH } from "@/lib/auth.config"

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Middleware already guards these paths; this is the second lock, so that a
  // misconfigured matcher can never render portal content to a stranger.
  const session = await auth()
  if (!session?.user) redirect(LOGIN_PATH)

  return (
    <div className="min-h-svh bg-background xl:flex xl:gap-5 xl:p-5">
      <AppSidebar />

      <div className="flex min-w-0 flex-1 flex-col gap-4 p-3 sm:gap-5 sm:p-4 xl:p-0">
        <AppHeader
          greeting={`Hello ${(session.user.name ?? "there").split(" ")[0]}`}
          user={{
            name: session.user.name ?? "Staff",
            email: session.user.email ?? "",
            role: session.user.role,
          }}
        />
        {/* Bottom padding keeps content clear of the floating bar, which now
            carries the navigation on tablets too. */}
        <main className="flex-1 pb-28 xl:pb-2">{children}</main>
      </div>

      <MobileTabBar />
    </div>
  )
}
