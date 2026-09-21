import { randomBytes } from "node:crypto"

/**
 * The public order page is reachable by anyone holding its link, so the token is
 * the only thing standing between a stranger and a customer's order. It is
 * random, not derived from the order id — the id never appears in a URL
 * (CLAUDE.md section 7).
 */
export const PUBLIC_TOKEN_LENGTH = 32

/** 24 random bytes encoded base64url: 32 characters, 192 bits of entropy. */
export function createPublicToken(): string {
  return randomBytes(24).toString("base64url")
}

/** Shape check before a token ever reaches the database. */
export function isPublicToken(value: string): boolean {
  return new RegExp(`^[A-Za-z0-9_-]{${PUBLIC_TOKEN_LENGTH}}$`).test(value)
}
