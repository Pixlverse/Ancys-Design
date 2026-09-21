"use server"

import { signOut } from "@/lib/auth"
import { LOGIN_PATH } from "@/lib/auth.config"

export async function signOutAction(): Promise<void> {
  await signOut({ redirectTo: LOGIN_PATH })
}
