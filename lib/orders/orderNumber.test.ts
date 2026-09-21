import { describe, expect, it } from "vitest"

import { formatOrderNo, orderNoKey } from "./orderNumber"

describe("formatOrderNo", () => {
  it("pads to four digits", () => {
    expect(formatOrderNo(2026, 1)).toBe("2026-0001")
    expect(formatOrderNo(2026, 42)).toBe("2026-0042")
    expect(formatOrderNo(2026, 142)).toBe("2026-0142")
    expect(formatOrderNo(2026, 9999)).toBe("2026-9999")
  })

  it("never truncates past four digits, so numbers cannot collide", () => {
    expect(formatOrderNo(2026, 10000)).toBe("2026-10000")
    expect(formatOrderNo(2026, 123456)).toBe("2026-123456")
  })

  it("sorts lexicographically in creation order within a year", () => {
    const numbers = [1, 2, 9, 10, 99, 100, 1000].map((seq) =>
      formatOrderNo(2026, seq)
    )
    expect([...numbers].sort()).toEqual(numbers)
  })
})

describe("orderNoKey", () => {
  it("scopes the counter to the IST year", () => {
    expect(orderNoKey(new Date("2026-03-12T06:00:00.000Z"))).toBe("orderNo:2026")
  })

  it("starts a new sequence on the Indian new year", () => {
    // 22:30 IST on 31 Dec 2025 versus 00:30 IST on 1 Jan 2026.
    expect(orderNoKey(new Date("2025-12-31T17:00:00.000Z"))).toBe("orderNo:2025")
    expect(orderNoKey(new Date("2025-12-31T19:00:00.000Z"))).toBe("orderNo:2026")
  })
})
