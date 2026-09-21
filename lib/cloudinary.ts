/**
 * Client-safe Cloudinary helpers: upload limits and delivery URLs.
 *
 * Signing lives in lib/cloudinary-server.ts. This file is imported by client
 * components, so nothing in it may touch node:crypto or the API secret.
 */

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024

export const ACCEPTED_IMAGE_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const

export interface TransformOptions {
  width: number
  height?: number
  /** `fill` crops to fit the box; `limit` shrinks without cropping. */
  crop?: "fill" | "limit"
}

/**
 * A delivery URL with transforms baked in. Phone photos are several megabytes —
 * a list must never ship the original (CLAUDE.md section 8). `q_auto,f_auto`
 * lets Cloudinary pick the format and quality for the requesting browser.
 */
export function cloudinaryUrl(
  publicId: string,
  { width, height, crop = "fill" }: TransformOptions
): string {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  if (!cloudName) return ""

  const transforms = [
    `c_${crop}`,
    `w_${width}`,
    height ? `h_${height}` : undefined,
    "q_auto",
    "f_auto",
  ]
    .filter(Boolean)
    .join(",")

  return `https://res.cloudinary.com/${cloudName}/image/upload/${transforms}/${publicId}`
}

/** The sizes the portal actually asks for, named so they stay consistent. */
export const IMAGE_SIZES = {
  thumb: { width: 160, height: 160, crop: "fill" },
  card: { width: 480, height: 480, crop: "fill" },
  full: { width: 1600, crop: "limit" },
} as const satisfies Record<string, TransformOptions>
