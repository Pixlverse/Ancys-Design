import type { ReactNode } from "react"
import type { LucideIcon } from "lucide-react"

export interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  /** What to do next. Never "No data" (CLAUDE.md section 8). */
  description: string
  action?: ReactNode
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl bg-card px-6 py-16 text-center tile-float">
      {Icon ? (
        <span className="mb-5 flex size-14 items-center justify-center rounded-2xl brand-fill">
          <Icon className="size-6" aria-hidden />
        </span>
      ) : null}
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
        {description}
      </p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  )
}
