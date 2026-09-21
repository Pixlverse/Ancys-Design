import type { CustomerDocument } from "@/models/customer"
import type { OrderDocument } from "@/models/order"
import type { MessagingCustomer, MessagingOrder } from "@/lib/messaging/types"

/**
 * Maps stored documents onto the shapes messaging works with, so providers never
 * touch mongoose and can be tested with plain objects.
 */
export function toMessagingOrder(
  order: OrderDocument & { _id: unknown }
): MessagingOrder {
  return {
    id: String(order._id),
    orderNo: order.orderNo,
    items: order.items.map((item) => ({
      id: String(item._id),
      garmentTypeName: item.garmentTypeName,
      quantity: item.quantity,
      rate: item.rate,
      dueDate: item.dueDate,
      workType: item.workType,
      clothLength: item.clothLength,
      clothSource: item.clothSource,
    })),
    subtotal: order.subtotal,
    discount: order.discount,
    total: order.total,
    advancePaid: order.advancePaid,
    balance: order.balance,
    publicToken: order.confirmation?.publicToken,
  }
}

export function toMessagingCustomer(
  customer: CustomerDocument & { _id: unknown }
): MessagingCustomer {
  return {
    id: String(customer._id),
    name: customer.name,
    phone: customer.phone,
  }
}
