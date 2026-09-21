import { NextResponse } from "next/server"

/**
 * TEMPORARY diagnostic endpoint. Delete once the deployment is healthy.
 *
 * The production failure was opaque: every database call returned a generic
 * "unknown error" because the function was killed before Mongo could report
 * why. This connects with a short timeout and reports the real reason.
 *
 * Gated by a fixed key so it is not a public probe, and it reports only whether
 * variables are *present* — never their values.
 */
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const DIAGNOSTIC_KEY = "5d8c3f59dd20196d87104e0909c973f7"

export async function GET(request: Request) {
  if (new URL(request.url).searchParams.get("key") !== DIAGNOSTIC_KEY) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const present = (name: string) => Boolean(process.env[name]?.trim())

  const uri = process.env.MONGODB_URI ?? ""
  const env = {
    MONGODB_URI: present("MONGODB_URI"),
    AUTH_SECRET: present("AUTH_SECRET"),
    NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME: present("NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME"),
    CLOUDINARY_API_KEY: present("CLOUDINARY_API_KEY"),
    CLOUDINARY_API_SECRET: present("CLOUDINARY_API_SECRET"),
    CRON_SECRET: present("CRON_SECRET"),
  }

  // Shape checks that catch the classic paste mistakes, without echoing the value.
  const uriShape = {
    startsWithScheme: uri.startsWith("mongodb+srv://") || uri.startsWith("mongodb://"),
    hasLeadingWhitespace: uri !== uri.trimStart(),
    hasWrappingQuotes: uri.startsWith('"') || uri.startsWith("'"),
    length: uri.length,
    // The host and database name are not secrets, and a malformed paste shows
    // up here immediately as a database name full of dots and slashes.
    host: uri.replace(/^mongodb(\+srv)?:\/\//, "").replace(/^[^@/]*@/, "").split("/")[0] || "(none)",
    database: (uri.split("@")[1] ?? "").split("/").slice(1).join("/").split("?")[0] || "(none)",
  }

  // Quote check for the Cloudinary secret, the other classic paste mistake.
  const secret = process.env.CLOUDINARY_API_SECRET ?? ""
  const cloudinaryShape = {
    hasWrappingQuotes: secret.startsWith('"') || secret.startsWith("'"),
    length: secret.length,
  }

  const started = Date.now()
  let database: Record<string, unknown>
  try {
    const { connectToDatabase } = await import("@/lib/db")
    const mongoose = await connectToDatabase()
    const count = await mongoose.connection.collection("users").countDocuments()
    database = { ok: true, ms: Date.now() - started, userCount: count }
  } catch (error) {
    database = {
      ok: false,
      ms: Date.now() - started,
      name: error instanceof Error ? error.name : typeof error,
      // Mongo's message names hosts and the failure reason. It never contains
      // the password, which lives only in the URI we do not echo.
      message: error instanceof Error ? error.message.slice(0, 400) : String(error),
    }
  }

  return NextResponse.json({ env, uriShape, cloudinaryShape, database })
}
