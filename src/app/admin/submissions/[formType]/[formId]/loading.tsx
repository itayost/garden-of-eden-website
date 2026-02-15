import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function SubmissionDetailLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Skeleton className="h-6 w-20 mb-3" />
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-5 w-64" />
      </div>

      {/* Detail card */}
      <Card>
        <CardContent className="p-6 space-y-4">
          {/* Submitter info */}
          <div className="flex items-center gap-3 pb-4 border-b">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="space-y-1">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-40" />
            </div>
          </div>

          {/* Form fields */}
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-3 border-b last:border-b-0">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-40" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
