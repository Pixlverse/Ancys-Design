import { describe, expect, it } from "vitest"

import { garmentTypeInputSchema, suggestKey } from "./garmentType"
import { buildMeasurementValuesSchema } from "./measurementSet"

function field(key: string, overrides: Record<string, unknown> = {}) {
  return {
    key,
    label: key,
    unit: "in",
    required: false,
    order: 0,
    ...overrides,
  }
}

describe("suggestKey", () => {
  it("camelCases a label", () => {
    expect(suggestKey("Sleeve length")).toBe("sleeveLength")
    expect(suggestKey("Bust")).toBe("bust")
    expect(suggestKey("Front neck depth")).toBe("frontNeckDepth")
  })

  it("drops punctuation and collapses spacing", () => {
    expect(suggestKey("  Bottom / ankle  ")).toBe("bottomAnkle")
    expect(suggestKey("Neck-back")).toBe("neckBack")
  })

  it("returns empty for an unusable label", () => {
    expect(suggestKey("")).toBe("")
    expect(suggestKey("   ")).toBe("")
  })
})

describe("garmentTypeInputSchema", () => {
  const base = {
    name: "Lehenga",
    baseRate: "1200",
    isActive: true,
    measurementFields: [field("waist"), field("length")],
  }

  it("stores the rate as integer paise", () => {
    const parsed = garmentTypeInputSchema.parse(base)
    expect(parsed.baseRate).toBe(120000)
  })

  it("accepts a rate typed with paise", () => {
    expect(garmentTypeInputSchema.parse({ ...base, baseRate: "1200.50" }).baseRate).toBe(
      120050
    )
  })

  it("renumbers order from array position, so reordering cannot drift", () => {
    const parsed = garmentTypeInputSchema.parse({
      ...base,
      measurementFields: [
        field("waist", { order: 7 }),
        field("length", { order: 7 }),
        field("hip", { order: 2 }),
      ],
    })
    expect(parsed.measurementFields.map((f) => f.order)).toEqual([0, 1, 2])
    expect(parsed.measurementFields.map((f) => f.key)).toEqual([
      "waist",
      "length",
      "hip",
    ])
  })

  it("rejects duplicate keys, which would collide in the values object", () => {
    const result = garmentTypeInputSchema.safeParse({
      ...base,
      measurementFields: [field("waist"), field("waist")],
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toContain("Duplicate key")
  })

  it("rejects keys that are not camelCase identifiers", () => {
    for (const bad of ["Waist", "sleeve length", "1st", "sleeve-length", ""]) {
      expect(
        garmentTypeInputSchema.safeParse({
          ...base,
          measurementFields: [field(bad)],
        }).success
      ).toBe(false)
    }
  })

  it("rejects a blank name and a non-numeric rate", () => {
    expect(garmentTypeInputSchema.safeParse({ ...base, name: "  " }).success).toBe(
      false
    )
    expect(
      garmentTypeInputSchema.safeParse({ ...base, baseRate: "free" }).success
    ).toBe(false)
  })

  it("allows a garment with no measurements at all", () => {
    const parsed = garmentTypeInputSchema.parse({ ...base, measurementFields: [] })
    expect(parsed.measurementFields).toEqual([])
  })
})

describe("buildMeasurementValuesSchema", () => {
  const fields = [
    { key: "bust", label: "Bust", unit: "in" as const, required: true, order: 0 },
    { key: "armhole", label: "Armhole", unit: "in" as const, required: false, order: 1 },
  ]

  it("requires the required fields and allows the optional ones to be missing", () => {
    const schema = buildMeasurementValuesSchema(fields)
    expect(schema.parse({ bust: 36 })).toEqual({ bust: 36 })
    expect(schema.parse({ bust: 36, armhole: 15.5 })).toEqual({
      bust: 36,
      armhole: 15.5,
    })
    expect(schema.safeParse({ armhole: 15 }).success).toBe(false)
  })

  it("keeps decimals", () => {
    expect(buildMeasurementValuesSchema(fields).parse({ bust: 32.5 })).toEqual({
      bust: 32.5,
    })
  })

  it("rejects strings, so nothing is ever stored as text", () => {
    expect(buildMeasurementValuesSchema(fields).safeParse({ bust: "36" }).success).toBe(
      false
    )
  })

  it("rejects nonsense numbers", () => {
    const schema = buildMeasurementValuesSchema(fields)
    expect(schema.safeParse({ bust: 0 }).success).toBe(false)
    expect(schema.safeParse({ bust: -5 }).success).toBe(false)
    expect(schema.safeParse({ bust: 500 }).success).toBe(false)
  })

  it("strips keys the garment type does not define", () => {
    expect(
      buildMeasurementValuesSchema(fields).parse({ bust: 36, sneaky: 99 })
    ).toEqual({ bust: 36 })
  })

  it("builds an empty schema for a garment with no measurements", () => {
    expect(buildMeasurementValuesSchema([]).parse({})).toEqual({})
  })
})
