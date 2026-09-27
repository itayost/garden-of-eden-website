import { COURSE_ACCESS_DENIED } from "@/features/course/lib/course-access-rule";

interface CourseAccessNoticeProps {
  /** Defaults to the active-only refusal. */
  message?: string;
}

/** Shown in place of a course's content: not published, empty, or not for this viewer. */
export function CourseAccessNotice({ message = COURSE_ACCESS_DENIED }: CourseAccessNoticeProps) {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/50 py-16 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}
