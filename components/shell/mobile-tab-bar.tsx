"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "cn"

import { NAV_ITEMS, isActiveNav } from "./nav-items"

/**
 * A floating pill rather than a flush bar. Staff use this one-handed in the
 * shop, so the targets stay full height and the active one is unmistakable.
 */
export function MobileTabBar() {
  const pathname = usePathname()

  return (
    <nav className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 gap-1 rounded-[1.75rem] bg-sidebar p-1.5 tile-float pb-[calc(0.375rem+env(safe-area-inset-bottom))] md:hidden">
      {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
        const active = isActiveNav(pathname, href)
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-14 flex-col items-center justify-center gap-1 rounded-[1.4rem] text-[10px] font-medium transition-all",
              active
                ? "brand-fill"
                : "text-sidebar-foreground/60 active:bg-sidebar-accent/70"
            )}
          >
            <Icon className="size-[18px]" aria-hidden />
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
