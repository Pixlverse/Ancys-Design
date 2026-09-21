import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="max-w-3xl space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="space-y-2">
        {[0, 1, 2, 3].map((row) => (
          <Skeleton key={row} className="h-20 w-full" />
        ))}
      </div>
    </div>
  )
}
