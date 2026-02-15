import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function PostWorkoutFormLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Skeleton className="h-8 w-52 mb-2" />
        <Skeleton className="h-5 w-72" />
      </div>

      {/* Form */}
      <Card>
        <CardContent className="p-6 space-y-6">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-10 w-full" />
            </div>
          ))}
          <Skeleton className="h-10 w-32" />
        </CardContent>
      </Card>
    </div>
  );
}
