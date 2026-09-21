"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import Image from "next/image"
import { cn } from "cn"

import { NAV_ITEMS, isActiveNav } from "./nav-items"

/**
 * A floating rail rather than a flush column: it sits inset from the page edge
 * with its own radius, so the shell reads as a panel the work lives inside.
 * Hidden on phones, where MobileTabBar takes over.
 */
export function AppSidebar() {
  const pathname = usePathname()

  return (
    <aside className="sticky top-4 hidden h-[calc(100svh-2rem)] w-64 shrink-0 flex-col rounded-3xl bg-sidebar p-3 tile-float md:flex">
      {/* The shop's own mark. It is white artwork, which is why the rail is
          dark — the two were chosen together. */}
      <Link href="/dashboard" className="block px-3 py-5">
        <Image
          src="/images/ancys-logo.png"
          alt="Ancy's — Women Clothing"
          width={598}
          height={226}
          priority
          className="h-auto w-40"
        />
      </Link>

      <nav className="mt-2 flex-1 space-y-1.5">
        {NAV_ITEMS.map(({ label, href, icon: Icon }) => {
          const active = isActiveNav(pathname, href)
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-2xl px-3.5 py-3 text-sm font-medium transition-all",
                active
                  ? "brand-fill shadow-lg"
                  : "text-sidebar-foreground/65 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground"
              )}
            >
              <Icon className="size-[18px]" aria-hidden />
              {label}
            </Link>
          )
        })}
      </nav>

      <p className="px-3.5 pb-2 text-xs text-sidebar-foreground/40">
        Measure · Stitch · Deliver
      </p>
    </aside>
  )
}
