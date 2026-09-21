import { Scissors } from "lucide-react"
import type { Metadata } from "next"

import { LoginForm } from "./login-form"
import { AFTER_LOGIN_PATH } from "@/lib/auth.config"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const metadata: Metadata = {
  title: "Sign in · Ancys Design",
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>
}) {
  const { callbackUrl } = await searchParams

  return (
    <main className="relative flex min-h-svh items-center justify-center overflow-hidden bg-background p-4">
      {/* Soft colour blooms, so the first screen is not a white box. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 -left-24 size-96 rounded-full opacity-[0.12] blur-3xl brand-fill"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-24 -bottom-32 size-96 rounded-full opacity-20 blur-3xl warm-fill"
      />

      <Card className="relative w-full max-w-sm tile-float">
        <CardHeader className="items-center text-center">
          <span className="mx-auto mb-2 flex size-14 items-center justify-center rounded-2xl brand-fill">
            <Scissors className="size-6" aria-hidden />
          </span>
          <CardTitle className="text-2xl">Ancys Design</CardTitle>
          <CardDescription>Sign in to the shop portal.</CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm callbackUrl={callbackUrl ?? AFTER_LOGIN_PATH} />
        </CardContent>
      </Card>
    </main>
  )
}
