import { NextResponse } from "next/server"

import { generateReminders } from "@/lib/notifications/reminders"

/**
 * The daily reminder sweep. Public URL, so the bearer token is the whole of the
 * authentication — CLAUDE.md rule 6 permits a webhook to verify a signature
 * instead of a session, and this is that case.
 *
 * Vercel Cron calls it with `Authorization: Bearer $CRON_SECRET`.
 */
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function authorise(request: Request): boolean {
  const secret = process.env.CRON_SECRET
  // No secret configured means the endpoint is closed, not open.
  if (!secret) return false

  const header = request.headers.get("authorization") ?? ""
  const offered = header.startsWith("Bearer ") ? header.slice(7) : ""

  // Constant-time comparison: this endpoint is reachable by anyone.
  if (offered.length !== secret.length) return false
  let difference = 0
  for (let i = 0; i < secret.length; i++) {
    difference |= offered.charCodeAt(i) ^ secret.charCodeAt(i)
  }
  return difference === 0
}

async function run(request: Request) {
  if (!authorise(request)) {
    return NextResponse.json({ error: "Unauthorised" }, { status: 401 })
  }

  const result = await generateReminders()
  return NextResponse.json({ ok: true, ...result })
}

export async function GET(request: Request) {
  return run(request)
}

/** POST too, so the job can be triggered by hand without a browser. */
export async function POST(request: Request) {
  return run(request)
}
