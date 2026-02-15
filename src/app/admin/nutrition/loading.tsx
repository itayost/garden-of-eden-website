import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function NutritionLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Skeleton className="h-8 w-36 mb-2" />
        <Skeleton className="h-5 w-60" />
      </div>

      {/* Search */}
      <Skeleton className="h-10 w-64" />

      {/* Trainee cards grid */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6 space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-1">
                  <Skeleton className="h-5 w-28" />
                  <Skeleton className="h-4 w-36" />
                </div>
              </div>
              <Skeleton className="h-5 w-24 rounded-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
