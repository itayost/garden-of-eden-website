import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { listCourseAdminTree } from "@/features/course/lib/actions/admin-course";
import { CourseAdminClient } from "@/features/course/components/admin/CourseAdminClient";

export const metadata: Metadata = {
  title: "הקורס הדיגיטלי | Garden of Eden",
};

export const dynamic = "force-dynamic";

export default async function AdminCoursePage() {
  const course = await listCourseAdminTree();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mb-2 flex items-center gap-2 text-3xl font-bold">
            <GraduationCap className="h-7 w-7" aria-hidden="true" />
            הקורס הדיגיטלי
          </h1>
          <p className="text-muted-foreground">
            ניהול פרקים ושיעורים, שמות ופרסום
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/admin/course/progress">
            <BarChart3 className="h-4 w-4 ms-2" />
            התקדמות מתאמנים
          </Link>
        </Button>
      </div>

      {course ? (
        <CourseAdminClient course={course} />
      ) : (
        <div className="rounded-xl border border-dashed border-border bg-card/50 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            עדיין לא נוצר קורס. הרץ את סקריפט הזריעה כדי לייבא את הפרקים
            והשיעורים.
          </p>
        </div>
      )}
    </div>
  );
}
