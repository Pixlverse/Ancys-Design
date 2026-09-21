import { describe, expect, it } from "vitest"

import { formatPhone, normalizePhone, toPhoneSearchDigits } from "./phone"

describe("normalizePhone", () => {
  it("normalises the shapes staff type", () => {
    expect(normalizePhone("9876543210")).toBe("+919876543210")
    expect(normalizePhone("09876543210")).toBe("+919876543210")
    expect(normalizePhone("+91 98765 43210")).toBe("+919876543210")
    expect(normalizePhone("+91-98765-43210")).toBe("+919876543210")
    expect(normalizePhone("919876543210")).toBe("+919876543210")
    expect(normalizePhone("+919876543210")).toBe("+919876543210")
    expect(normalizePhone("(+91) 98765 43210")).toBe("+919876543210")
    expect(normalizePhone("  9876543210  ")).toBe("+919876543210")
  })

  it("is idempotent, so re-saving a customer cannot corrupt the key", () => {
    const once = normalizePhone("98765 43210")
    expect(once).not.toBeNull()
    expect(normalizePhone(once as string)).toBe(once)
  })

  it("accepts an explicit international number", () => {
    expect(normalizePhone("+971501234567")).toBe("+971501234567")
    expect(normalizePhone("+1 415 555 0123")).toBe("+14155550123")
  })

  it("rejects numbers we could not send a message to", () => {
    expect(normalizePhone("")).toBeNull()
    expect(normalizePhone("   ")).toBeNull()
    expect(normalizePhone("12345")).toBeNull()
    expect(normalizePhone("98765432100000")).toBeNull()
    expect(normalizePhone("abcdefghij")).toBeNull()
    // Indian mobiles start 6-9; a landline cannot receive WhatsApp.
    expect(normalizePhone("1234567890")).toBeNull()
    expect(normalizePhone("5876543210")).toBeNull()
  })

  it("rejects a plus followed by a bad country code", () => {
    expect(normalizePhone("+0123456789")).toBeNull()
  })
})

describe("formatPhone", () => {
  it("groups Indian numbers for reading", () => {
    expect(formatPhone("+919876543210")).toBe("+91 98765 43210")
  })

  it("leaves other numbers alone rather than grouping them wrongly", () => {
    expect(formatPhone("+971501234567")).toBe("+971501234567")
  })
})

describe("toPhoneSearchDigits", () => {
  it("strips whatever staff type around the digits", () => {
    expect(toPhoneSearchDigits("98765 43210")).toBe("9876543210")
    expect(toPhoneSearchDigits("+91 98765")).toBe("98765")
    expect(toPhoneSearchDigits("098765")).toBe("98765")
    expect(toPhoneSearchDigits("+91-98765-43210")).toBe("9876543210")
  })

  it("keeps a partial that happens to start with the country code", () => {
    // "91" alone is a plausible start of a number, not a country code to drop.
    expect(toPhoneSearchDigits("91")).toBe("91")
    expect(toPhoneSearchDigits("919876")).toBe("9876")
  })

  it("returns null when there is nothing numeric", () => {
    expect(toPhoneSearchDigits("")).toBeNull()
    expect(toPhoneSearchDigits("Meera")).toBeNull()
    expect(toPhoneSearchDigits("+")).toBeNull()
    expect(toPhoneSearchDigits("0")).toBeNull()
  })
})
