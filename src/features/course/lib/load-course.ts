import "server-only";

import { getCourseViewer, getMyLessonProgress, getPublishedCourse } from "./actions/course-read";
import { canOpenCourse } from "./course-access-rule";
import type { CourseWithChapters, LessonProgressMap } from "./types";

/**
 * Everything a course page needs, and whether this viewer may open it. Shared
 * by the course home and the lesson page so the fetch and the gate stay one.
 */
export async function loadCourseForViewer(slug: string): Promise<{
  course: CourseWithChapters | null;
  progress: LessonProgressMap;
  canOpen: boolean;
}> {
  const [course, progress, viewer] = await Promise.all([
    getPublishedCourse(slug),
    getMyLessonProgress(),
    getCourseViewer(),
  ]);
  return { course, progress, canOpen: course !== null && canOpenCourse(course.activeOnly, viewer) };
}
