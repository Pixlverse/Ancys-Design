import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-11 w-full max-w-xl" />
      <div className="space-y-2">
        {[0, 1, 2, 3, 4].map((row) => (
          <Skeleton key={row} className="h-16 w-full" />
        ))}
      </div>
    </div>
  )
}
