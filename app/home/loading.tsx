import { Skeleton } from "@/components/ui/skeleton";

export default function HomeLoading() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12 space-y-8">
      {/* app header */}
      <div className="flex items-center justify-between pb-4">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-4 w-20 rounded-full" />
      </div>

      {/* profile */}
      <div className="flex items-start gap-4">
        <Skeleton className="h-12 w-12 rounded-full shrink-0" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-3 w-20 mt-1" />
        </div>
      </div>

      <Skeleton className="h-px w-full" />

      {/* sync tabs */}
      <div className="space-y-4">
        <Skeleton className="h-8 w-full rounded-lg" />
        <div className="space-y-3">
          <Skeleton className="h-7 w-full rounded-md" />
          <Skeleton className="h-7 w-3/4 rounded-md" />
        </div>
      </div>

      <Skeleton className="h-px w-full" />

      {/* footer */}
      <Skeleton className="h-3 w-48 mx-auto rounded-full" />
    </div>
  );
}
