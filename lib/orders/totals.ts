/**
 * Every figure on a bill, in integer paise (CLAUDE.md rule 1). One function, so
 * the live panel while taking an order, the stored order, and the invoice PDF
 * can never disagree about what the customer owes.
 */

export interface BillableItem {
  /** Snapshotted onto the item at order time; the rate card may move later. */
  rate: number
  quantity: number
}

export interface OrderTotals {
  subtotal: number
  discount: number
  total: number
  advancePaid: number
  balance: number
}

export function calculateTotals(
  items: readonly BillableItem[],
  discount = 0,
  advancePaid = 0
): OrderTotals {
  assertPaise(discount, "discount")
  assertPaise(advancePaid, "advancePaid")

  const subtotal = items.reduce((sum, item) => {
    assertPaise(item.rate, "rate")
    if (!Number.isInteger(item.quantity) || item.quantity < 1) {
      throw new Error(`Quantity must be a whole number of garments, got ${item.quantity}`)
    }
    return sum + item.rate * item.quantity
  }, 0)

  // A discount larger than the bill would make the total negative, which is a
  // refund the shop did not intend. Cap it instead.
  const cappedDiscount = Math.min(Math.max(discount, 0), subtotal)
  const total = subtotal - cappedDiscount

  return {
    subtotal,
    discount: cappedDiscount,
    total,
    advancePaid,
    // Overpaying leaves a negative balance on purpose: the shop owes it back.
    balance: total - advancePaid,
  }
}

function assertPaise(value: number, what: string): void {
  if (!Number.isInteger(value)) {
    throw new Error(`${what} must be integer paise, got ${value}`)
  }
}
