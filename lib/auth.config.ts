import type { NextAuthConfig } from "next-auth"

/**
 * The edge-safe half of the auth setup.
 *
 * Middleware runs on the edge runtime, where mongoose and bcryptjs cannot go.
 * This file therefore holds only what middleware needs — session shape, pages,
 * and the route guard — while the credentials provider that actually reads the
 * database lives in lib/auth.ts, which only ever runs on Node.
 */

/** Everything under the (portal) route group. Route groups are invisible in URLs,
 *  so the guard has to name the real paths. */
export const PORTAL_PATHS = [
  "/dashboard",
  "/customers",
  "/orders",
  "/calendar",
  "/settings",
  "/notifications",
] as const

export const LOGIN_PATH = "/login"
export const AFTER_LOGIN_PATH = "/dashboard"

export function isPortalPath(pathname: string): boolean {
  return PORTAL_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`)
  )
}

export const authConfig = {
  pages: {
    signIn: LOGIN_PATH,
  },
  session: { strategy: "jwt" },
  callbacks: {
    authorized({ auth, request }) {
      const signedIn = Boolean(auth?.user)
      const { pathname, search } = request.nextUrl

      if (isPortalPath(pathname)) {
        if (signedIn) return true
        // Returning false sends them to `pages.signIn` with a callbackUrl.
        const loginUrl = new URL(LOGIN_PATH, request.nextUrl)
        loginUrl.searchParams.set("callbackUrl", `${pathname}${search}`)
        return Response.redirect(loginUrl)
      }

      if (pathname === LOGIN_PATH && signedIn) {
        return Response.redirect(new URL(AFTER_LOGIN_PATH, request.nextUrl))
      }

      return true
    },
  },
  providers: [],
} satisfies NextAuthConfig
