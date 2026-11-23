import { describe, expect, it } from "vitest";
import { courseCardFor } from "../course-card";
import type {
  CourseChapterWithLessons,
  CourseLesson,
  CourseWithChapters,
} from "../types";

function lesson(id: string, chapterId: string): CourseLesson {
  return {
    id,
    chapterId,
    slug: `00-${id}`,
    titleHe: "שיעור",
    descriptionHe: null,
    videoPath: "v.mp4",
    videoPathSd: null,
    durationSec: 60,
    needsTitle: false,
    isPublished: true,
    orderIndex: 0,
  };
}

function chapter(id: string, lessons: CourseLesson[]): CourseChapterWithLessons {
  return {
    id,
    courseId: "c1",
    slug: `00-${id}`,
    titleHe: "פרק",
    subtitleHe: null,
    needsTitle: false,
    orderIndex: 0,
    lessons,
  };
}

function course(chapters: CourseChapterWithLessons[]): CourseWithChapters {
  return {
    id: "c1",
    slug: "mental-training",
    titleHe: "אימון מנטלי",
    descriptionHe: "תיאור",
    coverUrl: null,
    isPublished: true,
    needsTitle: false,
    orderIndex: 2,
    activeOnly: true,
    chapters,
  };
}

describe("courseCardFor", () => {
  it("leaves out a published course with no chapters", () => {
    expect(courseCardFor(course([]), {}, true)).toBeNull();
  });

  it("leaves out a published course whose chapters have no published lesson", () => {
    expect(courseCardFor(course([chapter("ch1", []), chapter("ch2", [])]), {}, true)).toBeNull();
  });

  it("gives the card with this viewer's progress and access", () => {
    const withLessons = course([
      chapter("ch1", [lesson("l1", "ch1"), lesson("l2", "ch1")]),
      chapter("ch2", [lesson("l3", "ch2")]),
    ]);
    const progress = {
      l1: { lessonId: "l1", lastPositionSec: 60, watchedSec: 60, completedAt: "2026-11-20T10:00:00Z" },
      l3: { lessonId: "l3", lastPositionSec: 10, watchedSec: 10, completedAt: null },
    };
    expect(courseCardFor(withLessons, progress, false)).toEqual({
      slug: "mental-training",
      titleHe: "אימון מנטלי",
      descriptionHe: "תיאור",
      coverUrl: null,
      done: 1,
      total: 3,
      canOpen: false,
    });
  });
});
