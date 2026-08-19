import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { getCourseProgressReport } from "@/features/course/lib/actions/course-progress-report";
import { CourseProgressExportButton } from "@/components/admin/exports/CourseProgressExportButton";
import { BrandProgress } from "@/components/ui/brand-progress";

export const metadata: Metadata = {
  title: "התקדמות בקורס | Garden of Eden",
};

export const dynamic = "force-dynamic";

export default async function CourseProgressPage() {
  const report = await getCourseProgressReport();

  if (!report) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/50 py-16 text-center">
        <p className="text-sm text-muted-foreground">
          אין קורס להצגה, או שאין לך הרשאה.
        </p>
      </div>
    );
  }

  const started = report.trainees.filter((t) => t.doneCount > 0);
  const finished = report.trainees.filter(
    (t) => report.lessonTotal > 0 && t.doneCount >= report.lessonTotal
  );

  return (
    <div className="space-y-6">
      <div>
        <Link
          href="/admin/course"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
          חזרה לניהול הקורס
        </Link>
        <h1 className="mt-2 text-3xl font-bold">התקדמות בקורס</h1>
        <p className="text-muted-foreground">{report.courseTitleHe}</p>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "מתאמנים", value: report.trainees.length },
          { label: "התחילו", value: started.length },
          { label: "סיימו", value: finished.length },
          { label: "שיעורים בקורס", value: report.lessonTotal },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl border border-border p-3">
            <dd className="text-2xl font-black tabular-nums text-primary">
              {stat.value}
            </dd>
            <dt className="text-xs text-muted-foreground">{stat.label}</dt>
          </div>
        ))}
      </dl>

      <div className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold">לפי מתאמן</h2>
        <CourseProgressExportButton
          trainees={report.trainees}
          lessonTotal={report.lessonTotal}
        />
      </div>

      {report.trainees.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
          אין מתאמנים להצגה.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {report.trainees.map((trainee) => (
            <li
              key={trainee.userId}
              className="flex items-center gap-3 rounded-lg border border-border px-3 py-2"
            >
              <span className="min-w-0 flex-1 truncate text-sm font-medium">
                {trainee.fullName}
              </span>

              <span className="hidden w-40 shrink-0 sm:block">
                <BrandProgress
                  value={trainee.doneCount}
                  max={report.lessonTotal}
                  size="sm"
                  label={`${trainee.fullName}: ${trainee.doneCount} מתוך ${report.lessonTotal}`}
                />
              </span>

              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {trainee.doneCount}/{report.lessonTotal}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
