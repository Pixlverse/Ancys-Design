import { compare } from "bcryptjs"
import NextAuth, { type DefaultSession, type Session } from "next-auth"
import Credentials from "next-auth/providers/credentials"
import type { JWT } from "next-auth/jwt"

import { connectToDatabase } from "@/lib/db"
import { authConfig } from "@/lib/auth.config"
import { User } from "@/models/user"
import { credentialsSchema } from "@/schemas/auth"
import { userRoleSchema, type UserRole } from "@/schemas/user"

declare module "next-auth" {
  interface User {
    role: UserRole
  }

  interface Session {
    user: {
      id: string
      role: UserRole
    } & DefaultSession["user"]
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string
    role: UserRole
  }
}

// Referenced so TypeScript loads the module the augmentation above targets.
export type SessionToken = JWT

/** bcrypt hash of a value nobody can sign in with, used to equalise timing. */
const DUMMY_HASH = "$2b$10$CwTycUXWue0Thq9StjUM0uJ8.WQ9MG8hZ0kLQ0qFFVOQ0zBkuMSBu"

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        // Rule 5: validate before touching the database, even here.
        const parsed = credentialsSchema.safeParse(raw)
        if (!parsed.success) return null

        const { email, password } = parsed.data

        await connectToDatabase()
        const user = await User.findOne({ email })
          .select("+passwordHash")
          .lean()

        // Compare against a dummy hash when the user is missing so that a bad
        // email and a bad password take the same time to fail.
        const hash = user?.passwordHash ?? DUMMY_HASH
        const passwordMatches = await compare(password, hash)

        if (!user || !passwordMatches || !user.isActive) return null

        return {
          id: String(user._id),
          name: user.name,
          email: user.email,
          role: userRoleSchema.parse(user.role),
        }
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    jwt({ token, user }) {
      // `user` is only present on the request that signs in.
      if (user) {
        token.userId = String(user.id)
        token.role = user.role
      }
      return token
    },
    session({ session, token }) {
      session.user.id = token.userId
      session.user.role = token.role
      return session
    },
  },
})

export class AuthorizationError extends Error {
  constructor(
    message: string,
    readonly status: 401 | 403
  ) {
    super(message)
    this.name = "AuthorizationError"
  }
}

export type AuthenticatedSession = Session & {
  user: { id: string; role: UserRole }
}

/** Throws unless someone is signed in. Every route handler and server action
 *  starts with this or with requireRole (CLAUDE.md rule 6). */
export async function requireSession(): Promise<AuthenticatedSession> {
  const session = (await auth()) as Session | null
  if (!session?.user?.id) {
    throw new AuthorizationError("You are not signed in.", 401)
  }
  return session as AuthenticatedSession
}

/**
 * Throws unless the signed-in user holds one of `roles`. Roles are a flat list,
 * not a hierarchy: an owner-only action lists "owner", a staff-or-owner action
 * lists both.
 */
export async function requireRole(
  ...roles: readonly UserRole[]
): Promise<AuthenticatedSession> {
  const session = await requireSession()
  if (!roles.includes(session.user.role)) {
    throw new AuthorizationError(
      "You do not have permission to do that.",
      403
    )
  }
  return session
}
