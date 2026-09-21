import { yearIST } from "@/lib/dates"
import { nextSequence } from "@/models/counter"

/**
 * Order numbers are human-readable and sequential within the year: `2026-0142`.
 * Staff read them out over the phone, so they stay short and padded.
 */

/** The counter key an order created at `date` belongs to. */
export function orderNoKey(date: Date = new Date()): string {
  return `orderNo:${yearIST(date)}`
}

/**
 * Formats a year and sequence into an order number. Padded to four digits, but
 * never truncated — a shop that passes 9999 orders in a year gets `2026-10000`
 * rather than a number that collides with an earlier one.
 */
export function formatOrderNo(year: number, seq: number): string {
  return `${year}-${String(seq).padStart(4, "0")}`
}

/** Allocates the next order number. Safe under concurrent creation. */
export async function nextOrderNo(date: Date = new Date()): Promise<string> {
  const seq = await nextSequence(orderNoKey(date))
  return formatOrderNo(yearIST(date), seq)
}
