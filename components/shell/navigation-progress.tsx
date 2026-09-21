"use client"

import { useEffect, useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"

import { StitchLoader } from "./stitch-loader"

/**
 * A global "something is happening" indicator.
 *
 * Route-segment loading.tsx files only appear when a navigation actually
 * suspends — if Next has already prefetched the payload, or the wait is a server
 * action rather than a route change, nothing shows and the app looks frozen.
 *
 * This starts on the interaction (a link click or a form submit) and stops when
 * the URL has actually changed, so it covers both cases. It reads the DOM rather
 * than wrapping every Link, which means it works for links added later too.
 */
export function NavigationProgress() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [pending, setPending] = useState(false)

  // The navigation landed: whatever we started, it is over.
  useEffect(() => {
    setPending(false)
  }, [pathname, searchParams])

  useEffect(() => {
    function handleClick(event: MouseEvent) {
      // Let the browser handle anything that is not a plain left click.
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return
      }

      const anchor = (event.target as HTMLElement | null)?.closest?.("a")
      if (!anchor) return

      const href = anchor.getAttribute("href")
      if (!href) return

      // Not navigations: new tabs, downloads, phone calls, in-page anchors.
      if (
        anchor.target === "_blank" ||
        anchor.hasAttribute("download") ||
        href.startsWith("#") ||
        href.startsWith("tel:") ||
        href.startsWith("mailto:")
      ) {
        return
      }

      const url = new URL(anchor.href, window.location.href)
      if (url.origin !== window.location.origin) return
      // Clicking the page you are already on changes nothing.
      if (url.pathname + url.search === window.location.pathname + window.location.search) {
        return
      }

      setPending(true)
    }

    function handleSubmit(event: SubmitEvent) {
      if (event.defaultPrevented) return
      setPending(true)
    }

    // Capture phase, so it runs before React's own handlers stop propagation.
    document.addEventListener("click", handleClick, true)
    document.addEventListener("submit", handleSubmit, true)
    // Back and forward are navigations too.
    window.addEventListener("popstate", () => setPending(true))

    return () => {
      document.removeEventListener("click", handleClick, true)
      document.removeEventListener("submit", handleSubmit, true)
    }
  }, [])

  /**
   * A server action that revalidates in place never changes the URL, so the
   * effect above never fires for it — the document is watched instead.
   *
   * This used to arm the observer after a delay, which was a bug: a fast action
   * finished re-rendering *before* the observer started, so no mutation was ever
   * seen and the loader sat there until a 15-second timeout. Actions that take
   * 10ms appeared to take 15 seconds.
   *
   * Now it observes immediately and settles when mutations stop — the page has
   * finished changing — with a floor so a very fast action still reads as a
   * deliberate flash rather than a flicker.
   */
  useEffect(() => {
    if (!pending) return

    const startedAt = Date.now()
    const MINIMUM_VISIBLE = 350
    const SETTLED_AFTER = 180

    let settleTimer: number | undefined
    let done = false

    const release = () => {
      if (done) return
      done = true
      setPending(false)
    }

    const scheduleRelease = () => {
      window.clearTimeout(settleTimer)
      const elapsed = Date.now() - startedAt
      const wait = Math.max(SETTLED_AFTER, MINIMUM_VISIBLE - elapsed)
      settleTimer = window.setTimeout(release, wait)
    }

    const observer = new MutationObserver(scheduleRelease)
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    })

    // If nothing in the document changes at all, do not hang.
    const cap = window.setTimeout(release, 8_000)

    return () => {
      window.clearTimeout(settleTimer)
      window.clearTimeout(cap)
      observer.disconnect()
    }
  }, [pending])

  if (!pending) return null

  return (
    <>
      <div
        role="status"
        aria-live="polite"
        className="fixed inset-x-0 top-0 z-[100] h-1 overflow-hidden bg-primary/15"
      >
        <span className="nav-progress-bar block h-full w-2/5 rounded-r-full brand-fill" />
        <span className="sr-only">Loading</span>
      </div>

      {/* Centre of the screen, with the page softened behind it. */}
      <div className="fixed inset-0 z-[99] flex items-center justify-center bg-background/45 backdrop-blur-sm">
        <span className="flex flex-col items-center gap-1.5 rounded-3xl bg-card px-8 py-6 tile-float">
          <StitchLoader className="h-11 w-36 text-primary" />
          <span className="text-xs font-semibold tracking-wide text-muted-foreground">
            Stitching that together…
          </span>
        </span>
      </div>
    </>
  )
}
