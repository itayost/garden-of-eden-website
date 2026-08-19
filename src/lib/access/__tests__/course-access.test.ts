import { describe, test, expect } from "vitest";
import {
  COURSE_ONLY_HOME,
  isPathAllowedForTier,
  resolveAccessTier,
} from "../course-access";

const NO_PURCHASES = {
  arboxPaidTraining: false,
  arboxBoughtCourse: false,
  accessOverride: null,
};

describe("resolveAccessTier", () => {
  test("a trainee with no recorded purchases keeps full access", () => {
    // The safe default: only a positively identified course-only buyer is ever
    // restricted, so an unlinked or not-yet-synced profile is never locked out.
    expect(resolveAccessTier(NO_PURCHASES)).toBe("full");
  });

  test("bought the course and never paid for training is course-only", () => {
    expect(
      resolveAccessTier({ ...NO_PURCHASES, arboxBoughtCourse: true })
    ).toBe("course_only");
  });

  test("paid for training and bought the course keeps full access", () => {
    expect(
      resolveAccessTier({
        arboxPaidTraining: true,
        arboxBoughtCourse: true,
        accessOverride: null,
      })
    ).toBe("full");
  });

  test("past training that has since lapsed still grants full access", () => {
    // arboxPaidTraining is "ever", not "currently" -- an expired or cancelled
    // membership counts exactly as much as an active one.
    expect(
      resolveAccessTier({ ...NO_PURCHASES, arboxPaidTraining: true })
    ).toBe("full");
  });

  test("an override to full beats a course-only derivation", () => {
    expect(
      resolveAccessTier({
        arboxPaidTraining: false,
        arboxBoughtCourse: true,
        accessOverride: "full",
      })
    ).toBe("full");
  });

  test("an override to course_only beats a full derivation", () => {
    expect(
      resolveAccessTier({
        arboxPaidTraining: true,
        arboxBoughtCourse: true,
        accessOverride: "course_only",
      })
    ).toBe("course_only");
  });
});

describe("isPathAllowedForTier", () => {
  test("full access reaches everything", () => {
    for (const path of [
      "/dashboard",
      "/dashboard/course",
      "/dashboard/assessments",
      "/dashboard/rankings",
      "/dashboard/book",
    ]) {
      expect(isPathAllowedForTier("full", path)).toBe(true);
    }
  });

  test("course-only reaches the course, profile and settings", () => {
    for (const path of [
      "/dashboard/course",
      "/dashboard/course/01-chapter-1/03-lesson-3",
      "/dashboard/profile",
      "/dashboard/settings",
      "/dashboard/settings/security",
    ]) {
      expect(isPathAllowedForTier("course_only", path)).toBe(true);
    }
  });

  test("course-only is turned away from every other trainee page", () => {
    for (const path of [
      "/dashboard",
      "/dashboard/assessments",
      "/dashboard/rankings",
      "/dashboard/book",
      "/dashboard/nutrition",
      "/dashboard/workout",
      "/dashboard/videos",
      "/dashboard/forms",
      "/dashboard/forms/pre-workout",
    ]) {
      expect(isPathAllowedForTier("course_only", path)).toBe(false);
    }
  });

  test("a prefix that only looks like an allowed path is refused", () => {
    // "/dashboard/coursework" must not slip through a naive startsWith check.
    expect(isPathAllowedForTier("course_only", "/dashboard/coursework")).toBe(
      false
    );
    expect(isPathAllowedForTier("course_only", "/dashboard/profiles")).toBe(
      false
    );
  });

  test("a trailing slash does not change the verdict", () => {
    expect(isPathAllowedForTier("course_only", "/dashboard/course/")).toBe(true);
    expect(isPathAllowedForTier("course_only", "/dashboard/book/")).toBe(false);
  });

  test("paths outside the trainee area are not this function's business", () => {
    // Admin and auth routes are gated by role elsewhere; the tier check must
    // not claim authority over them.
    for (const path of ["/admin", "/auth/login", "/", "/onboarding/profile"]) {
      expect(isPathAllowedForTier("course_only", path)).toBe(true);
    }
  });

  test("the course-only home is itself allowed", () => {
    expect(isPathAllowedForTier("course_only", COURSE_ONLY_HOME)).toBe(true);
  });
});
