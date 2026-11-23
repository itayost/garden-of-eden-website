import { Lock } from "lucide-react";
import { COURSE_ACCESS_DENIED } from "@/features/course/lib/course-access-rule";
import type { AskParent } from "@/features/course/lib/load-course";
import type { Course } from "@/features/course/lib/types";
import {
  PurchaseRequestButton,
  REQUEST_LABELS,
} from "@/features/plans/components/PurchaseRequestButton";
import { CourseCover } from "./CourseCover";

interface CourseLockedNoticeProps {
  course: Pick<Course, "titleHe" | "descriptionHe" | "coverUrl">;
  /** Which "ask the parent" button to show, or null for none. */
  askParent: AskParent | null;
}

/**
 * A course the viewer may not open yet: the course's own header, then the
 * refusal and, where a purchase is possible, the parent request button.
 */
export function CourseLockedNotice({ course, askParent }: CourseLockedNoticeProps) {
  return (
    <CourseCover
      titleHe={course.titleHe}
      descriptionHe={course.descriptionHe}
      coverUrl={course.coverUrl}
    >
      <p className="flex items-center gap-2 text-sm font-medium">
        <Lock className="size-4 shrink-0 text-primary" aria-hidden="true" />
        {COURSE_ACCESS_DENIED}
      </p>
      {askParent && (
        <div className="pt-2">
          <PurchaseRequestButton label={REQUEST_LABELS[askParent]} />
        </div>
      )}
    </CourseCover>
  );
}
