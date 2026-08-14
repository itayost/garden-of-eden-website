import type { Metadata } from "next";
import { Suspense } from "react";
import { Dumbbell } from "lucide-react";

import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ExerciseTable } from "@/features/workouts/components/ExerciseTable";

export const metadata: Metadata = {
  title: "ספריית תרגילים | Garden of Eden",
};

export default function AdminExercisesPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">ספריית תרגילים</h1>
        <p className="text-muted-foreground">
          ניהול מאגר התרגילים לבניית תכניות אימון
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Dumbbell className="h-5 w-5" />
            תרגילים
          </CardTitle>
          <CardDescription>
            חפש, סנן, ערוך או מחק תרגילים. ניתן ליצור תרגיל חדש מהכפתור בצד.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* ExerciseTable reads ?equipment= via useSearchParams, which this
              statically-rendered page must bound with Suspense. */}
          <Suspense fallback={<Skeleton className="h-96 w-full" />}>
            <ExerciseTable />
          </Suspense>
        </CardContent>
      </Card>
    </div>
  );
}
