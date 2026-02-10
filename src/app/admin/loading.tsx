import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function AdminLoading() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <Skeleton className="h-8 w-40 mb-2" />
        <Skeleton className="h-5 w-64" />
      </div>

      {/* Shift status card */}
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-[80px] w-full" />
        </CardContent>
      </Card>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <Skeleton className="h-12 w-12 rounded-xl shrink-0" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-8 w-10" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent activity */}
      <div className="grid lg:grid-cols-2 gap-6">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-40" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 5 }).map((_, j) => (
                <Skeleton key={j} className="h-14 w-full rounded-lg" />
              ))}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
