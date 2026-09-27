import { Skeleton } from "@/components/ui/skeleton";

export default function LessonLoading() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-5 w-28" />
      <Skeleton className="aspect-video w-full rounded-xl" />
      <Skeleton className="h-6 w-2/3" />
      <Skeleton className="h-11 w-full rounded-lg" />
      <div className="space-y-2">
        <Skeleton className="h-9 w-full rounded-lg" />
        <Skeleton className="h-9 w-full rounded-lg" />
        <Skeleton className="h-9 w-full rounded-lg" />
      </div>
    </div>
  );
}
