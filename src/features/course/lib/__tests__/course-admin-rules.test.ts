import { describe, expect, it } from "vitest";
import {
  courseSlugFor,
  deleteChapterProblem,
  deleteCourseProblem,
  positionalSlug,
  publishCourseProblem,
} from "../course-admin-rules";

describe("positionalSlug", () => {
  it("prefixes the padded position to an ASCII title", () => {
    expect(positionalSlug("Intro Lesson", 3, "lesson")).toBe("03-intro-lesson");
  });
  it("uses the fallback for Hebrew titles", () => {
    expect(positionalSlug("פתיחה", 0, "chapter")).toBe("00-chapter");
    expect(positionalSlug("פתיחה", 0, "lesson")).toBe("00-lesson");
  });
});

describe("courseSlugFor", () => {
  it("slugs an ASCII title", () => {
    expect(courseSlugFor("Mental Training", new Set())).toBe("mental-training");
  });
  it("falls back to course for Hebrew", () => {
    expect(courseSlugFor("אימון מנטלי", new Set())).toBe("course");
  });
  it("numbers collisions from 2", () => {
    expect(courseSlugFor("אימון מנטלי", new Set(["course"]))).toBe("course-2");
    expect(courseSlugFor("אימון מנטלי", new Set(["course", "course-2"]))).toBe("course-3");
  });
  it("never returns a taken slug", () => {
    const taken = new Set(["mental-training", "mental-training-2"]);
    expect(taken.has(courseSlugFor("Mental Training", taken))).toBe(false);
  });
});

describe("publishCourseProblem", () => {
  it("needs a title first", () => {
    expect(publishCourseProblem({ needsTitle: true, publishedLessons: 5 })).toBe(
      "יש לתת לקורס שם לפני פרסום"
    );
  });
  it("needs a published lesson", () => {
    expect(publishCourseProblem({ needsTitle: false, publishedLessons: 0 })).toBe(
      "אפשר לפרסם קורס רק כשיש בו לפחות שיעור אחד שפורסם"
    );
  });
  it("allows a ready course", () => {
    expect(publishCourseProblem({ needsTitle: false, publishedLessons: 1 })).toBeNull();
  });
});

describe("delete rules", () => {
  it("course", () => {
    expect(deleteCourseProblem(0)).toBeNull();
    expect(deleteCourseProblem(1)).toBe(
      "אפשר למחוק רק קורס ריק. כדי להסתיר אותו מהמתאמנים, בטלו את הפרסום"
    );
  });
  it("chapter", () => {
    expect(deleteChapterProblem(0)).toBeNull();
    expect(deleteChapterProblem(2)).toBe("אפשר למחוק רק פרק ריק");
  });
});
