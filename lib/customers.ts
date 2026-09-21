import type { PipelineStage } from "mongoose"

import { toPhoneSearchDigits } from "@/lib/phone"

/**
 * Customer search is phone-first, name-second (CLAUDE.md section 8): staff
 * usually have the number in front of them, and it is the identity key.
 */

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

export interface CustomerSearch {
  /** The digits being matched against stored E.164 numbers, if any. */
  phoneDigits: string | null
  filter: Record<string, unknown>
}

export function buildCustomerSearch(rawQuery: string): CustomerSearch {
  const query = rawQuery.trim()
  const base = { isDeleted: false }

  if (query === "") return { phoneDigits: null, filter: base }

  const phoneDigits = toPhoneSearchDigits(query)
  const conditions: Record<string, unknown>[] = []

  if (phoneDigits) {
    conditions.push({ phone: { $regex: escapeRegExp(phoneDigits) } })
  }

  // A number-only query is a phone search; anything with letters is a name.
  if (/[^\d\s+()-]/.test(query)) {
    conditions.push({ name: { $regex: escapeRegExp(query), $options: "i" } })
  }

  if (conditions.length === 0) return { phoneDigits, filter: base }

  return { phoneDigits, filter: { ...base, $or: conditions } }
}

/**
 * Orders results so phone matches come before name matches, then alphabetically.
 * Mongo cannot express this ranking cheaply, and a shop's result set is small.
 */
export function comparePhoneFirst(
  a: { name: string; phone: string },
  b: { name: string; phone: string },
  phoneDigits: string | null
): number {
  if (phoneDigits) {
    const aMatch = a.phone.includes(phoneDigits) ? 0 : 1
    const bMatch = b.phone.includes(phoneDigits) ? 0 : 1
    if (aMatch !== bMatch) return aMatch - bMatch
  }
  return a.name.localeCompare(b.name)
}

/**
 * Ranks phone matches above name matches, inside the database.
 *
 * This used to be done in JavaScript after fetching, which was fine when the
 * whole result set came back at once. With paging it is not: sorting a single
 * page would rank within that page, so a phone match on page two would sit
 * below a name match on page one.
 */
export function customerRankStages(
  phoneDigits: string | null
): PipelineStage[] {
  if (!phoneDigits) return [{ $sort: { name: 1 } }]

  return [
    {
      $addFields: {
        phoneRank: {
          $cond: [
            {
              $regexMatch: {
                input: "$phone",
                regex: escapeRegExp(phoneDigits),
              },
            },
            0,
            1,
          ],
        },
      },
    },
    { $sort: { phoneRank: 1, name: 1 } },
  ]
}
