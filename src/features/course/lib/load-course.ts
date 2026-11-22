import "server-only";

import { getCourseViewer, getMyLessonProgress, getPublishedCourse } from "./actions/course-read";
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
  // Task 7 fills this in.
  return { course, progress, canOpen, canAskParent: false };
}
