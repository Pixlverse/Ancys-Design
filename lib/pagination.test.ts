import { describe, expect, it } from "vitest"

import {
  CUSTOMER_PAGE_SIZE,
  PAGE_SIZE,
  pageNumbers,
  paginate,
  parsePage,
} from "./pagination"

describe("parsePage", () => {
  it("reads a page number", () => {
    expect(parsePage("1")).toBe(1)
    expect(parsePage("7")).toBe(7)
  })

  it("falls back to the first page for anything odd", () => {
    for (const value of [undefined, "", "0", "-3", "abc", "1.5", "<script>"]) {
      expect(parsePage(value)).toBe(1)
    }
  })

  it("caps absurd values, so ?page=1e9 cannot become a huge skip", () => {
    expect(parsePage("999999999")).toBe(100_000)
  })
})

describe("paginate", () => {
  it("describes the first page", () => {
    expect(paginate(137, 1)).toEqual({
      page: 1,
      pageSize: PAGE_SIZE,
      totalItems: 137,
      totalPages: 7,
      skip: 0,
      from: 1,
      to: 20,
    })
  })

  it("describes a middle page", () => {
    const info = paginate(137, 3)
    expect(info.skip).toBe(40)
    expect(info.from).toBe(41)
    expect(info.to).toBe(60)
  })

  it("does not run past the end on the last page", () => {
    const info = paginate(137, 7)
    expect(info.from).toBe(121)
    expect(info.to).toBe(137)
  })

  it("lands on the last page when asked for one beyond it", () => {
    expect(paginate(137, 99).page).toBe(7)
  })

  it("handles an empty list without claiming to show anything", () => {
    expect(paginate(0, 1)).toMatchObject({
      totalPages: 1,
      from: 0,
      to: 0,
      skip: 0,
    })
  })

  it("handles exactly one full page", () => {
    expect(paginate(20, 1)).toMatchObject({ totalPages: 1, from: 1, to: 20 })
  })
})

describe("pageNumbers", () => {
  it("lists them all when there are few", () => {
    expect(pageNumbers(1, 3)).toEqual([1, 2, 3])
  })

  it("gaps the middle of a long run", () => {
    expect(pageNumbers(9, 42)).toEqual([1, "gap", 8, 9, 10, "gap", 42])
  })

  it("does not gap next to the ends", () => {
    expect(pageNumbers(2, 10)).toEqual([1, 2, 3, "gap", 10])
    expect(pageNumbers(9, 10)).toEqual([1, "gap", 8, 9, 10])
  })

  it("never repeats a page", () => {
    for (const total of [1, 2, 5, 12, 99]) {
      for (let page = 1; page <= total; page++) {
        const pages = pageNumbers(page, total).filter(
          (value): value is number => value !== "gap"
        )
        expect(new Set(pages).size).toBe(pages.length)
      }
    }
  })

  it("always offers the first and last page", () => {
    const pages = pageNumbers(20, 40)
    expect(pages[0]).toBe(1)
    expect(pages.at(-1)).toBe(40)
  })
})

describe("a custom page size", () => {
  it("pages customers fifteen at a time", () => {
    expect(paginate(30, 1, CUSTOMER_PAGE_SIZE)).toMatchObject({
      pageSize: 15,
      totalPages: 2,
      from: 1,
      to: 15,
    })
    expect(paginate(30, 2, CUSTOMER_PAGE_SIZE)).toMatchObject({
      skip: 15,
      from: 16,
      to: 30,
    })
  })

  it("leaves the other lists on twenty", () => {
    expect(paginate(30, 1).pageSize).toBe(20)
  })
})
