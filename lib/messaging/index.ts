import { ManualWhatsAppProvider } from "@/lib/messaging/providers/manual"
import type { MessagingProvider } from "@/lib/messaging/types"

export type {
  MessagingCustomer,
  MessagingOrder,
  MessagingOrderItem,
  MessagingProvider,
  SendResult,
} from "@/lib/messaging/types"

/**
 * The only way to reach a customer. Chosen by MESSAGING_PROVIDER, defaulting to
 * manual — no feature may depend on the Cloud API existing (CLAUDE.md section 7).
 */
let cached: MessagingProvider | undefined

export function getMessagingProvider(): MessagingProvider {
  if (cached) return cached

  const configured = process.env.MESSAGING_PROVIDER ?? "manual"

  switch (configured) {
    case "manual":
      cached = new ManualWhatsAppProvider()
      break
    case "cloud-api":
      // Phase 5. Until it exists, fall back rather than break the shop: staff
      // can always send by hand.
      console.warn(
        "MESSAGING_PROVIDER=cloud-api is not built yet; using the manual provider."
      )
      cached = new ManualWhatsAppProvider()
      break
    default:
      console.warn(
        `Unknown MESSAGING_PROVIDER "${configured}"; using the manual provider.`
      )
      cached = new ManualWhatsAppProvider()
  }

  return cached
}

/** Tests and the provider switch reset the cached instance. */
export function resetMessagingProvider(): void {
  cached = undefined
}
