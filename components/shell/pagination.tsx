import Link from "next/link"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { pageNumbers, type PageInfo } from "@/lib/pagination"

/**
 * Server-rendered paging. Every control is a link, so a page is a shareable URL
 * and the list still works with JavaScript off.
 */
export function Pagination({
  info,
  hrefForPage,
  noun = "results",
}: {
  info: PageInfo
  hrefForPage: (page: number) => string
  /** What is being counted: "customers", "orders". */
  noun?: string
}) {
  if (info.totalItems === 0) return null

  const pages = pageNumbers(info.page, info.totalPages)
  const onlyPage = info.totalPages === 1

  return (
    <nav
      aria-label={`${noun} pages`}
      className="flex flex-wrap items-center justify-between gap-3"
    >
      <p className="text-sm text-muted-foreground tabular-nums">
        {info.from}–{info.to} of {info.totalItems} {noun}
      </p>

      {onlyPage ? null : (
        <ul className="flex items-center gap-1">
          <li>
            <Step
              href={hrefForPage(info.page - 1)}
              disabled={info.page === 1}
              label="Previous page"
            >
              <ChevronLeft className="size-4" aria-hidden />
            </Step>
          </li>

          {pages.map((page, index) =>
            page === "gap" ? (
              <li
                key={`gap-${index}`}
                aria-hidden
                className="px-1 text-sm text-muted-foreground"
              >
                …
              </li>
            ) : (
              <li key={page}>
                <Link
                  href={hrefForPage(page)}
                  aria-label={`Page ${page}`}
                  aria-current={page === info.page ? "page" : undefined}
                  className={`flex size-10 items-center justify-center rounded-full text-sm font-semibold tabular-nums transition-colors ${
                    page === info.page
                      ? "brand-fill"
                      : "bg-card text-foreground hover:bg-accent"
                  }`}
                >
                  {page}
                </Link>
              </li>
            )
          )}

          <li>
            <Step
              href={hrefForPage(info.page + 1)}
              disabled={info.page === info.totalPages}
              label="Next page"
            >
              <ChevronRight className="size-4" aria-hidden />
            </Step>
          </li>
        </ul>
      )}
    </nav>
  )
}

function Step({
  href,
  disabled,
  label,
  children,
}: {
  href: string
  disabled: boolean
  label: string
  children: React.ReactNode
}) {
  const shared =
    "flex size-10 items-center justify-center rounded-full text-sm transition-colors"

  // A disabled step is not a link at all, so it cannot be tabbed to or followed.
  if (disabled) {
    return (
      <span
        aria-disabled
        aria-label={label}
        className={`${shared} bg-muted text-muted-foreground/40`}
      >
        {children}
      </span>
    )
  }

  return (
    <Link
      href={href}
      aria-label={label}
      className={`${shared} bg-card text-foreground hover:bg-accent`}
    >
      {children}
    </Link>
  )
}
