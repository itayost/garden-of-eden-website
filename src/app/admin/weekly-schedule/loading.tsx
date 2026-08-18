import { Skeleton } from "@/components/ui/skeleton";

export default function WeeklyScheduleLoading() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-9 w-full" />
      {/* Tabs strip, then the week nav, then the day columns. */}
      <Skeleton className="h-9 w-full max-w-sm" />
      <Skeleton className="h-10 w-72" />
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => (
          <Skeleton key={index} className="h-64 w-full" />
        ))}
      </div>
    </div>
  );
}
