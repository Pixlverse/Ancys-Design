import { describe, expect, it } from "vitest"

import {
  dayRangeIST,
  dueTone,
  monthGridIST,
  monthGridRangeIST,
  monthRangeIST,
  weekRangeIST,
} from "./calendar"
import { formatDate } from "./dates"

const ist = (iso: string) => new Date(iso)

describe("dayRangeIST", () => {
  it("brackets the IST day, not the UTC one", () => {
    const { start, end } = dayRangeIST(ist("2026-03-12T19:00:00.000Z")) // 00:30 IST 13th
    expect(start.toISOString()).toBe("2026-03-12T18:30:00.000Z")
    expect(end.toISOString()).toBe("2026-03-13T18:29:59.999Z")
  })
})

describe("weekRangeIST", () => {
  it("runs Monday to Sunday in IST", () => {
    // 12 Mar 2026 is a Thursday.
    const { start, end } = weekRangeIST(ist("2026-03-12T06:00:00.000Z"))
    expect(formatDate(start, { withYear: false })).toBe("9 Mar")
    expect(formatDate(end, { withYear: false })).toBe("15 Mar")
  })

  it("does not roll into the next week for a late-evening IST instant", () => {
    // 23:30 IST on Sunday 15 Mar is 18:00 UTC — still that week.
    const { end } = weekRangeIST(ist("2026-03-15T18:00:00.000Z"))
    expect(formatDate(end, { withYear: false })).toBe("15 Mar")
  })
})

describe("monthRangeIST", () => {
  it("covers the first to the last IST day of the month", () => {
    const { start, end } = monthRangeIST(ist("2026-03-12T06:00:00.000Z"))
    expect(formatDate(start, { withYear: true })).toBe("1 Mar 2026")
    expect(formatDate(end, { withYear: true })).toBe("31 Mar 2026")
  })

  it("uses the IST month for an instant that is a different month in UTC", () => {
    // 19:00 UTC on 31 Mar is 00:30 IST on 1 Apr.
    const { start } = monthRangeIST(ist("2026-03-31T19:00:00.000Z"))
    expect(formatDate(start, { withYear: true })).toBe("1 Apr 2026")
  })
})

describe("monthGridRangeIST", () => {
  it("reaches back and forward to fill the visible rows", () => {
    // 1 Mar 2026 is a Sunday, so the grid starts on Monday 23 Feb.
    const { start, end } = monthGridRangeIST(ist("2026-03-12T06:00:00.000Z"))
    expect(formatDate(start, { withYear: true })).toBe("23 Feb 2026")
    expect(formatDate(end, { withYear: true })).toBe("5 Apr 2026")
  })

  it("covers every day the grid renders, so no cell is silently empty", () => {
    const anchor = ist("2026-03-12T06:00:00.000Z")
    const { start, end } = monthGridRangeIST(anchor)
    for (const week of monthGridIST(anchor)) {
      for (const day of week) {
        expect(day.getTime()).toBeGreaterThanOrEqual(start.getTime())
        expect(day.getTime()).toBeLessThanOrEqual(end.getTime())
      }
    }
  })
})

describe("monthGridIST", () => {
  it("is six weeks of seven days", () => {
    const grid = monthGridIST(ist("2026-03-12T06:00:00.000Z"))
    expect(grid).toHaveLength(6)
    for (const week of grid) expect(week).toHaveLength(7)
  })

  it("starts on a Monday and runs consecutively", () => {
    const grid = monthGridIST(ist("2026-03-12T06:00:00.000Z"))
    expect(formatDate(grid[0][0], { withYear: true })).toBe("23 Feb 2026")
    const flat = grid.flat()
    for (let i = 1; i < flat.length; i++) {
      const gap = flat[i].getTime() - flat[i - 1].getTime()
      expect(gap).toBe(24 * 60 * 60 * 1000)
    }
  })
})

describe("dueTone", () => {
  const now = ist("2026-03-12T06:00:00.000Z") // 11:30 IST, Thursday

  it("fades delivered work whatever its date", () => {
    expect(dueTone(ist("2026-01-01T06:00:00.000Z"), "delivered", now)).toBe(
      "delivered"
    )
    expect(dueTone(ist("2026-12-01T06:00:00.000Z"), "delivered", now)).toBe(
      "delivered"
    )
  })

  it("flags overdue, today, and the next three days", () => {
    expect(dueTone(ist("2026-03-11T06:00:00.000Z"), "pending", now)).toBe("overdue")
    expect(dueTone(ist("2026-03-12T17:00:00.000Z"), "pending", now)).toBe("today")
    expect(dueTone(ist("2026-03-13T06:00:00.000Z"), "pending", now)).toBe("soon")
    expect(dueTone(ist("2026-03-15T06:00:00.000Z"), "pending", now)).toBe("soon")
    expect(dueTone(ist("2026-03-16T06:00:00.000Z"), "pending", now)).toBe("later")
  })

  it("counts IST days, so late tonight is still today", () => {
    // 23:00 IST tonight — 17:30 UTC — is the same shop day.
    expect(dueTone(ist("2026-03-12T17:30:00.000Z"), "pending", now)).toBe("today")
    // 00:30 IST tomorrow is not.
    expect(dueTone(ist("2026-03-12T19:00:00.000Z"), "pending", now)).toBe("soon")
  })

  it("treats work still on the bench as overdue even at the last stage", () => {
    expect(dueTone(ist("2026-03-10T06:00:00.000Z"), "ready", now)).toBe("overdue")
  })
})
