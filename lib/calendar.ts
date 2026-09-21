import {
  addDays,
  endOfMonth,
  endOfWeek,
  startOfMonth,
  startOfWeek,
} from "date-fns"
import { fromZonedTime, toZonedTime } from "date-fns-tz"

import { IST, daysUntil, endOfDayIST, startOfDayIST } from "@/lib/dates"
import type { OrderItemStatus } from "@/schemas/order"

/**
 * Calendar maths, entirely in IST (CLAUDE.md rule 3). Every boundary here is a
 * day in the shop's calendar converted to a UTC instant for querying — never a
 * raw `new Date()` comparison.
 */

/**
 * The week starts on Monday: the shop works Monday to Saturday, so the working
 * week reads as one block rather than being split across two rows.
 */
const WEEK_STARTS_ON = 1 as const

export interface DateRange {
  start: Date
  end: Date
}

function istRange(anchor: Date, fn: (zoned: Date) => DateRange): DateRange {
  const zoned = toZonedTime(anchor, IST)
  const { start, end } = fn(zoned)
  return { start: fromZonedTime(start, IST), end: fromZonedTime(end, IST) }
}

export function dayRangeIST(anchor: Date): DateRange {
  return { start: startOfDayIST(anchor), end: endOfDayIST(anchor) }
}

export function weekRangeIST(anchor: Date): DateRange {
  return istRange(anchor, (zoned) => ({
    start: startOfWeek(zoned, { weekStartsOn: WEEK_STARTS_ON }),
    end: endOfWeek(zoned, { weekStartsOn: WEEK_STARTS_ON }),
  }))
}

export function monthRangeIST(anchor: Date): DateRange {
  return istRange(anchor, (zoned) => ({
    start: startOfMonth(zoned),
    end: endOfMonth(zoned),
  }))
}

/**
 * The range a month *view* actually shows, including the days either side that
 * fill the first and last rows. This is what the query must cover — otherwise
 * those cells silently render empty.
 */
export function monthGridRangeIST(anchor: Date): DateRange {
  return istRange(anchor, (zoned) => ({
    start: startOfWeek(startOfMonth(zoned), { weekStartsOn: WEEK_STARTS_ON }),
    end: endOfWeek(endOfMonth(zoned), { weekStartsOn: WEEK_STARTS_ON }),
  }))
}

/** The grid as weeks of seven IST day-start instants. */
export function monthGridIST(anchor: Date): Date[][] {
  const { start } = monthGridRangeIST(anchor)
  const zonedStart = toZonedTime(start, IST)

  const weeks: Date[][] = []
  for (let week = 0; week < 6; week++) {
    const days: Date[] = []
    for (let day = 0; day < 7; day++) {
      days.push(fromZonedTime(addDays(zonedStart, week * 7 + day), IST))
    }
    weeks.push(days)
  }
  return weeks
}

export type DueTone = "delivered" | "overdue" | "today" | "soon" | "later"

/**
 * How urgent a garment looks on the calendar. Delivered work is faded whatever
 * its date — it is done, and colouring it red would bury the work that is not.
 */
export function dueTone(
  dueDate: Date,
  itemStatus: OrderItemStatus,
  from: Date = new Date()
): DueTone {
  if (itemStatus === "delivered") return "delivered"

  const days = daysUntil(dueDate, from)
  if (days < 0) return "overdue"
  if (days === 0) return "today"
  if (days <= 3) return "soon"
  return "later"
}

export const DUE_TONE_CLASSES: Record<DueTone, string> = {
  overdue: "bg-red-100 text-red-900 ring-red-300 dark:bg-red-950 dark:text-red-100 dark:ring-red-800",
  today: "bg-orange-100 text-orange-900 ring-orange-300 dark:bg-orange-950 dark:text-orange-100 dark:ring-orange-800",
  soon: "bg-yellow-50 text-yellow-900 ring-yellow-200 dark:bg-yellow-950 dark:text-yellow-100 dark:ring-yellow-800",
  later: "bg-muted text-foreground ring-border",
  delivered: "bg-muted/40 text-muted-foreground/70 ring-border line-through",
}

export const DUE_TONE_LABELS: Record<DueTone, string> = {
  overdue: "Overdue",
  today: "Due today",
  soon: "Due within 3 days",
  later: "Later",
  delivered: "Delivered",
}
