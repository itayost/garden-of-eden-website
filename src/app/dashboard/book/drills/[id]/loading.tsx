import { Skeleton } from "@/components/ui/skeleton";

export default function DrillLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 pb-16">
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-64 w-full rounded-2xl" />
      <Skeleton className="h-32 w-full rounded-xl" />
    </div>
  );
}
