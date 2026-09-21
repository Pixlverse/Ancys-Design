import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { cloudinaryUrl } from "./cloudinary"

describe("cloudinaryUrl", () => {
  const original = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME

  beforeEach(() => {
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = "demo-shop"
  })

  afterEach(() => {
    process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME = original
  })

  it("builds a cropped, auto-format thumbnail URL", () => {
    expect(cloudinaryUrl("ancys/abc123", { width: 160, height: 160 })).toBe(
      "https://res.cloudinary.com/demo-shop/image/upload/c_fill,w_160,h_160,q_auto,f_auto/ancys/abc123"
    )
  })

  it("omits the height when only a width is asked for", () => {
    expect(cloudinaryUrl("ancys/abc123", { width: 1600, crop: "limit" })).toBe(
      "https://res.cloudinary.com/demo-shop/image/upload/c_limit,w_1600,q_auto,f_auto/ancys/abc123"
    )
  })

  it("never returns an original-size URL for a list", () => {
    const url = cloudinaryUrl("ancys/abc123", { width: 160, height: 160 })
    expect(url).toContain("w_160")
    expect(url).toContain("q_auto")
  })

  it("returns empty rather than a broken URL when Cloudinary is not configured", () => {
    delete process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
    expect(cloudinaryUrl("ancys/abc123", { width: 160 })).toBe("")
  })
})
