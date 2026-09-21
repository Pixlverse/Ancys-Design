import { NextResponse } from "next/server"

import { AuthorizationError, requireRole } from "@/lib/auth"
import {
  createUploadSignature,
  readCloudinaryConfig,
} from "@/lib/cloudinary-server"

/**
 * Hands the browser a short-lived signature so it can upload straight to
 * Cloudinary. The API secret is used to sign and never leaves this process
 * (CLAUDE.md phase 2.3).
 */
export async function POST() {
  try {
    await requireRole("owner", "staff")
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return NextResponse.json({ error: error.message }, { status: error.status })
    }
    throw error
  }

  const config = readCloudinaryConfig()
  if (!config) {
    return NextResponse.json(
      {
        error:
          "Image upload is not configured. Add the Cloudinary keys to the environment.",
      },
      { status: 503 }
    )
  }

  const signature = createUploadSignature(config)

  // Belt and braces: whatever else changes, the secret must not be in here.
  return NextResponse.json(signature)
}
