import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function UserDetailLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Skeleton className="h-6 w-20 mb-3" />
        <Skeleton className="h-8 w-44 mb-2" />
      </div>

      {/* Profile card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <Skeleton className="h-20 w-20 rounded-full" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-6 w-36" />
              <Skeleton className="h-4 w-48" />
              <div className="flex gap-2">
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-24 rounded-full" />
              </div>
            </div>
            <Skeleton className="h-10 w-28 rounded-md" />
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex gap-2 border-b pb-2">
        <Skeleton className="h-9 w-24 rounded-md" />
        <Skeleton className="h-9 w-24 rounded-md" />
        <Skeleton className="h-9 w-24 rounded-md" />
      </div>

      {/* Tab content */}
      <Card>
        <CardContent className="p-6 space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between py-3 border-b last:border-b-0">
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-5 w-36" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
