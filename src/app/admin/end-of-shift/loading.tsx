import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function EndOfShiftLoading() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Skeleton className="h-8 w-44 mb-2" />
        <Skeleton className="h-5 w-72" />
      </div>

      {/* Shift report form */}
      <Card>
        <CardContent className="p-6 space-y-6">
          {/* Date and shift type */}
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>

          {/* Attendance checkboxes */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-28" />
            <div className="grid sm:grid-cols-2 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Skeleton className="h-5 w-5 rounded" />
                  <Skeleton className="h-4 w-28" />
                </div>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-24 w-full" />
          </div>

          <Skeleton className="h-10 w-36" />
        </CardContent>
      </Card>
    </div>
  );
}
