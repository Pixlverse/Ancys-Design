"use server"

import { AuthError } from "next-auth"

import { AFTER_LOGIN_PATH } from "@/lib/auth.config"
import { signIn } from "@/lib/auth"
import { credentialsSchema } from "@/schemas/auth"

export type LoginState = { error?: string }

/**
 * `callbackUrl` arrives from the query string, so it is attacker-controlled.
 * Only same-site paths are honoured; anything else falls back to the default.
 */
function safeCallbackUrl(value: FormDataEntryValue | null): string {
  if (typeof value !== "string") return AFTER_LOGIN_PATH
  if (!value.startsWith("/") || value.startsWith("//")) return AFTER_LOGIN_PATH
  return value
}

export async function login(
  _previous: LoginState,
  formData: FormData
): Promise<LoginState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  })

  if (!parsed.success) {
    return { error: "Enter your email and password." }
  }

  try {
    await signIn("credentials", {
      ...parsed.data,
      redirectTo: safeCallbackUrl(formData.get("callbackUrl")),
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return {
        error:
          error.type === "CredentialsSignin"
            ? "That email and password did not match."
            : "Could not sign you in. Try again.",
      }
    }
    // A successful sign-in redirects by throwing; let that through.
    throw error
  }

  return {}
}
