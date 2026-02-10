import { Skeleton } from "@/components/ui/skeleton";

export default function SubmissionsLoading() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Skeleton className="h-8 w-32 mb-2" />
        <Skeleton className="h-5 w-56" />
      </div>

      {/* Tab bar */}
      <div className="flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-32 rounded-md" />
        ))}
      </div>

      {/* Table rows */}
      <div className="space-y-2">
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    </div>
  );
}
