import { Skeleton } from "@/components/ui/skeleton";

export default function ScheduleLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-40 w-full" />
    </div>
  );
}
