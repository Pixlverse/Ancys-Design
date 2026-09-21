import mongoose from "mongoose"

/**
 * Mongoose keeps an internal connection pool, but Next.js hot reload throws away
 * module state on every edit. Without a cache on `globalThis` each recompile would
 * open a fresh pool and Atlas would run out of connections within a few saves.
 */
interface MongooseCache {
  conn: typeof mongoose | null
  promise: Promise<typeof mongoose> | null
}

declare global {
  var __mongooseCache: MongooseCache | undefined
}

const cache: MongooseCache = globalThis.__mongooseCache ?? {
  conn: null,
  promise: null,
}
globalThis.__mongooseCache = cache

export async function connectToDatabase(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn

  const uri = process.env.MONGODB_URI
  if (!uri) {
    throw new Error("MONGODB_URI is not set. Copy .env.example to .env.local.")
  }

  if (!cache.promise) {
    cache.promise = mongoose
      .connect(uri, {
        // Fail fast instead of silently queueing writes when the pool is down.
        bufferCommands: false,
        // Each serverless instance opens its own pool. Mongoose defaults to 100
        // connections per instance, and an Atlas M0 cluster allows 500 in total
        // — a handful of concurrent functions would exhaust the cluster.
        maxPoolSize: 10,
        // Must sit inside the host's function budget. The default is 30s, which
        // is longer than Netlify's 10s limit, so an unreachable cluster killed
        // the function with a generic error before Mongo could report why.
        serverSelectionTimeoutMS: 8000,
      })
      .catch((error: unknown) => {
        // Let the next call retry rather than caching a rejected promise forever.
        cache.promise = null
        throw error
      })
  }

  cache.conn = await cache.promise
  return cache.conn
}

/** Closes the pool. For scripts and tests only — never call this from a request. */
export async function disconnectFromDatabase(): Promise<void> {
  if (!cache.conn) return
  await cache.conn.disconnect()
  cache.conn = null
  cache.promise = null
}
