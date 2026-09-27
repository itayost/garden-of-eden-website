import { COURSE_ACCESS_DENIED } from "@/features/course/lib/course-access-rule";

/** Shown instead of a course the viewer may not open. */
export function CourseAccessNotice() {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/50 py-16 text-center">
      <p className="text-sm text-muted-foreground">{COURSE_ACCESS_DENIED}</p>
    </div>
  );
}
