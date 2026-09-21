import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="max-w-3xl space-y-5">
      <Skeleton className="h-10 w-64 rounded-2xl" />
      <Skeleton className="h-64 w-full rounded-3xl" />
      <Skeleton className="h-40 w-full rounded-3xl" />
    </div>
  )
}
