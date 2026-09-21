import { afterEach, describe, expect, it } from "vitest"

import { getMessagingProvider, resetMessagingProvider } from "./index"

describe("getMessagingProvider", () => {
  const original = process.env.MESSAGING_PROVIDER

  afterEach(() => {
    process.env.MESSAGING_PROVIDER = original
    resetMessagingProvider()
  })

  it("defaults to manual when nothing is configured", () => {
    delete process.env.MESSAGING_PROVIDER
    resetMessagingProvider()
    expect(getMessagingProvider().channel).toBe("whatsapp_manual")
  })

  it("returns the manual provider when asked for it", () => {
    process.env.MESSAGING_PROVIDER = "manual"
    resetMessagingProvider()
    expect(getMessagingProvider().channel).toBe("whatsapp_manual")
  })

  it("falls back rather than breaking the shop on an unknown value", () => {
    process.env.MESSAGING_PROVIDER = "carrier-pigeon"
    resetMessagingProvider()
    expect(getMessagingProvider().channel).toBe("whatsapp_manual")
  })

  it("satisfies the whole contract", () => {
    resetMessagingProvider()
    const provider = getMessagingProvider()
    for (const method of [
      "sendOrderConfirmation",
      "sendBill",
      "sendDueReminder",
      "sendReadyForPickup",
    ] as const) {
      expect(typeof provider[method]).toBe("function")
    }
  })
})
