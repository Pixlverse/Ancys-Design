import { describe, expect, it } from "vitest"

import { formatMoney, toPaise, toRupees } from "./money"

describe("toPaise", () => {
  it("converts whole rupees", () => {
    expect(toPaise(800)).toBe(80000)
    expect(toPaise("450")).toBe(45000)
    expect(toPaise(0)).toBe(0)
  })

  it("converts rupees with paise", () => {
    expect(toPaise("800.50")).toBe(80050)
    expect(toPaise("0.05")).toBe(5)
    expect(toPaise(1250.75)).toBe(125075)
  })

  it("pads a single decimal digit", () => {
    expect(toPaise("800.5")).toBe(80050)
  })

  it("rounds half up at the third decimal without float drift", () => {
    expect(toPaise("1.005")).toBe(101)
    expect(toPaise("1.004")).toBe(100)
    expect(toPaise("0.615")).toBe(62)
  })

  it("accepts what staff paste in: symbols, grouping, whitespace", () => {
    expect(toPaise("₹1,250")).toBe(125000)
    expect(toPaise("  450  ")).toBe(45000)
    expect(toPaise("1,00,000")).toBe(10000000)
  })

  it("handles negative amounts for discounts and adjustments", () => {
    expect(toPaise("-150")).toBe(-15000)
    expect(toPaise("-0.50")).toBe(-50)
  })

  it("rejects anything that is not a plain amount", () => {
    expect(() => toPaise("eight hundred")).toThrow()
    expect(() => toPaise("")).toThrow()
    expect(() => toPaise("12.34.56")).toThrow()
    expect(() => toPaise(Number.NaN)).toThrow()
    expect(() => toPaise(Number.POSITIVE_INFINITY)).toThrow()
  })
})

describe("toRupees", () => {
  it("converts back", () => {
    expect(toRupees(80000)).toBe(800)
    expect(toRupees(80050)).toBe(800.5)
  })

  it("refuses non-integer paise, which would mean a float crept in", () => {
    expect(() => toRupees(800.5)).toThrow()
  })
})

describe("formatMoney", () => {
  it("formats whole rupees without decimals", () => {
    expect(formatMoney(80000)).toBe("₹800")
    expect(formatMoney(45000)).toBe("₹450")
    expect(formatMoney(0)).toBe("₹0")
  })

  it("groups digits the Indian way", () => {
    expect(formatMoney(125000)).toBe("₹1,250")
    expect(formatMoney(10000000)).toBe("₹1,00,000")
    expect(formatMoney(1000000000)).toBe("₹1,00,00,000")
  })

  it("shows paise when there are any", () => {
    expect(formatMoney(80050)).toBe("₹800.50")
  })

  it("formats negatives", () => {
    expect(formatMoney(-15000)).toBe("-₹150")
  })

  it("refuses non-integer paise", () => {
    expect(() => formatMoney(800.5)).toThrow()
  })
})

describe("round tripping", () => {
  it("survives a rate card edit and back", () => {
    for (const entered of ["450", "800", "600", "150", "1250.50"]) {
      const paise = toPaise(entered)
      expect(toPaise(String(toRupees(paise)))).toBe(paise)
    }
  })
})
