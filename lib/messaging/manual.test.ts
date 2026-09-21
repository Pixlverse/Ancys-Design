import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { ManualWhatsAppProvider } from "./providers/manual"
import type { MessagingCustomer, MessagingOrder } from "./types"

const customer: MessagingCustomer = {
  id: "c1",
  name: "Meera Nair",
  phone: "+919876543210",
}

const order: MessagingOrder = {
  id: "o1",
  orderNo: "2026-0142",
  items: [
    {
      id: "i1",
      garmentTypeName: "Blouse",
      quantity: 1,
      rate: 45000,
      dueDate: new Date("2026-10-01T18:30:00.000Z"),
    },
    {
      id: "i2",
      garmentTypeName: "Churidar Set",
      quantity: 2,
      rate: 85000,
      dueDate: new Date("2026-10-14T18:30:00.000Z"),
    },
  ],
  subtotal: 215000,
  discount: 5000,
  total: 210000,
  advancePaid: 50000,
  balance: 160000,
  publicToken: "a".repeat(32),
}

const provider = new ManualWhatsAppProvider()

describe("the manual provider", () => {
  const originalUrl = process.env.NEXT_PUBLIC_APP_URL
  const originalShop = process.env.SHOP_NAME

  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = "https://shop.example.com"
    process.env.SHOP_NAME = "Ancys Design"
  })

  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = originalUrl
    process.env.SHOP_NAME = originalShop
  })

  it("hands the send back to a person rather than claiming to have sent it", async () => {
    const result = await provider.sendOrderConfirmation(order, customer)
    expect(result.status).toBe("manual")
    expect(result.channel).toBe("whatsapp_manual")
  })

  it("addresses the link to the customer's number without the plus", async () => {
    const result = await provider.sendOrderConfirmation(order, customer)
    if (result.status !== "manual") throw new Error("expected a manual result")
    expect(result.openUrl.startsWith("https://wa.me/919876543210?text=")).toBe(true)
  })

  it("carries every garment, its quantity, its price and its due date", async () => {
    const result = await provider.sendOrderConfirmation(order, customer)
    if (result.status !== "manual") throw new Error("expected a manual result")

    expect(result.body).toContain("Blouse")
    expect(result.body).toContain("₹450")
    expect(result.body).toContain("2 Oct 2026")
    expect(result.body).toContain("Churidar Set × 2")
    expect(result.body).toContain("₹1,700")
    expect(result.body).toContain("15 Oct 2026")
  })

  it("carries the bill, discount and advance included", async () => {
    const result = await provider.sendOrderConfirmation(order, customer)
    if (result.status !== "manual") throw new Error("expected a manual result")

    expect(result.body).toContain("Subtotal: ₹2,150")
    expect(result.body).toContain("Discount: -₹50")
    expect(result.body).toContain("Total: ₹2,100")
    expect(result.body).toContain("Advance paid: -₹500")
    expect(result.body).toContain("Balance: ₹1,600")
  })

  it("links to the public order page, because a link cannot carry photos", async () => {
    const result = await provider.sendOrderConfirmation(order, customer)
    if (result.status !== "manual") throw new Error("expected a manual result")
    expect(result.body).toContain(`https://shop.example.com/o/${"a".repeat(32)}`)
  })

  it("never leaks the order id into the message", async () => {
    const result = await provider.sendOrderConfirmation(order, customer)
    if (result.status !== "manual") throw new Error("expected a manual result")
    expect(result.body).not.toContain(order.id)
  })

  it("omits the link entirely when no token has been issued", async () => {
    const untokened = { ...order, publicToken: undefined }
    const result = await provider.sendOrderConfirmation(untokened, customer)
    if (result.status !== "manual") throw new Error("expected a manual result")
    expect(result.body).not.toContain("/o/")
  })

  it("includes the shop's own details", async () => {
    const result = await provider.sendOrderConfirmation(order, customer)
    if (result.status !== "manual") throw new Error("expected a manual result")
    expect(result.body).toContain("Ancys Design")
  })

  it("percent-encodes the body so newlines survive the link", async () => {
    const result = await provider.sendOrderConfirmation(order, customer)
    if (result.status !== "manual") throw new Error("expected a manual result")
    expect(result.openUrl).not.toContain("\n")
    expect(result.openUrl).toContain("%0A")
    const text = decodeURIComponent(result.openUrl.split("?text=")[1])
    expect(text).toBe(result.body)
  })

  it("sends a bill without a PDF attachment, pointing at the order page", async () => {
    const result = await provider.sendBill(order, customer, Buffer.from("pdf"))
    if (result.status !== "manual") throw new Error("expected a manual result")
    expect(result.body).toContain("2026-0142")
    expect(result.body).toContain("Total: ₹2,100")
    expect(result.body).toContain("/o/")
  })

  it("names the one garment in a due reminder, not the whole order", async () => {
    const result = await provider.sendDueReminder(order, order.items[1], customer)
    if (result.status !== "manual") throw new Error("expected a manual result")
    expect(result.body).toContain("Churidar Set")
    expect(result.body).toContain("15 Oct 2026")
    expect(result.body).not.toContain("Blouse")
  })

  it("states the balance to settle when a collection message goes out", async () => {
    const result = await provider.sendReadyForPickup(order, customer)
    if (result.status !== "manual") throw new Error("expected a manual result")
    expect(result.body).toContain("ready to collect")
    expect(result.body).toContain("Balance to settle: ₹1,600")
  })

  it("does not mention a balance when nothing is owed", async () => {
    const settled = { ...order, advancePaid: 210000, balance: 0 }
    const result = await provider.sendReadyForPickup(settled, customer)
    if (result.status !== "manual") throw new Error("expected a manual result")
    expect(result.body).not.toContain("Balance to settle")
  })
})

describe("the two-stage messages", () => {
  const originalUrl = process.env.NEXT_PUBLIC_APP_URL
  const originalShop = process.env.SHOP_NAME

  beforeEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = "https://shop.example.com"
    process.env.SHOP_NAME = "Ancys Design"
  })

  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = originalUrl
    process.env.SHOP_NAME = originalShop
  })

  const withCloth: MessagingOrder = {
    ...order,
    items: [
      { ...order.items[0], clothLength: 2.5, clothSource: "customer" },
      {
        id: "i3",
        garmentTypeName: "Lehenga",
        quantity: 1,
        rate: 300000,
        dueDate: new Date("2026-11-01T18:30:00.000Z"),
        workType: "design_only",
      },
    ],
  }

  it("quotes the cloth length back in the first message", async () => {
    const result = await provider.sendOrderConfirmation(withCloth, customer)
    if (result.status !== "manual") throw new Error("expected a manual result")
    expect(result.body).toContain("2.5m cloth")
  })

  it("says when an item is design work only", async () => {
    const result = await provider.sendOrderConfirmation(withCloth, customer)
    if (result.status !== "manual") throw new Error("expected a manual result")
    expect(result.body).toContain("design only")
  })

  it("asks them to confirm, and does not read like an invoice", async () => {
    const result = await provider.sendOrderConfirmation(withCloth, customer)
    if (result.status !== "manual") throw new Error("expected a manual result")
    expect(result.body).toContain("Please confirm so we can begin")
    expect(result.body).not.toContain("is confirmed and we have started work")
  })

  it("the second message thanks them and states what is left to pay", async () => {
    const result = await provider.sendBill(withCloth, customer)
    if (result.status !== "manual") throw new Error("expected a manual result")
    expect(result.body).toContain("is confirmed and we have started work")
    expect(result.body).toContain("Please settle ₹1,600 on collection")
  })

  it("says paid in full when nothing is outstanding", async () => {
    const settled = { ...withCloth, advancePaid: 210000, balance: 0 }
    const result = await provider.sendBill(settled, customer)
    if (result.status !== "manual") throw new Error("expected a manual result")
    expect(result.body).toContain("Paid in full")
    expect(result.body).not.toContain("Please settle")
  })
})
