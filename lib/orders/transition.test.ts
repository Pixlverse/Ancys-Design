import { describe, expect, it } from "vitest"

import {
  ITEM_TRANSITIONS,
  ORDER_TRANSITIONS,
  canTransitionItem,
  canTransitionOrder,
  deriveOrderStatus,
} from "./transition"
import { ORDER_ITEM_STATUSES, ORDER_STATUSES } from "@/schemas/order"

const items = (...statuses: string[]) =>
  statuses.map((itemStatus) => ({
    itemStatus: itemStatus as (typeof ORDER_ITEM_STATUSES)[number],
  }))

describe("the transition tables", () => {
  it("cover every status, so no status can strand an order", () => {
    for (const status of ORDER_STATUSES) {
      expect(ORDER_TRANSITIONS[status]).toBeDefined()
    }
    for (const status of ORDER_ITEM_STATUSES) {
      expect(ITEM_TRANSITIONS[status]).toBeDefined()
    }
  })

  it("only ever point at real statuses", () => {
    for (const targets of Object.values(ORDER_TRANSITIONS)) {
      for (const target of targets) expect(ORDER_STATUSES).toContain(target)
    }
    for (const targets of Object.values(ITEM_TRANSITIONS)) {
      for (const target of targets) expect(ORDER_ITEM_STATUSES).toContain(target)
    }
  })

  it("treats delivered and cancelled as final", () => {
    expect(ORDER_TRANSITIONS.delivered).toEqual([])
    expect(ORDER_TRANSITIONS.cancelled).toEqual([])
  })

  it("lets a customer ask for a change, and lets staff send it again", () => {
    // The customer's two other answers, from the page they were sent.
    expect(canTransitionOrder("awaiting_confirmation", "changes_requested")).toBe(
      true
    )
    expect(canTransitionOrder("awaiting_confirmation", "cancelled")).toBe(true)

    // Staff edit, then re-send: the order goes back onto the customer's court.
    expect(canTransitionOrder("changes_requested", "awaiting_confirmation")).toBe(
      true
    )
    // Or the customer rings to say it was fine after all.
    expect(canTransitionOrder("changes_requested", "confirmed")).toBe(true)

    // It is not a workbench state: no jumping straight to the bench or the door.
    expect(canTransitionOrder("changes_requested", "in_progress")).toBe(false)
    expect(canTransitionOrder("changes_requested", "ready")).toBe(false)
    expect(canTransitionOrder("changes_requested", "delivered")).toBe(false)

    // And it cannot be reached from work already under way.
    expect(canTransitionOrder("confirmed", "changes_requested")).toBe(false)
    expect(canTransitionOrder("in_progress", "changes_requested")).toBe(false)
  })
})

describe("canTransitionOrder", () => {
  it("allows the normal path through the shop", () => {
    expect(canTransitionOrder("draft", "awaiting_confirmation")).toBe(true)
    expect(canTransitionOrder("awaiting_confirmation", "confirmed")).toBe(true)
    expect(canTransitionOrder("confirmed", "in_progress")).toBe(true)
    expect(canTransitionOrder("in_progress", "ready")).toBe(true)
    expect(canTransitionOrder("ready", "delivered")).toBe(true)
  })

  it("lets a queried order go back to draft to be corrected", () => {
    expect(canTransitionOrder("awaiting_confirmation", "draft")).toBe(true)
  })

  it("refuses to skip confirmation into delivery", () => {
    expect(canTransitionOrder("draft", "delivered")).toBe(false)
    expect(canTransitionOrder("draft", "ready")).toBe(false)
    expect(canTransitionOrder("awaiting_confirmation", "ready")).toBe(false)
  })

  it("refuses to resurrect a finished order", () => {
    for (const status of ORDER_STATUSES) {
      expect(canTransitionOrder("delivered", status)).toBe(false)
      expect(canTransitionOrder("cancelled", status)).toBe(false)
    }
  })

  it("refuses to cancel something already delivered", () => {
    expect(canTransitionOrder("delivered", "cancelled")).toBe(false)
  })
})

describe("canTransitionItem", () => {
  it("walks the workbench in order", () => {
    expect(canTransitionItem("pending", "cutting")).toBe(true)
    expect(canTransitionItem("cutting", "stitching")).toBe(true)
    expect(canTransitionItem("stitching", "finishing")).toBe(true)
    expect(canTransitionItem("finishing", "ready")).toBe(true)
    expect(canTransitionItem("ready", "delivered")).toBe(true)
  })

  it("allows one step back, because staff mis-tap", () => {
    expect(canTransitionItem("cutting", "pending")).toBe(true)
    expect(canTransitionItem("delivered", "ready")).toBe(true)
  })

  it("refuses to skip stages", () => {
    expect(canTransitionItem("pending", "ready")).toBe(false)
    expect(canTransitionItem("cutting", "ready")).toBe(false)
    expect(canTransitionItem("pending", "delivered")).toBe(false)
  })
})

describe("deriveOrderStatus", () => {
  it("is in progress once any garment has been started", () => {
    expect(deriveOrderStatus(items("pending", "cutting"), "confirmed")).toBe(
      "in_progress"
    )
  })

  it("stays put while every garment is still pending", () => {
    expect(deriveOrderStatus(items("pending", "pending"), "confirmed")).toBe(
      "confirmed"
    )
  })

  it("is ready only when every garment is", () => {
    expect(deriveOrderStatus(items("ready", "finishing"), "in_progress")).toBe(
      "in_progress"
    )
    expect(deriveOrderStatus(items("ready", "ready"), "in_progress")).toBe("ready")
    expect(deriveOrderStatus(items("ready", "delivered"), "in_progress")).toBe(
      "ready"
    )
  })

  it("is delivered only when every garment has gone", () => {
    expect(deriveOrderStatus(items("delivered", "ready"), "ready")).toBe("ready")
    expect(deriveOrderStatus(items("delivered", "delivered"), "ready")).toBe(
      "delivered"
    )
  })

  it("never derives a draft or an unconfirmed order forward", () => {
    // A draft is a draft however far along its garments somehow are.
    expect(deriveOrderStatus(items("ready", "ready"), "draft")).toBe("draft")
    expect(
      deriveOrderStatus(items("ready", "ready"), "awaiting_confirmation")
    ).toBe("awaiting_confirmation")
  })

  it("never resurrects a cancelled or delivered order", () => {
    expect(deriveOrderStatus(items("cutting"), "cancelled")).toBe("cancelled")
    expect(deriveOrderStatus(items("ready"), "delivered")).toBe("delivered")
  })

  it("leaves an order with no garments alone", () => {
    expect(deriveOrderStatus([], "confirmed")).toBe("confirmed")
  })
})
