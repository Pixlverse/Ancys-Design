import { Skeleton } from "@/components/ui/skeleton"

export default function Loading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-11 w-full max-w-2xl" />
      <Skeleton className="h-[34rem] w-full" />
    </div>
  )
}
