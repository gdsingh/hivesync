import { Skeleton } from "@/components/ui/skeleton";

export default function StatsLoading() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12 space-y-8">
      {/* app header */}
      <div className="flex items-center justify-between pb-4">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-4 w-20 rounded-full" />
      </div>

      {/* page title + mayorships */}
      <div className="flex items-start justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-3 w-36" />
        </div>
        <div className="space-y-1.5 text-right">
          <Skeleton className="h-3 w-20 ml-auto" />
          <Skeleton className="h-5 w-16 ml-auto rounded-full" />
        </div>
      </div>

      <Skeleton className="h-px w-full" />

      {/* top venues + categories */}
      <div className="grid grid-cols-2 gap-4">
        <div className="border rounded-xl p-4 space-y-3">
          <Skeleton className="h-4 w-24" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-3 w-3 rounded-full" />
              <Skeleton className="h-3 flex-1" />
              <Skeleton className="h-3 w-6" />
            </div>
          ))}
        </div>
        <div className="border rounded-xl p-4 space-y-3">
          <Skeleton className="h-4 w-28" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-3 w-3 rounded-full" />
              <Skeleton className="h-3 flex-1" />
              <Skeleton className="h-3 w-6" />
            </div>
          ))}
        </div>
      </div>

      {/* map */}
      <div className="space-y-3">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-20 rounded-full" />
          ))}
        </div>
      </div>

      {/* charts */}
      <div className="grid grid-cols-2 gap-4">
        <div className="border rounded-xl p-4 space-y-3">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-28 w-full rounded" />
        </div>
        <div className="border rounded-xl p-4 space-y-3">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-28 w-full rounded" />
        </div>
      </div>

      <Skeleton className="h-px w-full" />

      {/* footer */}
      <Skeleton className="h-3 w-64 mx-auto rounded-full" />
    </div>
  );
}
