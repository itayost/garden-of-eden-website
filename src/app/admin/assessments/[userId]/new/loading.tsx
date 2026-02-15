import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function NewAssessmentLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Skeleton className="h-6 w-20 mb-3" />
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-5 w-72" />
      </div>

      {/* Form */}
      <Card>
        <CardContent className="p-6 space-y-6">
          {/* Date field */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-10 w-full" />
          </div>

          {/* Sprint fields */}
          <Skeleton className="h-6 w-32" />
          <div className="grid sm:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>

          {/* Jump fields */}
          <Skeleton className="h-6 w-28" />
          <div className="grid sm:grid-cols-2 gap-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>

          {/* Additional fields */}
          <Skeleton className="h-6 w-36" />
          <div className="grid sm:grid-cols-2 gap-4">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-10 w-full" />
              </div>
            ))}
          </div>

          <Skeleton className="h-10 w-36" />
        </CardContent>
      </Card>
    </div>
  );
}
