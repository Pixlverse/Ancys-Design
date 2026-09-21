import { z } from "zod"

/**
 * The canonical role list. Lives here rather than in models/user.ts so that
 * edge-runtime code (middleware, the auth callbacks) can import it without
 * dragging mongoose into the edge bundle.
 */
export const USER_ROLES = ["owner", "staff", "tailor"] as const

export const userRoleSchema = z.enum(USER_ROLES)
export type UserRole = z.infer<typeof userRoleSchema>
