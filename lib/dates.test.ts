import { describe, expect, it } from "vitest"

import {
  daysUntil,
  endOfDayIST,
  formatDate,
  parseDateInputIST,
  startOfDayIST,
  toDateInputIST,
  yearIST,
} from "./dates"

describe("startOfDayIST", () => {
  it("returns 00:00 IST, which is 18:30 UTC the previous day", () => {
    const midMorningIST = new Date("2026-03-12T06:00:00.000Z") // 11:30 IST
    expect(startOfDayIST(midMorningIST).toISOString()).toBe(
      "2026-03-11T18:30:00.000Z"
    )
  })

  it("keeps late-evening IST on the same Indian day", () => {
    // 23:30 IST on 12 Mar is already 18:00 UTC on 12 Mar — a naive UTC
    // startOfDay would file this under the 12th's UTC day and still be right,
    // but 00:30 IST on the 13th (19:00 UTC on the 12th) would not be.
    const lateEveningIST = new Date("2026-03-12T18:00:00.000Z")
    expect(startOfDayIST(lateEveningIST).toISOString()).toBe(
      "2026-03-11T18:30:00.000Z"
    )
  })

  it("puts just-after-midnight IST on the new Indian day", () => {
    const justAfterMidnightIST = new Date("2026-03-12T19:00:00.000Z") // 00:30 IST, 13 Mar
    expect(startOfDayIST(justAfterMidnightIST).toISOString()).toBe(
      "2026-03-12T18:30:00.000Z"
    )
  })
})

describe("endOfDayIST", () => {
  it("returns the last instant of the IST day", () => {
    const midMorningIST = new Date("2026-03-12T06:00:00.000Z")
    expect(endOfDayIST(midMorningIST).toISOString()).toBe(
      "2026-03-12T18:29:59.999Z"
    )
  })

  it("brackets the day it starts", () => {
    const someInstant = new Date("2026-07-04T09:15:00.000Z")
    const start = startOfDayIST(someInstant)
    const end = endOfDayIST(someInstant)
    expect(end.getTime() - start.getTime()).toBe(24 * 60 * 60 * 1000 - 1)
    expect(someInstant.getTime()).toBeGreaterThanOrEqual(start.getTime())
    expect(someInstant.getTime()).toBeLessThanOrEqual(end.getTime())
  })
})

describe("formatDate", () => {
  it("formats as d MMM", () => {
    expect(formatDate(new Date("2026-03-12T06:00:00.000Z"), { withYear: false })).toBe(
      "12 Mar"
    )
    expect(formatDate(new Date("2026-03-02T06:00:00.000Z"), { withYear: false })).toBe(
      "2 Mar"
    )
  })

  it("formats with the year when asked", () => {
    expect(formatDate(new Date("2026-03-12T06:00:00.000Z"), { withYear: true })).toBe(
      "12 Mar 2026"
    )
  })

  it("uses the IST calendar day, not the UTC one", () => {
    // 19:00 UTC on 12 Mar is 00:30 IST on the 13th.
    expect(formatDate(new Date("2026-03-12T19:00:00.000Z"), { withYear: false })).toBe(
      "13 Mar"
    )
  })

  it("auto mode prints the year only for other years", () => {
    const thisYear = new Date()
    expect(formatDate(thisYear)).not.toMatch(/\d{4}/)
    expect(formatDate(new Date("2019-03-12T06:00:00.000Z"))).toBe("12 Mar 2019")
  })
})

describe("daysUntil", () => {
  const from = new Date("2026-03-12T06:00:00.000Z") // 11:30 IST, 12 Mar

  it("counts IST calendar days", () => {
    expect(daysUntil(new Date("2026-03-12T14:00:00.000Z"), from)).toBe(0)
    expect(daysUntil(new Date("2026-03-13T04:00:00.000Z"), from)).toBe(1)
    expect(daysUntil(new Date("2026-03-15T04:00:00.000Z"), from)).toBe(3)
  })

  it("goes negative when overdue", () => {
    expect(daysUntil(new Date("2026-03-11T04:00:00.000Z"), from)).toBe(-1)
  })

  it("counts boundaries crossed, not elapsed hours", () => {
    // 23:00 IST tonight to 09:00 IST tomorrow is ten hours, but it is one day away.
    const lateTonight = new Date("2026-03-12T17:30:00.000Z")
    const tomorrowMorning = new Date("2026-03-13T03:30:00.000Z")
    expect(daysUntil(tomorrowMorning, lateTonight)).toBe(1)
  })
})

describe("yearIST", () => {
  it("uses the Indian calendar year", () => {
    expect(yearIST(new Date("2026-03-12T06:00:00.000Z"))).toBe(2026)
  })

  it("rolls over on the Indian new year, not the UTC one", () => {
    // 19:00 UTC on 31 Dec is 00:30 IST on 1 Jan — already the next year here.
    expect(yearIST(new Date("2025-12-31T19:00:00.000Z"))).toBe(2026)
    // 17:00 UTC on 31 Dec is 22:30 IST, still the old year.
    expect(yearIST(new Date("2025-12-31T17:00:00.000Z"))).toBe(2025)
  })
})

describe("parseDateInputIST", () => {
  it("reads a date input as an IST day, not a UTC one", () => {
    // 00:00 IST on 12 Mar is 18:30 UTC on 11 Mar.
    expect(parseDateInputIST("2026-03-12")?.toISOString()).toBe(
      "2026-03-11T18:30:00.000Z"
    )
  })

  it("round-trips through the input format", () => {
    for (const value of ["2026-01-01", "2026-03-12", "2026-12-31"]) {
      const parsed = parseDateInputIST(value)
      expect(parsed).not.toBeNull()
      expect(toDateInputIST(parsed as Date)).toBe(value)
    }
  })

  it("lands on the right IST day, which naive parsing does not", () => {
    const parsed = parseDateInputIST("2026-03-12") as Date
    expect(formatDate(parsed, { withYear: false })).toBe("12 Mar")
    // What `new Date("2026-03-12")` would have given, for contrast.
    expect(formatDate(new Date("2026-03-12"), { withYear: false })).toBe("12 Mar")
    expect(parsed.getTime()).toBeLessThan(new Date("2026-03-12").getTime())
  })

  it("rejects anything that is not a date input", () => {
    expect(parseDateInputIST("")).toBeNull()
    expect(parseDateInputIST("12/03/2026")).toBeNull()
    expect(parseDateInputIST("2026-3-12")).toBeNull()
    expect(parseDateInputIST("not a date")).toBeNull()
  })
})
