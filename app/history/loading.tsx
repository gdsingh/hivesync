import { Skeleton } from "@/components/ui/skeleton";

export default function HistoryLoading() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-12 space-y-8">
      {/* app header */}
      <div className="flex items-center justify-between pb-4">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-4 w-20 rounded-full" />
      </div>

      {/* page title */}
      <Skeleton className="h-5 w-36" />

      <Skeleton className="h-px w-full" />

      {/* log rows */}
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} className="space-y-0">
          <div className="flex items-center justify-between py-3 gap-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-3 w-3 rounded-full" />
              <Skeleton className="h-3 w-8" />
              <Skeleton className="h-3 w-32" />
            </div>
            <div className="text-right space-y-1">
              <Skeleton className="h-3 w-24 ml-auto" />
              <Skeleton className="h-3 w-14 ml-auto" />
            </div>
          </div>
          {i < 9 && <Skeleton className="h-px w-full" />}
        </div>
      ))}

      <Skeleton className="h-px w-full" />

      {/* footer */}
      <Skeleton className="h-3 w-64 mx-auto rounded-full" />
    </div>
  );
}
