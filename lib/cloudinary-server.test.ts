import { describe, expect, it } from "vitest"

import { signUploadParams } from "./cloudinary-server"

describe("signUploadParams", () => {
  it("does not depend on the order the parameters are given in", () => {
    const a = signUploadParams({ timestamp: 1789700000, folder: "ancys" }, "secret")
    const b = signUploadParams({ folder: "ancys", timestamp: 1789700000 }, "secret")
    expect(a).toBe(b)
  })

  it("changes with the secret", () => {
    const params = { timestamp: 1789700000, folder: "ancys" }
    expect(signUploadParams(params, "secret-a")).not.toBe(
      signUploadParams(params, "secret-b")
    )
  })

  it("changes with the timestamp, so a signature cannot be replayed forever", () => {
    expect(signUploadParams({ timestamp: 1 }, "s")).not.toBe(
      signUploadParams({ timestamp: 2 }, "s")
    )
  })

  it("omits empty and undefined values, as Cloudinary's own SDKs do", () => {
    // Including them would change the hash and the upload would be rejected.
    expect(
      signUploadParams({ timestamp: 1789700000, folder: undefined }, "s")
    ).toBe(signUploadParams({ timestamp: 1789700000 }, "s"))
    expect(signUploadParams({ timestamp: 1789700000, folder: "" }, "s")).toBe(
      signUploadParams({ timestamp: 1789700000 }, "s")
    )
  })

  it("produces a SHA-1 hex digest", () => {
    const signature = signUploadParams({ timestamp: 1789700000 }, "s")
    expect(signature).toMatch(/^[0-9a-f]{40}$/)
  })

  it("is stable — pinned so a refactor cannot silently change the hash", () => {
    expect(
      signUploadParams(
        { folder: "ancys-design", timestamp: 1789700000 },
        "test-secret"
      )
    ).toBe("4b1227554236e96421a36a83c08a47c88c9f9f05")
  })
})
