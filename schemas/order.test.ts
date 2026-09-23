import { describe, expect, it } from "vitest"

import { orderInputSchema, orderItemInputSchema, promisedDateFrom } from "./order"

const OID = "6aacdac1ab3de1c5b8ed493e"

const item = {
  garmentTypeId: OID,
  rate: "800",
  quantity: 1,
  clothSource: "customer",
  images: [],
  dueDate: "2026-03-12",
}

describe("orderItemInputSchema", () => {
  it("stores the rate as integer paise", () => {
    expect(orderItemInputSchema.parse(item).rate).toBe(80000)
    expect(orderItemInputSchema.parse({ ...item, rate: "1,250.50" }).rate).toBe(
      125050
    )
  })

  it("reads the due date as an IST day", () => {
    expect(orderItemInputSchema.parse(item).dueDate.toISOString()).toBe(
      "2026-03-11T18:30:00.000Z"
    )
  })

  it("defaults images to an empty list", () => {
    const { images, ...withoutImages } = item
    void images
    expect(orderItemInputSchema.parse(withoutImages).images).toEqual([])
  })

  it("drops a blank note rather than storing an empty string", () => {
    expect(orderItemInputSchema.parse({ ...item, note: "   " }).note).toBeUndefined()
  })

  it("rejects a quantity that is not a whole garment", () => {
    for (const quantity of [0, -1, 1.5, 100]) {
      expect(orderItemInputSchema.safeParse({ ...item, quantity }).success).toBe(
        false
      )
    }
  })

  it("rejects a missing or malformed due date", () => {
    expect(orderItemInputSchema.safeParse({ ...item, dueDate: "" }).success).toBe(
      false
    )
    expect(
      orderItemInputSchema.safeParse({ ...item, dueDate: "12/03/2026" }).success
    ).toBe(false)
  })

  it("rejects an id that is not an object id", () => {
    expect(
      orderItemInputSchema.safeParse({ ...item, garmentTypeId: "nope" }).success
    ).toBe(false)
  })

  it("rejects an unknown cloth source", () => {
    expect(
      orderItemInputSchema.safeParse({ ...item, clothSource: "borrowed" }).success
    ).toBe(false)
  })
})

describe("orderItemInputSchema pieces", () => {
  const piece = { clothSource: "customer", images: [] }

  it("leaves pieces absent when every piece is the same", () => {
    expect(orderItemInputSchema.parse({ ...item, quantity: 3 }).pieces).toBeUndefined()
  })

  it("accepts one piece per garment, each with its own note", () => {
    const parsed = orderItemInputSchema.parse({
      ...item,
      quantity: 2,
      clothSource: undefined,
      pieces: [
        { ...piece, clothLength: "2.5", note: "Blue silk" },
        { ...piece, note: "  " },
      ],
    })
    expect(parsed.pieces?.[0]).toMatchObject({ clothLength: 2.5, note: "Blue silk" })
    expect(parsed.pieces?.[1].note).toBeUndefined()
  })

  it("rejects a piece count that does not match the quantity", () => {
    expect(
      orderItemInputSchema.safeParse({ ...item, quantity: 3, pieces: [piece, piece] })
        .success
    ).toBe(false)
  })

  it("asks whose cloth each stitched piece is", () => {
    const result = orderItemInputSchema.safeParse({
      ...item,
      quantity: 2,
      pieces: [piece, { images: [] }],
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].path).toEqual(["pieces", 1, "clothSource"])
  })

  it("does not ask about cloth on design-only pieces", () => {
    expect(
      orderItemInputSchema.safeParse({
        ...item,
        workType: "design_only",
        clothSource: undefined,
        quantity: 2,
        pieces: [{ images: [] }, { images: [] }],
      }).success
    ).toBe(true)
  })
})

describe("orderInputSchema", () => {
  const order = { customerId: OID, items: [item] }

  it("defaults discount and advance to nothing owed up front", () => {
    const parsed = orderInputSchema.parse(order)
    expect(parsed.discount).toBe(0)
    expect(parsed.advancePaid).toBe(0)
  })

  it("converts discount and advance to paise", () => {
    const parsed = orderInputSchema.parse({
      ...order,
      discount: "50",
      advancePaid: "500",
    })
    expect(parsed.discount).toBe(5000)
    expect(parsed.advancePaid).toBe(50000)
  })

  it("refuses an order with no garments", () => {
    const result = orderInputSchema.safeParse({ ...order, items: [] })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe("Add at least one garment")
  })
})

describe("promisedDateFrom", () => {
  const march = new Date("2026-03-11T18:30:00.000Z")
  const april = new Date("2026-04-11T18:30:00.000Z")

  it("is the latest due date across the items", () => {
    expect(promisedDateFrom([{ dueDate: march }, { dueDate: april }])).toBe(april)
    expect(promisedDateFrom([{ dueDate: april }, { dueDate: march }])).toBe(april)
  })

  it("handles a single item", () => {
    expect(promisedDateFrom([{ dueDate: march }])).toBe(march)
  })

  it("is undefined when there is nothing to promise", () => {
    expect(promisedDateFrom([])).toBeUndefined()
  })
})
