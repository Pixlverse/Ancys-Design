/**
 * The contract every messaging provider satisfies (CLAUDE.md section 7).
 *
 * Callers know nothing about how a message travels. The manual provider composes
 * text and hands back a link for staff to send from their own phone; the Cloud
 * API provider in phase 5 sends it itself. Both return the same shape, so no
 * calling code changes when the provider does.
 */

export interface MessagingOrderItem {
  id: string
  garmentTypeName: string
  quantity: number
  /** Integer paise. */
  rate: number
  dueDate: Date
  /** "stitching" or "design_only" — design work is quoted differently. */
  workType?: string
  /** Metres of cloth, quoted back so the customer can check it. */
  clothLength?: number
  clothSource?: string
}

export interface MessagingOrder {
  id: string
  orderNo: string
  items: readonly MessagingOrderItem[]
  /** All integer paise. */
  subtotal: number
  discount: number
  total: number
  advancePaid: number
  balance: number
  /** Present once the order has been sent; addresses the public order page. */
  publicToken?: string
}

export interface MessagingCustomer {
  id: string
  name: string
  /** E.164. */
  phone: string
}

export type SendResult =
  /** The provider delivered it. `messageId` correlates webhook events later. */
  | { status: "sent"; channel: string; messageId?: string }
  /**
   * A person has to finish the job — open `openUrl` and press send. This is not
   * "WhatsApp link": it is "this message needs a human", which is a fact about
   * the send, not about which provider produced it.
   */
  | { status: "manual"; channel: string; openUrl: string; body: string }
  | { status: "failed"; channel: string; error: string }

export interface MessagingProvider {
  /** Name for logs and for the order's confirmation record. */
  readonly channel: string

  sendOrderConfirmation(
    order: MessagingOrder,
    customer: MessagingCustomer
  ): Promise<SendResult>

  sendBill(
    order: MessagingOrder,
    customer: MessagingCustomer,
    /** Optional: a link-based provider cannot carry an attachment. */
    pdf?: Buffer
  ): Promise<SendResult>

  sendDueReminder(
    order: MessagingOrder,
    item: MessagingOrderItem,
    customer: MessagingCustomer
  ): Promise<SendResult>

  sendReadyForPickup(
    order: MessagingOrder,
    customer: MessagingCustomer
  ): Promise<SendResult>
}
