import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      {/* Welcome header */}
      <div>
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-5 w-72" />
      </div>

      {/* Player card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <Skeleton className="h-[200px] w-[150px] rounded-lg" />
            <div className="flex-1 space-y-3">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-64" />
              <div className="flex gap-2">
                <Skeleton className="h-6 w-20 rounded-full" />
                <Skeleton className="h-6 w-20 rounded-full" />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Quick actions */}
      <div className="space-y-4">
        <Skeleton className="h-7 w-32" />
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-12 w-12 rounded-xl mb-4" />
                <Skeleton className="h-5 w-28 mb-2" />
                <Skeleton className="h-4 w-36" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Stats grid */}
      <div className="space-y-4">
        <Skeleton className="h-7 w-40" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="pt-6">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-12" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
