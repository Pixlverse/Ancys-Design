import NextAuth from "next-auth"

import { authConfig } from "@/lib/auth.config"

/**
 * Only the edge-safe config is used here. The credentials provider in
 * lib/auth.ts imports mongoose and bcryptjs, neither of which can be bundled
 * for the edge runtime.
 */
export const { auth: middleware } = NextAuth(authConfig)

export default middleware

export const config = {
  // Everything except Next internals, the API (which checks the session itself),
  // and static files.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)"],
}
