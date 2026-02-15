import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function NutritionUserLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Skeleton className="h-6 w-20 mb-3" />
        <Skeleton className="h-8 w-52 mb-2" />
        <Skeleton className="h-5 w-72" />
      </div>

      {/* Chart skeleton */}
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-6 w-36 mb-4" />
          <Skeleton className="h-52 w-full rounded-md" />
        </CardContent>
      </Card>

      {/* Form */}
      <Card>
        <CardContent className="p-6 space-y-6">
          <Skeleton className="h-6 w-40 mb-2" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
          {/* File upload area */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-24 w-full rounded-md border-2 border-dashed" />
          </div>
          <Skeleton className="h-10 w-32" />
        </CardContent>
      </Card>
    </div>
  );
}
