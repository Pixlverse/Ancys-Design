/**
 * Money is stored as integer paise everywhere in this codebase (CLAUDE.md rule 1).
 * Rupees only exist at the edges: what staff type into a form, and what we print
 * on a screen or an invoice. Conversion happens here and nowhere else.
 */

const RUPEE_PATTERN = /^-?\d+(\.\d+)?$/

const displayFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
})

const displayFormatterWithPaise = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/**
 * Parses a rupee amount into integer paise. Accepts what staff actually type:
 * `800`, `800.50`, `₹1,250`, ` 450 `.
 *
 * Parsing goes through the decimal string rather than `value * 100` so that
 * amounts like 1.005 do not land on the wrong side of a float rounding error.
 * Throws on anything that is not a plain decimal amount — callers should be
 * validating with zod first, so reaching here with junk is a bug, not input.
 */
export function toPaise(rupees: number | string): number {
  const cleaned = String(rupees).trim().replace(/[₹,\s]/g, "")

  if (!RUPEE_PATTERN.test(cleaned)) {
    throw new Error(`Not a valid rupee amount: ${JSON.stringify(rupees)}`)
  }

  const isNegative = cleaned.startsWith("-")
  const [whole, fraction = ""] = cleaned.replace("-", "").split(".")

  const paise = Number(whole) * 100 + Number(`${fraction}00`.slice(0, 2))
  const roundUp = Number(fraction[2] ?? "0") >= 5
  const total = roundUp ? paise + 1 : paise

  if (!Number.isSafeInteger(total)) {
    throw new Error(`Rupee amount out of range: ${JSON.stringify(rupees)}`)
  }

  return isNegative ? -total : total
}

/**
 * Paise back to a rupee number. For display and for pre-filling form inputs only —
 * never do arithmetic on the result.
 */
export function toRupees(paise: number): number {
  assertPaise(paise)
  return paise / 100
}

/**
 * Formats paise for display with Indian digit grouping: `80000` -> `₹800`,
 * `125000` -> `₹1,250`, `10000000` -> `₹1,00,000`.
 *
 * Whole rupees are shown without decimals because that is how the shop quotes
 * prices; a stray paise amount still shows both digits rather than lying.
 */
export function formatMoney(paise: number): string {
  assertPaise(paise)
  const formatter =
    paise % 100 === 0 ? displayFormatter : displayFormatterWithPaise
  return formatter.format(paise / 100)
}

function assertPaise(paise: number): void {
  if (!Number.isInteger(paise)) {
    throw new Error(`Money must be integer paise, received ${paise}`)
  }
}
