import { endOfDay, startOfDay } from "date-fns"
import { formatInTimeZone, fromZonedTime, toZonedTime } from "date-fns-tz"

/**
 * The shop runs on IST. Timestamps are stored in UTC, but every "is this due
 * today", "what is on the calendar for the 12th" and every date on screen is a
 * question about the Indian calendar day (CLAUDE.md rule 3). Raw `new Date()`
 * comparisons answer that question wrongly for anyone whose server is not in IST —
 * which on Vercel is all of them.
 */
export const IST = "Asia/Kolkata"

/** The UTC instant at which the IST day containing `date` begins. */
export function startOfDayIST(date: Date = new Date()): Date {
  return fromZonedTime(startOfDay(toZonedTime(date, IST)), IST)
}

/** The UTC instant at which the IST day containing `date` ends (inclusive, .999). */
export function endOfDayIST(date: Date = new Date()): Date {
  return fromZonedTime(endOfDay(toZonedTime(date, IST)), IST)
}

export interface FormatDateOptions {
  /**
   * `"auto"` (the default) prints the year only when the date falls outside the
   * current IST year, which is what a busy shop screen wants: `12 Mar` for this
   * year's work, `12 Mar 2026` when it matters.
   */
  withYear?: boolean | "auto"
}

/** Formats a date for the UI: `12 Mar` or `12 Mar 2026`. Never ISO strings. */
export function formatDate(
  date: Date,
  { withYear = "auto" }: FormatDateOptions = {}
): string {
  const showYear =
    withYear === "auto"
      ? formatInTimeZone(date, IST, "yyyy") !== formatInTimeZone(new Date(), IST, "yyyy")
      : withYear

  return formatInTimeZone(date, IST, showYear ? "d MMM yyyy" : "d MMM")
}

/**
 * Turns an `<input type="date">` value ("2026-03-12") into the UTC instant at
 * which that day begins in IST. A due date is a day in the shop's calendar, not
 * an instant, so parsing it with `new Date()` — which reads it as UTC midnight —
 * would land it on the previous day for anyone reading in India.
 *
 * Returns `null` if the value is not a date.
 */
export function parseDateInputIST(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const parsed = fromZonedTime(`${value}T00:00:00`, IST)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/** The inverse, for prefilling a date input from a stored instant. */
export function toDateInputIST(date: Date): string {
  return formatInTimeZone(date, IST, "yyyy-MM-dd")
}

/** The day of the month in IST, for calendar headings: "6". */
export function dayNumberIST(date: Date): string {
  return formatInTimeZone(date, IST, "d")
}

/** The weekday in IST, for calendar headings: "Sat". */
export function weekdayIST(date: Date): string {
  return formatInTimeZone(date, IST, "EEE")
}

/** The calendar year in IST, which is what an order number is scoped to. */
export function yearIST(date: Date = new Date()): number {
  return Number(formatInTimeZone(date, IST, "yyyy"))
}

const MS_PER_DAY = 24 * 60 * 60 * 1000

/**
 * Whole IST calendar days from `from` until `target`: 0 for today, 1 for
 * tomorrow, negative for overdue. Counts day boundaries crossed, not elapsed
 * hours, so an item due at 9am tomorrow is 1 day away even at 11pm tonight.
 */
export function daysUntil(target: Date, from: Date = new Date()): number {
  const diff = startOfDayIST(target).getTime() - startOfDayIST(from).getTime()
  // IST has no daylight saving, so every day is exactly 24 hours long.
  return Math.round(diff / MS_PER_DAY)
}
