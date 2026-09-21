/**
 * The phone number is the customer's identity key (CLAUDE.md rule 2) and the
 * address WhatsApp messages go to, so it is stored in one canonical shape: E.164.
 * Everything staff might type gets funnelled through `normalizePhone` on the way in.
 */

const DEFAULT_COUNTRY_CODE = "91"

/** Indian mobile numbers are ten digits starting 6-9. Landlines cannot take WhatsApp. */
const INDIAN_MOBILE = /^[6-9]\d{9}$/

/** E.164 allows up to 15 digits, with a country code that never starts with 0. */
const E164 = /^[1-9]\d{7,14}$/

/**
 * Normalises a typed phone number to E.164, or returns `null` if it is not a
 * number we can send to.
 *
 * Handles the shapes staff actually type:
 *   `9876543210`, `09876543210`, `+91 98765 43210`, `+91-98765-43210`,
 *   `919876543210`, `(+91) 98765 43210`
 *
 * A leading `+` is taken at face value, so customers with a non-Indian number can
 * be stored by typing the full international form. Anything else is assumed Indian.
 */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim()
  if (trimmed === "") return null

  const hasPlus = trimmed.replace(/[\s()-]/g, "").startsWith("+")
  const digits = trimmed.replace(/\D/g, "")
  if (digits === "") return null

  if (hasPlus) {
    return E164.test(digits) ? `+${digits}` : null
  }

  // 09876543210 — the trunk prefix used when dialling domestically.
  const withoutTrunkPrefix = digits.replace(/^0+/, "")

  if (INDIAN_MOBILE.test(withoutTrunkPrefix)) {
    return `+${DEFAULT_COUNTRY_CODE}${withoutTrunkPrefix}`
  }

  // 919876543210 — country code typed without the plus.
  if (withoutTrunkPrefix.startsWith(DEFAULT_COUNTRY_CODE)) {
    const national = withoutTrunkPrefix.slice(DEFAULT_COUNTRY_CODE.length)
    if (INDIAN_MOBILE.test(national)) {
      return `+${DEFAULT_COUNTRY_CODE}${national}`
    }
  }

  return null
}

/**
 * Formats a stored E.164 number for reading: `+919876543210` -> `+91 98765 43210`.
 * Non-Indian numbers are returned unchanged rather than grouped wrongly.
 */
export function formatPhone(e164: string): string {
  const match = /^\+91(\d{5})(\d{5})$/.exec(e164)
  if (!match) return e164
  return `+91 ${match[1]} ${match[2]}`
}

/**
 * Reduces a search box's contents to the digits worth matching against a stored
 * E.164 number. Staff type phone numbers every way imaginable — `98765 43210`,
 * `+91 98765`, `098765` — and all of them should find the same customer.
 *
 * Returns `null` when there is nothing numeric to search on.
 */
export function toPhoneSearchDigits(query: string): string | null {
  const digits = query.replace(/\D/g, "")
  if (digits === "") return null

  // Drop a country code or trunk prefix the customer's stored number also has,
  // but only when something is left to match on.
  const withoutTrunk = digits.replace(/^0+/, "")
  const withoutCountry =
    withoutTrunk.length > DEFAULT_COUNTRY_CODE.length &&
    withoutTrunk.startsWith(DEFAULT_COUNTRY_CODE)
      ? withoutTrunk.slice(DEFAULT_COUNTRY_CODE.length)
      : withoutTrunk

  return withoutCountry === "" ? null : withoutCountry
}
