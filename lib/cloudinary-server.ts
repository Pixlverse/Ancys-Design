import { createHash } from "node:crypto"

/**
 * The server half of the Cloudinary integration. Kept apart from lib/cloudinary.ts
 * because that one is imported by client components, and node:crypto cannot be
 * bundled for the browser — a split that also makes it structurally impossible
 * to leak the API secret into client JavaScript.
 */

export interface UploadSignature {
  cloudName: string
  apiKey: string
  timestamp: number
  folder: string
  signature: string
}

/**
 * Builds the SHA-1 Cloudinary expects: parameters sorted by key, joined as
 * `k=v&k=v`, with the API secret appended. Empty values are left out, exactly as
 * Cloudinary's own SDKs do — including one would change the hash and be rejected.
 */
export function signUploadParams(
  params: Record<string, string | number | undefined>,
  apiSecret: string
): string {
  const serialised = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== "")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, value]) => `${key}=${String(value)}`)
    .join("&")

  return createHash("sha1").update(`${serialised}${apiSecret}`).digest("hex")
}

export interface CloudinaryConfig {
  cloudName: string
  apiKey: string
  apiSecret: string
  folder: string
}

/** Reads config at call time, so a build without Cloudinary set still succeeds. */
export function readCloudinaryConfig(): CloudinaryConfig | null {
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME
  const apiKey = process.env.CLOUDINARY_API_KEY
  const apiSecret = process.env.CLOUDINARY_API_SECRET

  if (!cloudName || !apiKey || !apiSecret) return null

  return {
    cloudName,
    apiKey,
    apiSecret,
    folder: process.env.CLOUDINARY_UPLOAD_FOLDER ?? "ancys-design",
  }
}

export function createUploadSignature(
  config: CloudinaryConfig,
  now: Date = new Date()
): UploadSignature {
  const timestamp = Math.floor(now.getTime() / 1000)
  const signature = signUploadParams(
    { folder: config.folder, timestamp },
    config.apiSecret
  )

  return {
    cloudName: config.cloudName,
    apiKey: config.apiKey,
    timestamp,
    folder: config.folder,
    signature,
  }
}
