import { formatDate } from "@/lib/dates"
import { formatMoney } from "@/lib/money"
import { formatPhone } from "@/lib/phone"
import { readShopIdentity } from "@/lib/shop"
import type {
  MessagingCustomer,
  MessagingOrder,
  MessagingOrderItem,
  MessagingProvider,
  SendResult,
} from "@/lib/messaging/types"

/**
 * The default provider, and the one the shop runs on until Meta approves the
 * business (CLAUDE.md section 7).
 *
 * It composes the message and returns a link staff open on their own phone, then
 * send themselves. A wa.me link cannot carry images, so every message points at
 * the tokenised public order page, which can.
 *
 * This file is the only place in the codebase that knows what wa.me is.
 */
export class ManualWhatsAppProvider implements MessagingProvider {
  readonly channel = "whatsapp_manual"

  async sendOrderConfirmation(
    order: MessagingOrder,
    customer: MessagingCustomer
  ): Promise<SendResult> {
    return this.handOff(
      composeOrderConfirmation(order, customer),
      customer
    )
  }

  async sendBill(
    order: MessagingOrder,
    customer: MessagingCustomer,
    // Deliberately unused: a wa.me link cannot carry an attachment. The bill is
    // the public order page instead — same figures, no download, any phone.
    // The parameter stays so the class matches the contract exactly, and so
    // phase 5's provider is a drop-in.
    pdf?: Buffer
  ): Promise<SendResult> {
    void pdf
    return this.handOff(composeBill(order, customer), customer)
  }

  async sendDueReminder(
    order: MessagingOrder,
    item: MessagingOrderItem,
    customer: MessagingCustomer
  ): Promise<SendResult> {
    return this.handOff(composeDueReminder(order, item, customer), customer)
  }

  async sendReadyForPickup(
    order: MessagingOrder,
    customer: MessagingCustomer
  ): Promise<SendResult> {
    return this.handOff(composeReadyForPickup(order, customer), customer)
  }

  private handOff(body: string, customer: MessagingCustomer): SendResult {
    return {
      status: "manual",
      channel: this.channel,
      openUrl: waLink(customer.phone, body),
      body,
    }
  }
}

/** `https://wa.me/919876543210?text=…` — E.164 without the plus. */
function waLink(phone: string, body: string): string {
  const digits = phone.replace(/\D/g, "")
  return `https://wa.me/${digits}?text=${encodeURIComponent(body)}`
}

export function publicOrderUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"
  return `${base.replace(/\/$/, "")}/o/${token}`
}

function shopSignature(): string {
  const shop = readShopIdentity()
  const lines = [shop.name]
  if (shop.address) lines.push(shop.address)
  if (shop.phone) lines.push(formatPhone(shop.phone))
  return lines.join("\n")
}

function itemLines(items: readonly MessagingOrderItem[]): string {
  return items
    .map((item) => {
      const detail: string[] = []
      if (item.workType === "design_only") detail.push("design only")
      if (item.clothLength) detail.push(`${item.clothLength}m cloth`)
      if (item.clothSource === "shop") detail.push("cloth from us")

      return (
        `• ${item.garmentTypeName}` +
        (item.quantity > 1 ? ` × ${item.quantity}` : "") +
        ` — ${formatMoney(item.rate * item.quantity)}` +
        (detail.length > 0 ? `\n  ${detail.join(", ")}` : "") +
        `\n  Ready by ${formatDate(item.dueDate, { withYear: true })}`
      )
    })
    .join("\n")
}

function billLines(order: MessagingOrder): string {
  const lines = [`Subtotal: ${formatMoney(order.subtotal)}`]
  if (order.discount > 0) lines.push(`Discount: -${formatMoney(order.discount)}`)
  lines.push(`Total: ${formatMoney(order.total)}`)
  if (order.advancePaid > 0) {
    lines.push(`Advance paid: -${formatMoney(order.advancePaid)}`)
  }
  lines.push(
    order.balance < 0
      ? `To refund: ${formatMoney(Math.abs(order.balance))}`
      : `Balance: ${formatMoney(order.balance)}`
  )
  return lines.join("\n")
}

function orderPageLine(order: MessagingOrder): string {
  if (!order.publicToken) return ""
  return `\n\nPhotos, details and confirmation:\n${publicOrderUrl(order.publicToken)}`
}

export function composeOrderConfirmation(
  order: MessagingOrder,
  customer: MessagingCustomer
): string {
  return (
    `Hello ${customer.name}, here is your order ${order.orderNo} from ${readShopIdentity().name}.\n\n` +
    `${itemLines(order.items)}\n\n` +
    `${billLines(order)}` +
    `${orderPageLine(order)}\n\n` +
    `Please confirm so we can begin.\n\n` +
    shopSignature()
  )
}

export function composeBill(
  order: MessagingOrder,
  customer: MessagingCustomer
): string {
  const settled = order.balance <= 0

  return (
    `Thank you ${customer.name} — your order ${order.orderNo} is confirmed and we have started work.\n\n` +
    `${itemLines(order.items)}\n\n` +
    `${billLines(order)}\n\n` +
    (settled
      ? `Paid in full. Thank you.`
      : `Please settle ${formatMoney(order.balance)} on collection.`) +
    `${orderPageLine(order)}\n\n` +
    shopSignature()
  )
}

export function composeDueReminder(
  order: MessagingOrder,
  item: MessagingOrderItem,
  customer: MessagingCustomer
): string {
  return (
    `Hello ${customer.name}, a reminder about your ${item.garmentTypeName} ` +
    `on order ${order.orderNo}.\n\n` +
    `It is due on ${formatDate(item.dueDate, { withYear: true })}.` +
    `${orderPageLine(order)}\n\n` +
    shopSignature()
  )
}

export function composeReadyForPickup(
  order: MessagingOrder,
  customer: MessagingCustomer
): string {
  const balance =
    order.balance > 0
      ? `\n\nBalance to settle: ${formatMoney(order.balance)}.`
      : ""

  return (
    `Hello ${customer.name}, your order ${order.orderNo} is ready to collect.\n\n` +
    `${itemLines(order.items)}${balance}` +
    `${orderPageLine(order)}\n\n` +
    shopSignature()
  )
}
