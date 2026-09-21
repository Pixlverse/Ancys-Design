import { describe, expect, it } from "vitest"

import { calculateTotals } from "./totals"

describe("calculateTotals", () => {
  // A blouse at ₹450 and two churidar sets at ₹800.
  const items = [
    { rate: 45000, quantity: 1 },
    { rate: 80000, quantity: 2 },
  ]

  it("sums rate times quantity", () => {
    expect(calculateTotals(items)).toEqual({
      subtotal: 205000,
      discount: 0,
      total: 205000,
      advancePaid: 0,
      balance: 205000,
    })
  })

  it("subtracts the discount and the advance", () => {
    expect(calculateTotals(items, 5000, 100000)).toEqual({
      subtotal: 205000,
      discount: 5000,
      total: 200000,
      advancePaid: 100000,
      balance: 100000,
    })
  })

  it("is exact — no float drift anywhere", () => {
    // ₹0.10 x 3 is the classic float trap: 0.1 * 3 !== 0.3
    const result = calculateTotals([{ rate: 10, quantity: 3 }])
    expect(result.subtotal).toBe(30)
    expect(Number.isInteger(result.subtotal)).toBe(true)
  })

  it("caps a discount at the subtotal rather than going negative", () => {
    const result = calculateTotals(items, 999999)
    expect(result.discount).toBe(205000)
    expect(result.total).toBe(0)
  })

  it("ignores a negative discount", () => {
    expect(calculateTotals(items, -5000).discount).toBe(0)
  })

  it("leaves a negative balance when the customer overpays", () => {
    // The shop owes this back; hiding it would lose the money.
    expect(calculateTotals(items, 0, 300000).balance).toBe(-95000)
  })

  it("handles an order with no items", () => {
    expect(calculateTotals([])).toEqual({
      subtotal: 0,
      discount: 0,
      total: 0,
      advancePaid: 0,
      balance: 0,
    })
  })

  it("refuses non-integer money, which would mean a float crept in", () => {
    expect(() => calculateTotals([{ rate: 450.5, quantity: 1 }])).toThrow()
    expect(() => calculateTotals(items, 50.5)).toThrow()
    expect(() => calculateTotals(items, 0, 100.25)).toThrow()
  })

  it("refuses a nonsense quantity", () => {
    expect(() => calculateTotals([{ rate: 45000, quantity: 0 }])).toThrow()
    expect(() => calculateTotals([{ rate: 45000, quantity: 1.5 }])).toThrow()
    expect(() => calculateTotals([{ rate: 45000, quantity: -2 }])).toThrow()
  })
})
