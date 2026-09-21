import { describe, expect, it } from "vitest"

import {
  PUBLIC_TOKEN_LENGTH,
  createPublicToken,
  isPublicToken,
} from "./token"

describe("createPublicToken", () => {
  it("is 32 characters, as the spec requires", () => {
    expect(createPublicToken()).toHaveLength(PUBLIC_TOKEN_LENGTH)
  })

  it("is URL-safe, so it survives being pasted into a message", () => {
    for (let i = 0; i < 50; i++) {
      const token = createPublicToken()
      expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
      expect(encodeURIComponent(token)).toBe(token)
    }
  })

  it("does not repeat", () => {
    const tokens = new Set(Array.from({ length: 2000 }, createPublicToken))
    expect(tokens.size).toBe(2000)
  })

  it("is not guessable from a counter or a timestamp", () => {
    // Two tokens made back to back must share no meaningful prefix.
    const a = createPublicToken()
    const b = createPublicToken()
    let shared = 0
    while (shared < a.length && a[shared] === b[shared]) shared++
    expect(shared).toBeLessThan(6)
  })
})

describe("isPublicToken", () => {
  it("accepts what createPublicToken makes", () => {
    for (let i = 0; i < 20; i++) {
      expect(isPublicToken(createPublicToken())).toBe(true)
    }
  })

  it("rejects anything else, including an order id", () => {
    expect(isPublicToken("")).toBe(false)
    expect(isPublicToken("6aacdac1ab3de1c5b8ed493e")).toBe(false) // 24 chars
    expect(isPublicToken("a".repeat(31))).toBe(false)
    expect(isPublicToken("a".repeat(33))).toBe(false)
    expect(isPublicToken(`${"a".repeat(31)}/`)).toBe(false)
    expect(isPublicToken(`${"a".repeat(28)}<img`)).toBe(false)
  })
})
