import { redirect } from "next/navigation"

import { AFTER_LOGIN_PATH } from "@/lib/auth.config"

export default function HomePage() {
  redirect(AFTER_LOGIN_PATH)
}
