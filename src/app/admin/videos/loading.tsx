import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminVideosLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-8 w-40 mb-2" />
          <Skeleton className="h-5 w-56" />
        </div>
        <Skeleton className="h-10 w-32 rounded-md" />
      </div>

      {/* Toolbar */}
      <div className="flex gap-3">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-32" />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="flex items-center gap-4 p-4 border-b">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
          </div>
          <div className="divide-y">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 p-4">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-8 w-8 rounded" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
