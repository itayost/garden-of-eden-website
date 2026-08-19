/**
 * Domain types for the trainee video course.
 *
 * Every trainee has access to the course, so there is no enrollment concept
 * here -- visibility is decided by `isPublished` and enforced by RLS.
 */

export type VideoQuality = "hd" | "sd";

export interface CourseLesson {
  id: string;
  chapterId: string;
  slug: string;
  titleHe: string;
  descriptionHe: string | null;
  /** Storage key for the 720p rendition. Null until a video is uploaded. */
  videoPath: string | null;
  /** Storage key for the 480p fallback. Null when only one rendition exists. */
  videoPathSd: string | null;
  durationSec: number;
  /** True while the title is still a generated placeholder. Blocks publishing. */
  needsTitle: boolean;
  isPublished: boolean;
  orderIndex: number;
}

export interface CourseChapter {
  id: string;
  courseId: string;
  slug: string;
  titleHe: string;
  subtitleHe: string | null;
  needsTitle: boolean;
  orderIndex: number;
}

export interface CourseChapterWithLessons extends CourseChapter {
  lessons: CourseLesson[];
}

export interface Course {
  id: string;
  slug: string;
  titleHe: string;
  descriptionHe: string | null;
  coverUrl: string | null;
  isPublished: boolean;
  needsTitle: boolean;
  orderIndex: number;
}

export interface CourseWithChapters extends Course {
  chapters: CourseChapterWithLessons[];
}

export interface LessonProgress {
  lessonId: string;
  lastPositionSec: number;
  watchedSec: number;
  /** ISO timestamp, or null while the lesson is still in progress. */
  completedAt: string | null;
}

export type LessonProgressMap = Readonly<Record<string, LessonProgress>>;

export interface ProgressCounts {
  readonly done: number;
  readonly total: number;
}

/** Where a returning trainee should be dropped back into the course. */
export interface ResumePoint {
  readonly chapter: CourseChapterWithLessons;
  readonly lesson: CourseLesson;
  readonly positionSec: number;
}
