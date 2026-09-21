import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="space-y-3">
        {[0, 1, 2].map((row) => (
          <Skeleton key={row} className="h-20 w-full" />
        ))}
      </div>
    </div>
  )
}
