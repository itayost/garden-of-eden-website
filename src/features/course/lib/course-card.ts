import { countCourseProgress } from "./progress-utils";
import type { CourseWithChapters, LessonProgressMap } from "./types";

/** One course in the trainee course list. */
export interface CourseCard {
  slug: string;
  titleHe: string;
  descriptionHe: string | null;
  coverUrl: string | null;
  done: number;
  total: number;
  canOpen: boolean;
}

/**
 * A published course's card with this viewer's progress and access, or null
 * when it has no published lesson: unpublishing a course's last lesson can
 * leave it published and empty, and an empty card leads nowhere. Pure.
 */
export function courseCardFor(
  course: CourseWithChapters,
  progress: LessonProgressMap,
  canOpen: boolean
): CourseCard | null {
  const { done, total } = countCourseProgress(course.chapters, progress);
  if (total === 0) return null;
  return {
    slug: course.slug,
    titleHe: course.titleHe,
    descriptionHe: course.descriptionHe,
    coverUrl: course.coverUrl,
    done,
    total,
    canOpen,
  };
}
