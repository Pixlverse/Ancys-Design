import { describe, expect, it } from "vitest"

import { changedKeys, formatMeasurement } from "./measurements"

describe("changedKeys", () => {
  it("returns nothing for the first set ever taken", () => {
    expect(changedKeys({ bust: 36 }, undefined)).toEqual(new Set())
  })

  it("marks only what actually moved", () => {
    expect(changedKeys({ bust: 36, waist: 30 }, { bust: 36, waist: 31 })).toEqual(
      new Set(["waist"])
    )
  })

  it("marks nothing when a set is retaken unchanged", () => {
    expect(changedKeys({ bust: 36, waist: 30 }, { bust: 36, waist: 30 })).toEqual(
      new Set()
    )
  })

  it("treats a newly filled optional field as a change", () => {
    expect(changedKeys({ bust: 36, armhole: 15 }, { bust: 36 })).toEqual(
      new Set(["armhole"])
    )
  })

  it("does not flag a field dropped from the newer set", () => {
    // The key is absent, not different — nothing to show a change against.
    expect(changedKeys({ bust: 36 }, { bust: 36, armhole: 15 })).toEqual(new Set())
  })

  it("distinguishes decimals", () => {
    expect(changedKeys({ sleeve: 12.5 }, { sleeve: 12 })).toEqual(
      new Set(["sleeve"])
    )
    expect(changedKeys({ sleeve: 12.5 }, { sleeve: 12.5 })).toEqual(new Set())
  })
})

describe("formatMeasurement", () => {
  it("uses inch marks for inches and a spaced unit otherwise", () => {
    expect(formatMeasurement(36, "in")).toBe('36"')
    expect(formatMeasurement(32.5, "in")).toBe('32.5"')
    expect(formatMeasurement(90, "cm")).toBe("90 cm")
  })
})
