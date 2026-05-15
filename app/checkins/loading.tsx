import { Skeleton } from "@/components/ui/skeleton";

export default function CheckinsLoading() {
  return (
    <div className="max-w-2xl mx-auto px-6 py-12 space-y-8 sm:px-4">
      {/* app header */}
      <div className="flex items-center justify-between pb-4">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-4 w-20 rounded-full" />
      </div>

      {/* page title */}
      <div className="space-y-1">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-3 w-24" />
      </div>

      <Skeleton className="h-px w-full" />

      {/* check-in rows */}
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <Skeleton className="h-3 w-20" />
          <div className="flex items-center justify-between">
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-3 w-12" />
          </div>
          <Skeleton className="h-px w-full mt-2" />
        </div>
      ))}

      {/* pagination */}
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-20 rounded-md" />
        <Skeleton className="h-7 w-24 rounded-md" />
        <Skeleton className="h-7 w-20 rounded-md" />
      </div>

      <Skeleton className="h-px w-full" />

      {/* footer */}
      <Skeleton className="h-3 w-64 mx-auto rounded-full" />
    </div>
  );
}
