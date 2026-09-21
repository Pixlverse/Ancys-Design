/**
 * Page-based paging for the list screens.
 *
 * Pages come from the query string rather than client state, so a page is a
 * shareable, reloadable URL and the lists keep working without JavaScript.
 */
export const PAGE_SIZE = 20

/** Customers are cards rather than table rows, so fewer fit a screen well. */
export const CUSTOMER_PAGE_SIZE = 15

export interface PageInfo {
  /** 1-based. */
  page: number
  pageSize: number
  totalItems: number
  totalPages: number
  /** For the database query. */
  skip: number
  /** 1-based range being shown, for "21–40 of 137". */
  from: number
  to: number
}

/** `?page=` is attacker-controlled, so anything odd becomes page 1. */
export function parsePage(value: string | undefined): number {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed < 1) return 1
  // Guard against ?page=999999999 turning into a huge skip.
  return Math.min(parsed, 100_000)
}

export function paginate(
  totalItems: number,
  requestedPage: number,
  pageSize: number = PAGE_SIZE
): PageInfo {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  // Asking for page 9 of 3 lands on the last page rather than on nothing.
  const page = Math.min(Math.max(requestedPage, 1), totalPages)
  const skip = (page - 1) * pageSize

  return {
    page,
    pageSize,
    totalItems,
    totalPages,
    skip,
    from: totalItems === 0 ? 0 : skip + 1,
    to: Math.min(skip + pageSize, totalItems),
  }
}

/**
 * The page numbers to show, with gaps: [1, "gap", 7, 8, 9, "gap", 42].
 * Keeps the control a fixed width however many pages there are.
 */
export function pageNumbers(
  current: number,
  total: number,
  spread = 1
): (number | "gap")[] {
  if (total <= 1) return [1]

  const wanted = new Set<number>([1, total])
  for (let page = current - spread; page <= current + spread; page++) {
    if (page >= 1 && page <= total) wanted.add(page)
  }

  const sorted = [...wanted].sort((a, b) => a - b)
  const out: (number | "gap")[] = []
  let previous = 0
  for (const page of sorted) {
    if (previous && page - previous > 1) out.push("gap")
    out.push(page)
    previous = page
  }
  return out
}
