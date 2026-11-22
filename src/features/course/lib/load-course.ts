import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { canAskParentToBuy } from "@/features/plans/lib/can-ask-parent";
import { getCourseUserId, getCourseViewer, getMyLessonProgress, getPublishedCourse } from "./actions/course-read";
import { canOpenCourse } from "./course-access-rule";
import { getCourseAccessContext } from "./course-access-context";
import type { CourseWithChapters, LessonProgressMap } from "./types";

/**
 * Everything a course page needs, and whether this viewer may open it. Shared
 * by the course home and the lesson page so the fetch and the gate stay one.
 */
export async function loadCourseForViewer(slug: string): Promise<{
  course: CourseWithChapters | null;
  progress: LessonProgressMap;
  canOpen: boolean;
  canAskParent: boolean;
}> {
  const [course, progress, viewer, ctx] = await Promise.all([
    getPublishedCourse(slug),
    getMyLessonProgress(),
    getCourseViewer(),
    getCourseAccessContext(),
  ]);
  const canOpen =
    course !== null &&
    canOpenCourse({ slug: course.slug, activeOnly: course.activeOnly }, viewer, ctx);
  const canAskParent =
    course !== null && !canOpen && viewer.role === "trainee"
      ? await askParentOrFalse()
      : false;
  return { course, progress, canOpen, canAskParent };
}

/** The buy button is a nicety: a failed lookup hides it and never breaks the page. */
async function askParentOrFalse(): Promise<boolean> {
  try {
    const userId = await getCourseUserId();
    return userId ? await canAskParentToBuy(createAdminClient(), userId) : false;
  } catch (error) {
    console.error("canAskParentToBuy failed:", error);
    return false;
  }
}
