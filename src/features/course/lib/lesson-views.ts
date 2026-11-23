/**
 * Who watched which lesson, for the staff progress page. Pure: the action
 * reads the rows, these rules count them, so the per-lesson and per-trainee
 * views cannot disagree about what "started" or "finished" means.
 *
 * Finished is the trainee's own completion stamp (90% of the lesson, see
 * COMPLETION_RATIO). Started is any time played, a finished lesson included.
 */

/** One trainee's stored progress on one lesson. */
export interface LessonProgressRow {
  readonly lessonId: string;
  readonly userId: string;
  readonly watchedSec: number;
  readonly completedAt: string | null;
}

/** A published lesson, named with its chapter, in course order. */
export interface ReportLesson {
  readonly id: string;
  readonly titleHe: string;
  readonly chapterId: string;
  readonly chapterTitleHe: string;
}

export interface LessonViewer {
  readonly userId: string;
  readonly fullName: string;
  readonly finished: boolean;
}

export interface LessonViews {
  readonly lessonId: string;
  readonly titleHe: string;
  readonly chapterId: string;
  readonly chapterTitleHe: string;
  /** Trainees who played any of it, the finished ones included. */
  readonly startedCount: number;
  readonly finishedCount: number;
  /** Finished first, then the others, each group by name. */
  readonly viewers: readonly LessonViewer[];
}

export interface TraineeCourseProgress {
  userId: string;
  fullName: string;
  /** Published lessons this trainee has finished. */
  doneCount: number;
  /** Played any published lesson, by the same rule as the per-lesson view. */
  hasStarted: boolean;
  /** ISO timestamp of their most recent completion, or null if they never finished one. */
  lastActivityAt: string | null;
}

export interface ChapterLessonViews {
  readonly chapterId: string;
  readonly titleHe: string;
  readonly lessons: readonly LessonViews[];
}

const hebrewNames = new Intl.Collator("he");

const isFinished = (row: LessonProgressRow): boolean => row.completedAt !== null;
const isStarted = (row: LessonProgressRow): boolean => isFinished(row) || row.watchedSec > 0;

/** The course's lessons by chapter order, then lesson order. */
export function courseLessonsInOrder(
  chapters: readonly { id: string; titleHe: string; orderIndex: number }[],
  lessons: readonly { id: string; chapterId: string; titleHe: string; orderIndex: number }[],
): ReportLesson[] {
  const chapterById = new Map(chapters.map((chapter) => [chapter.id, chapter]));
  return lessons
    .flatMap((lesson) => {
      const chapter = chapterById.get(lesson.chapterId);
      return chapter ? [{ lesson, chapter }] : [];
    })
    .sort(
      (a, b) =>
        a.chapter.orderIndex - b.chapter.orderIndex || a.lesson.orderIndex - b.lesson.orderIndex,
    )
    .map(({ lesson, chapter }) => ({
      id: lesson.id,
      titleHe: lesson.titleHe,
      chapterId: chapter.id,
      chapterTitleHe: chapter.titleHe,
    }));
}

/**
 * Consecutive lessons of one chapter, for headings; the list arrives in course
 * order. Grouped by id, so two chapters with the same title stay apart.
 */
export function lessonsByChapter(lessons: readonly LessonViews[]): ChapterLessonViews[] {
  return lessons.reduce<ChapterLessonViews[]>((groups, lesson) => {
    const last = groups.at(-1);
    if (last && last.chapterId === lesson.chapterId) {
      return [...groups.slice(0, -1), { ...last, lessons: [...last.lessons, lesson] }];
    }
    return [...groups, { chapterId: lesson.chapterId, titleHe: lesson.chapterTitleHe, lessons: [lesson] }];
  }, []);
}

function byFinishedThenName(a: LessonViewer, b: LessonViewer): number {
  if (a.finished !== b.finished) return a.finished ? -1 : 1;
  return hebrewNames.compare(a.fullName, b.fullName);
}

/**
 * Per lesson, who started and who finished it. Only trainees in `names` count:
 * the caller passes the trainees it may see, which leaves out staff and other
 * branches.
 */
export function tallyLessonViews(
  lessons: readonly ReportLesson[],
  rows: readonly LessonProgressRow[],
  names: ReadonlyMap<string, string>,
): LessonViews[] {
  const viewersByLesson = new Map<string, LessonViewer[]>();
  for (const row of rows) {
    const fullName = names.get(row.userId);
    if (fullName === undefined || !isStarted(row)) continue;
    const viewer = { userId: row.userId, fullName, finished: isFinished(row) };
    viewersByLesson.set(row.lessonId, [...(viewersByLesson.get(row.lessonId) ?? []), viewer]);
  }

  return lessons.map((lesson) => {
    const viewers = [...(viewersByLesson.get(lesson.id) ?? [])].sort(byFinishedThenName);
    return {
      lessonId: lesson.id,
      titleHe: lesson.titleHe,
      chapterId: lesson.chapterId,
      chapterTitleHe: lesson.chapterTitleHe,
      startedCount: viewers.length,
      finishedCount: viewers.filter((viewer) => viewer.finished).length,
      viewers,
    };
  });
}

/**
 * Per trainee, the published lessons finished, whether they played any, and
 * the latest finish. A lesson no longer published does not count, so nobody
 * shows "12 of 11".
 */
export function tallyTraineeProgress(
  trainees: readonly { userId: string; fullName: string }[],
  publishedLessonIds: ReadonlySet<string>,
  rows: readonly LessonProgressRow[],
): TraineeCourseProgress[] {
  const doneByUser = new Map<string, { count: number; last: string }>();
  const startedUsers = new Set<string>();
  for (const row of rows) {
    if (!publishedLessonIds.has(row.lessonId)) continue;
    if (isStarted(row)) startedUsers.add(row.userId);
    if (row.completedAt === null) continue;
    const entry = doneByUser.get(row.userId);
    doneByUser.set(row.userId, {
      count: (entry?.count ?? 0) + 1,
      last: entry && entry.last > row.completedAt ? entry.last : row.completedAt,
    });
  }

  return trainees.map((trainee) => {
    const entry = doneByUser.get(trainee.userId);
    return {
      userId: trainee.userId,
      fullName: trainee.fullName,
      doneCount: entry?.count ?? 0,
      hasStarted: startedUsers.has(trainee.userId),
      lastActivityAt: entry?.last ?? null,
    };
  });
}
