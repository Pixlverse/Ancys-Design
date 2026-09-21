/**
 * The shop's own details, for invoices and outbound messages. Environment rather
 * than hard-coded, so the same build serves a shop that changes its phone number.
 */
export interface ShopIdentity {
  name: string
  phone?: string
  address?: string
}

export function readShopIdentity(): ShopIdentity {
  return {
    name: process.env.SHOP_NAME ?? "Ancys Design",
    phone: process.env.SHOP_PHONE || undefined,
    address: process.env.SHOP_ADDRESS || undefined,
  }
}
