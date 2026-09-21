import Link from "next/link"
import { ChevronRight, Shirt, Users } from "lucide-react"
import type { Metadata } from "next"

import { Card, CardContent } from "@/components/ui/card"

export const metadata: Metadata = { title: "Settings · Ancys Design" }

const SETTINGS_SECTIONS = [
  {
    href: "/settings/garment-types",
    icon: Shirt,
    title: "Garment types",
    description:
      "The rate card, and the measurement fields each garment asks for.",
  },
  {
    href: "/settings/assignees",
    icon: Users,
    title: "Assignees",
    description: "The people work is given to. No logins, just names and numbers.",
  },
]

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Settings</h1>

      <div className="grid gap-3 sm:grid-cols-2">
        {SETTINGS_SECTIONS.map(({ href, icon: Icon, title, description }) => (
          <Link key={href} href={href} className="block">
            <Card className="h-full transition-transform hover:-translate-y-0.5">
              <CardContent className="flex items-center gap-4">
                <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl brand-fill">
                  <Icon className="size-5" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{title}</p>
                  <p className="text-sm text-muted-foreground">{description}</p>
                </div>
                <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
