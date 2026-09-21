import { describe, expect, it } from "vitest"

import { buildCustomerSearch, comparePhoneFirst } from "./customers"

describe("buildCustomerSearch", () => {
  it("lists everyone live when the box is empty", () => {
    expect(buildCustomerSearch("")).toEqual({
      phoneDigits: null,
      filter: { isDeleted: false },
    })
    expect(buildCustomerSearch("   ").filter).toEqual({ isDeleted: false })
  })

  it("treats a numeric query as a phone search", () => {
    const { phoneDigits, filter } = buildCustomerSearch("98765")
    expect(phoneDigits).toBe("98765")
    expect(filter).toEqual({
      isDeleted: false,
      $or: [{ phone: { $regex: "98765" } }],
    })
  })

  it("ignores spaces and +91, so a pasted number still matches", () => {
    expect(buildCustomerSearch("+91 98765 43210").phoneDigits).toBe("9876543210")
    expect(buildCustomerSearch("098765").phoneDigits).toBe("98765")
  })

  it("treats a query with letters as a name search", () => {
    const { filter } = buildCustomerSearch("Meera")
    expect(filter).toEqual({
      isDeleted: false,
      $or: [{ name: { $regex: "Meera", $options: "i" } }],
    })
  })

  it("searches both when the query has digits and letters", () => {
    const { filter } = buildCustomerSearch("meera 98")
    expect(filter.$or).toEqual([
      { phone: { $regex: "98" } },
      { name: { $regex: "meera 98", $options: "i" } },
    ])
  })

  it("escapes regex metacharacters instead of running them", () => {
    const { filter } = buildCustomerSearch("a.*b")
    expect(filter.$or).toEqual([
      { name: { $regex: "a\\.\\*b", $options: "i" } },
    ])
  })

  it("never excludes soft-deleted filtering", () => {
    for (const query of ["", "98765", "Meera", "a.*b"]) {
      expect(buildCustomerSearch(query).filter.isDeleted).toBe(false)
    }
  })
})

describe("comparePhoneFirst", () => {
  const meera = { name: "Meera", phone: "+919876543210" }
  const anita = { name: "Anita", phone: "+919000000001" }

  it("puts a phone match ahead of a name match", () => {
    expect(comparePhoneFirst(meera, anita, "98765")).toBeLessThan(0)
    expect(comparePhoneFirst(anita, meera, "98765")).toBeGreaterThan(0)
  })

  it("falls back to alphabetical when both match or neither does", () => {
    expect(comparePhoneFirst(meera, anita, null)).toBeGreaterThan(0)
    expect(comparePhoneFirst(anita, meera, null)).toBeLessThan(0)
    expect(comparePhoneFirst(anita, meera, "9")).toBeLessThan(0)
  })
})
