import { describe, test, expect } from "vitest";
import {
  COMPLETION_RATIO,
  progressPercent,
  isLessonDone,
  shouldMarkComplete,
  countChapterProgress,
  countCourseProgress,
  findResumePoint,
  formatDuration,
} from "../progress-utils";
import type {
  CourseChapterWithLessons,
  CourseLesson,
  LessonProgressMap,
} from "../types";

function lesson(id: string, durationSec = 100, orderIndex = 0): CourseLesson {
  return {
    id,
    chapterId: "ch",
    slug: id,
    titleHe: id,
    descriptionHe: null,
    videoPath: `path/${id}.mp4`,
    videoPathSd: null,
    durationSec,
    needsTitle: false,
    isPublished: true,
    orderIndex,
  };
}

function chapter(
  id: string,
  lessons: CourseLesson[],
  orderIndex = 0
): CourseChapterWithLessons {
  return {
    id,
    courseId: "c",
    slug: id,
    titleHe: id,
    subtitleHe: null,
    needsTitle: false,
    orderIndex,
    lessons,
  };
}

function done(lessonId: string) {
  return {
    lessonId,
    lastPositionSec: 100,
    watchedSec: 100,
    completedAt: "2026-08-19T00:00:00Z",
  };
}

function partial(lessonId: string, positionSec: number) {
  return {
    lessonId,
    lastPositionSec: positionSec,
    watchedSec: positionSec,
    completedAt: null,
  };
}

describe("progressPercent", () => {
  test("returns 0 when there is nothing to do", () => {
    expect(progressPercent(0, 0)).toBe(0);
  });

  test("returns 0 for a negative total rather than a negative percent", () => {
    expect(progressPercent(3, -1)).toBe(0);
  });

  test("rounds to the nearest whole percent", () => {
    expect(progressPercent(1, 3)).toBe(33);
    expect(progressPercent(2, 3)).toBe(67);
  });

  test("caps at 100 even if done exceeds total", () => {
    expect(progressPercent(5, 3)).toBe(100);
  });
});

describe("isLessonDone", () => {
  test("is false when the lesson has no progress row", () => {
    expect(isLessonDone("a", {})).toBe(false);
  });

  test("is false while the lesson is only partly watched", () => {
    const map: LessonProgressMap = { a: partial("a", 40) };
    expect(isLessonDone("a", map)).toBe(false);
  });

  test("is true once completed_at is stamped", () => {
    const map: LessonProgressMap = { a: done("a") };
    expect(isLessonDone("a", map)).toBe(true);
  });
});

describe("shouldMarkComplete", () => {
  test("is false below the completion ratio", () => {
    expect(shouldMarkComplete(80, 100)).toBe(false);
  });

  test("is true at exactly the completion ratio", () => {
    expect(shouldMarkComplete(COMPLETION_RATIO * 100, 100)).toBe(true);
  });

  test("is true past the completion ratio", () => {
    expect(shouldMarkComplete(99, 100)).toBe(true);
  });

  test("is false when the duration is unknown", () => {
    // A lesson with no measured duration must never auto-complete, otherwise
    // opening it would instantly mark it watched.
    expect(shouldMarkComplete(10, 0)).toBe(false);
  });

  test("is false for a negative position", () => {
    expect(shouldMarkComplete(-5, 100)).toBe(false);
  });
});

describe("countChapterProgress", () => {
  test("counts only completed lessons", () => {
    const ch = chapter("ch1", [lesson("a"), lesson("b"), lesson("c")]);
    const map: LessonProgressMap = { a: done("a"), b: partial("b", 50) };
    expect(countChapterProgress(ch, map)).toEqual({ done: 1, total: 3 });
  });

  test("handles a chapter with no lessons", () => {
    expect(countChapterProgress(chapter("empty", []), {})).toEqual({
      done: 0,
      total: 0,
    });
  });
});

describe("countCourseProgress", () => {
  test("sums across every chapter", () => {
    const chapters = [
      chapter("ch1", [lesson("a"), lesson("b")], 0),
      chapter("ch2", [lesson("c")], 1),
    ];
    const map: LessonProgressMap = { a: done("a"), c: done("c") };
    expect(countCourseProgress(chapters, map)).toEqual({ done: 2, total: 3 });
  });

  test("returns zeroes for an empty course", () => {
    expect(countCourseProgress([], {})).toEqual({ done: 0, total: 0 });
  });
});

describe("findResumePoint", () => {
  test("returns null when the course has no lessons", () => {
    expect(findResumePoint([], {})).toBeNull();
  });

  test("returns the first lesson for a trainee who has never watched", () => {
    const chapters = [chapter("ch1", [lesson("a"), lesson("b")])];
    const point = findResumePoint(chapters, {});
    expect(point?.lesson.id).toBe("a");
    expect(point?.positionSec).toBe(0);
  });

  test("prefers a partly watched lesson over the next unstarted one", () => {
    const chapters = [chapter("ch1", [lesson("a"), lesson("b"), lesson("c")])];
    const map: LessonProgressMap = { a: done("a"), b: partial("b", 42) };
    const point = findResumePoint(chapters, map);
    expect(point?.lesson.id).toBe("b");
    expect(point?.positionSec).toBe(42);
  });

  test("falls through to the next unwatched lesson when none are in progress", () => {
    const chapters = [chapter("ch1", [lesson("a"), lesson("b")])];
    const map: LessonProgressMap = { a: done("a") };
    const point = findResumePoint(chapters, map);
    expect(point?.lesson.id).toBe("b");
    expect(point?.positionSec).toBe(0);
  });

  test("crosses a chapter boundary in order", () => {
    const chapters = [
      chapter("ch1", [lesson("a")], 0),
      chapter("ch2", [lesson("b")], 1),
    ];
    const map: LessonProgressMap = { a: done("a") };
    const point = findResumePoint(chapters, map);
    expect(point?.chapter.id).toBe("ch2");
    expect(point?.lesson.id).toBe("b");
  });

  test("returns the last lesson once the whole course is complete", () => {
    // Finishing the course should not strand the trainee with nothing to open.
    const chapters = [chapter("ch1", [lesson("a"), lesson("b")])];
    const map: LessonProgressMap = { a: done("a"), b: done("b") };
    const point = findResumePoint(chapters, map);
    expect(point?.lesson.id).toBe("b");
  });

  test("skips chapters that have no lessons", () => {
    const chapters = [
      chapter("empty", [], 0),
      chapter("ch2", [lesson("a")], 1),
    ];
    expect(findResumePoint(chapters, {})?.lesson.id).toBe("a");
  });
});

describe("formatDuration", () => {
  test("formats under an hour as m:ss", () => {
    expect(formatDuration(78)).toBe("1:18");
    expect(formatDuration(418)).toBe("6:58");
  });

  test("pads seconds", () => {
    expect(formatDuration(65)).toBe("1:05");
  });

  test("formats an hour or more as h:mm:ss", () => {
    expect(formatDuration(3661)).toBe("1:01:01");
  });

  test("renders zero and negatives as 0:00", () => {
    expect(formatDuration(0)).toBe("0:00");
    expect(formatDuration(-5)).toBe("0:00");
  });

  test("rounds fractional seconds down", () => {
    expect(formatDuration(59.9)).toBe("0:59");
  });
});
