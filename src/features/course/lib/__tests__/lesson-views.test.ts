import { describe, expect, it } from "vitest";
import {
  courseLessonsInOrder,
  lessonsByChapter,
  tallyLessonViews,
  tallyTraineeProgress,
  type LessonProgressRow,
} from "../lesson-views";

const chapters = [
  { id: "ch-2", titleHe: "פרק שני", orderIndex: 2 },
  { id: "ch-1", titleHe: "פרק ראשון", orderIndex: 1 },
];

const lessons = [
  { id: "l-3", chapterId: "ch-2", titleHe: "שיעור 3", orderIndex: 1 },
  { id: "l-2", chapterId: "ch-1", titleHe: "שיעור 2", orderIndex: 2 },
  { id: "l-1", chapterId: "ch-1", titleHe: "שיעור 1", orderIndex: 1 },
];

function row(overrides: Partial<LessonProgressRow>): LessonProgressRow {
  return {
    lessonId: "l-1",
    userId: "u-1",
    watchedSec: 30,
    completedAt: null,
    ...overrides,
  };
}

describe("courseLessonsInOrder", () => {
  it("orders lessons by chapter, then by lesson, with the chapter title", () => {
    expect(courseLessonsInOrder(chapters, lessons)).toEqual([
      { id: "l-1", titleHe: "שיעור 1", chapterId: "ch-1", chapterTitleHe: "פרק ראשון" },
      { id: "l-2", titleHe: "שיעור 2", chapterId: "ch-1", chapterTitleHe: "פרק ראשון" },
      { id: "l-3", titleHe: "שיעור 3", chapterId: "ch-2", chapterTitleHe: "פרק שני" },
    ]);
  });

  it("leaves out a lesson whose chapter is not in the course", () => {
    const stray = [...lessons, { id: "l-9", chapterId: "ch-other", titleHe: "אחר", orderIndex: 0 }];
    expect(courseLessonsInOrder(chapters, stray).map((l) => l.id)).toEqual(["l-1", "l-2", "l-3"]);
  });
});

describe("tallyLessonViews", () => {
  const ordered = courseLessonsInOrder(chapters, lessons);
  const names = new Map([
    ["u-1", "נועם"],
    ["u-2", "אבי"],
    ["u-3", "גיל"],
  ]);

  it("counts who started and who finished each lesson, in course order", () => {
    const views = tallyLessonViews(
      ordered,
      [
        row({ lessonId: "l-1", userId: "u-1", completedAt: "2026-11-01T10:00:00Z" }),
        row({ lessonId: "l-1", userId: "u-2", watchedSec: 40 }),
        row({ lessonId: "l-3", userId: "u-3", completedAt: "2026-11-02T10:00:00Z" }),
      ],
      names,
    );

    expect(views.map((v) => [v.lessonId, v.startedCount, v.finishedCount])).toEqual([
      ["l-1", 2, 1],
      ["l-2", 0, 0],
      ["l-3", 1, 1],
    ]);
    expect(views[0].chapterTitleHe).toBe("פרק ראשון");
  });

  it("lists who finished first, then the others, each by name", () => {
    const views = tallyLessonViews(
      ordered,
      [
        row({ userId: "u-1", watchedSec: 10 }),
        row({ userId: "u-3", completedAt: "2026-11-01T10:00:00Z" }),
        row({ userId: "u-2", watchedSec: 50 }),
      ],
      names,
    );

    expect(views[0].viewers).toEqual([
      { userId: "u-3", fullName: "גיל", finished: true },
      { userId: "u-2", fullName: "אבי", finished: false },
      { userId: "u-1", fullName: "נועם", finished: false },
    ]);
  });

  it("does not count a row with no time watched and no completion", () => {
    const views = tallyLessonViews(ordered, [row({ watchedSec: 0 })], names);
    expect(views[0].startedCount).toBe(0);
    expect(views[0].viewers).toEqual([]);
  });

  it("counts a completion even when no time was recorded", () => {
    const views = tallyLessonViews(
      ordered,
      [row({ watchedSec: 0, completedAt: "2026-11-01T10:00:00Z" })],
      names,
    );
    expect(views[0].finishedCount).toBe(1);
  });

  it("leaves out viewers the caller may not see and lessons not in the list", () => {
    const views = tallyLessonViews(
      ordered,
      [row({ userId: "staff-or-other-branch" }), row({ lessonId: "unpublished", userId: "u-1" })],
      names,
    );
    expect(views.every((v) => v.startedCount === 0)).toBe(true);
  });
});

describe("lessonsByChapter", () => {
  it("groups consecutive lessons of one chapter, in course order", () => {
    const ordered = courseLessonsInOrder(chapters, lessons);
    const views = tallyLessonViews(ordered, [], new Map());
    expect(
      lessonsByChapter(views).map((c) => [c.chapterId, c.titleHe, c.lessons.map((l) => l.lessonId)]),
    ).toEqual([
      ["ch-1", "פרק ראשון", ["l-1", "l-2"]],
      ["ch-2", "פרק שני", ["l-3"]],
    ]);
  });

  it("keeps two chapters with the same title apart", () => {
    const twins = [
      { id: "ch-a", titleHe: "חימום", orderIndex: 1 },
      { id: "ch-b", titleHe: "חימום", orderIndex: 2 },
    ];
    const twinLessons = [
      { id: "l-a", chapterId: "ch-a", titleHe: "א", orderIndex: 1 },
      { id: "l-b", chapterId: "ch-b", titleHe: "ב", orderIndex: 1 },
    ];
    const views = tallyLessonViews(courseLessonsInOrder(twins, twinLessons), [], new Map());
    expect(lessonsByChapter(views).map((c) => c.chapterId)).toEqual(["ch-a", "ch-b"]);
  });
});

describe("tallyTraineeProgress", () => {
  const trainees = [
    { userId: "u-1", fullName: "נועם" },
    { userId: "u-2", fullName: "אבי" },
  ];
  const lessonIds = new Set(["l-1", "l-2"]);

  it("counts finished published lessons and the latest completion", () => {
    const progress = tallyTraineeProgress(
      trainees,
      lessonIds,
      [
        row({ lessonId: "l-1", userId: "u-1", completedAt: "2026-11-01T10:00:00Z" }),
        row({ lessonId: "l-2", userId: "u-1", completedAt: "2026-11-03T10:00:00Z" }),
        row({ lessonId: "l-2", userId: "u-2", watchedSec: 100 }),
        row({ lessonId: "unpublished", userId: "u-2", completedAt: "2026-11-04T10:00:00Z" }),
      ],
    );

    expect(progress).toEqual([
      {
        userId: "u-1",
        fullName: "נועם",
        doneCount: 2,
        hasStarted: true,
        lastActivityAt: "2026-11-03T10:00:00Z",
      },
      { userId: "u-2", fullName: "אבי", doneCount: 0, hasStarted: true, lastActivityAt: null },
    ]);
  });

  it("counts a trainee as started by the same rule as the per-lesson view", () => {
    const progress = tallyTraineeProgress(trainees, lessonIds, [
      row({ lessonId: "l-1", userId: "u-1", watchedSec: 0 }),
      row({ lessonId: "unpublished", userId: "u-2", watchedSec: 300 }),
    ]);
    expect(progress.map((t) => t.hasStarted)).toEqual([false, false]);
  });
});
