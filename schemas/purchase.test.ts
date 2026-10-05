import { describe, expect, it } from "vitest"

import { purchaseInputSchema, purchaseTotal } from "./purchase"

const purchase = {
  purchasedOn: "2026-10-05",
  lines: [{ description: "Thread", amount: "40" }],
}

describe("purchaseInputSchema", () => {
  it("stores line amounts as integer paise", () => {
    const parsed = purchaseInputSchema.parse({
      ...purchase,
      lines: [{ description: "Lining", amount: "1,250.50" }],
    })
    expect(parsed.lines[0].amount).toBe(125050)
  })

  it("reads the purchase date as an IST day", () => {
    expect(purchaseInputSchema.parse(purchase).purchasedOn.toISOString()).toBe(
      "2026-10-04T18:30:00.000Z"
    )
  })

  it("needs at least one item", () => {
    expect(purchaseInputSchema.safeParse({ ...purchase, lines: [] }).success).toBe(
      false
    )
  })

  it("rejects a zero amount and a blank description", () => {
    expect(
      purchaseInputSchema.safeParse({
        ...purchase,
        lines: [{ description: "Thread", amount: "0" }],
      }).success
    ).toBe(false)
    expect(
      purchaseInputSchema.safeParse({
        ...purchase,
        lines: [{ description: "  ", amount: "40" }],
      }).success
    ).toBe(false)
  })

  it("drops blank optional text and defaults bill images", () => {
    const parsed = purchaseInputSchema.parse({ ...purchase, vendor: "  " })
    expect(parsed.vendor).toBeUndefined()
    expect(parsed.billImages).toEqual([])
  })

  it("rejects a tag that is not an id", () => {
    expect(
      purchaseInputSchema.safeParse({ ...purchase, orderId: "2026-0142" }).success
    ).toBe(false)
  })
})

describe("purchaseTotal", () => {
  it("adds the lines in paise", () => {
    expect(purchaseTotal([{ amount: 4000 }, { amount: 6050 }])).toBe(10050)
    expect(purchaseTotal([])).toBe(0)
  })
})
