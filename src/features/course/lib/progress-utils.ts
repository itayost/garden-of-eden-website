import type {
  CourseChapterWithLessons,
  LessonProgressMap,
  ProgressCounts,
  ResumePoint,
} from "./types";

/**
 * Fraction of a lesson that counts as watched. Trainees rarely sit through
 * closing credits, so the last tenth is forgiven.
 */
export const COMPLETION_RATIO = 0.9;

export function progressPercent(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((done / total) * 100));
}

export function isLessonDone(
  lessonId: string,
  progress: LessonProgressMap
): boolean {
  return progress[lessonId]?.completedAt != null;
}

/**
 * Whether a playback position is far enough in to stamp the lesson complete.
 * A lesson with no known duration never auto-completes -- otherwise merely
 * opening it would mark it watched.
 */
export function shouldMarkComplete(
  positionSec: number,
  durationSec: number
): boolean {
  if (durationSec <= 0 || positionSec < 0) return false;
  return positionSec / durationSec >= COMPLETION_RATIO;
}

export function countChapterProgress(
  chapter: CourseChapterWithLessons,
  progress: LessonProgressMap
): ProgressCounts {
  const done = chapter.lessons.reduce(
    (n, lesson) => (isLessonDone(lesson.id, progress) ? n + 1 : n),
    0
  );
  return { done, total: chapter.lessons.length };
}

export function countCourseProgress(
  chapters: readonly CourseChapterWithLessons[],
  progress: LessonProgressMap
): ProgressCounts {
  return chapters.reduce<ProgressCounts>(
    (acc, chapter) => {
      const counts = countChapterProgress(chapter, progress);
      return { done: acc.done + counts.done, total: acc.total + counts.total };
    },
    { done: 0, total: 0 }
  );
}

/**
 * Where to drop a returning trainee: the lesson they left part-watched if there
 * is one, otherwise the first they have not finished, otherwise the very last
 * lesson so a completed course still opens somewhere sensible.
 */
export function findResumePoint(
  chapters: readonly CourseChapterWithLessons[],
  progress: LessonProgressMap
): ResumePoint | null {
  const ordered = [...chapters].sort((a, b) => a.orderIndex - b.orderIndex);

  let firstUnfinished: ResumePoint | null = null;
  let last: ResumePoint | null = null;

  for (const chapter of ordered) {
    const lessons = [...chapter.lessons].sort(
      (a, b) => a.orderIndex - b.orderIndex
    );

    for (const lesson of lessons) {
      last = { chapter, lesson, positionSec: 0 };

      if (isLessonDone(lesson.id, progress)) continue;

      const positionSec = progress[lesson.id]?.lastPositionSec ?? 0;
      // A lesson already under way wins outright.
      if (positionSec > 0) return { chapter, lesson, positionSec };

      firstUnfinished ??= { chapter, lesson, positionSec: 0 };
    }
  }

  return firstUnfinished ?? last;
}

/** "6:58" under an hour, "1:01:01" at or above it. */
export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return "0:00";

  const whole = Math.floor(totalSeconds);
  const hours = Math.floor(whole / 3600);
  const minutes = Math.floor((whole % 3600) / 60);
  const seconds = whole % 60;

  const paddedSeconds = String(seconds).padStart(2, "0");
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${paddedSeconds}`;
  }
  return `${minutes}:${paddedSeconds}`;
}
