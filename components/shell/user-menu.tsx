"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Bell, ChevronDown, LogOut } from "lucide-react"

import { signOut } from "next-auth/react"

import { LOGIN_PATH } from "@/lib/auth.config"

export interface UserMenuProps {
  name: string
  email: string
  role: string
}

/**
 * The signed-in user, and the way out.
 *
 * Built directly rather than on a menu primitive: this holds a name, an email,
 * a role and one action, and the primitive's requirements — items collected for
 * typeahead, labels inside groups — were being broken by a plain <form> child,
 * which crashed the page on open. Four lines of content did not need it.
 */
export function UserMenu({
  name,
  email,
  role,
  unreadCount = 0,
}: UserMenuProps & { unreadCount?: number }) {
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: MouseEvent | TouchEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false)
    }

    document.addEventListener("mousedown", handlePointerDown)
    document.addEventListener("touchstart", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("mousedown", handlePointerDown)
      document.removeEventListener("touchstart", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [open])

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="relative flex h-11 items-center gap-2 rounded-full px-2 transition-colors hover:bg-muted"
      >
        <span className="flex size-8 items-center justify-center rounded-full bg-sidebar text-xs font-semibold text-sidebar-foreground">
          {initials(name)}
        </span>
        <span className="hidden text-sm font-medium sm:inline">{name}</span>
        {unreadCount > 0 ? (
          <span
            aria-hidden
            className="absolute top-1 left-7 size-2.5 rounded-full ring-2 ring-card brand-fill"
          />
        ) : null}
        <ChevronDown
          className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open ? (
        <div
          role="menu"
          aria-label="Account"
          className="absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-2xl bg-popover p-1.5 tile-float"
        >
          <div className="px-3 py-2.5">
            <p className="truncate text-sm font-semibold">{name}</p>
            <p className="truncate text-xs text-muted-foreground">{email}</p>
            <p className="mt-1.5 inline-flex rounded-full bg-muted px-2 py-0.5 text-[11px] font-semibold capitalize">
              {role}
            </p>
          </div>

          <div className="my-1 h-px bg-border" />

          {/* The bell is gone from the header, so notifications live here —
              otherwise the reminders would have no way in from most screens. */}
          <Link
            href="/notifications"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors hover:bg-accent"
          >
            <Bell className="size-4" aria-hidden />
            Notifications
            {unreadCount > 0 ? (
              <span className="ml-auto flex min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold brand-fill">
                {unreadCount > 99 ? "99+" : unreadCount}
              </span>
            ) : null}
          </Link>

          {/* Posts to Auth.js's own /api/auth/signout rather than going through
              a server action. The action's Set-Cookie did not survive the
              round trip in production: the browser was redirected to /login
              while the session cookie stayed put, so a refresh walked straight
              back into the dashboard. */}
          <button
            type="button"
            role="menuitem"
            disabled={signingOut}
            onClick={() => {
              setSigningOut(true)
              void signOut({ callbackUrl: LOGIN_PATH })
            }}
            className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-60"
          >
            <LogOut className="size-4" aria-hidden />
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      ) : null}
    </div>
  )
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  )
}
