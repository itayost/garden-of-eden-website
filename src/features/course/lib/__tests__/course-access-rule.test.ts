import { describe, expect, test } from "vitest";

import { canOpenCourse } from "../course-access-rule";

describe("canOpenCourse", () => {
  test("staff always open a course", () => {
    expect(canOpenCourse(true, { role: "admin", isActive: false })).toBe(true);
    expect(canOpenCourse(true, { role: "trainer", isActive: false })).toBe(true);
  });

  test("an active trainee opens an active-only course", () => {
    expect(canOpenCourse(true, { role: "trainee", isActive: true })).toBe(true);
  });

  test("an inactive trainee cannot open an active-only course", () => {
    expect(canOpenCourse(true, { role: "trainee", isActive: false })).toBe(false);
  });

  test("anyone signed in opens a course that is not active-only", () => {
    expect(canOpenCourse(false, { role: "trainee", isActive: false })).toBe(true);
  });

  test("a viewer with no profile is not active", () => {
    expect(canOpenCourse(true, { role: null, isActive: false })).toBe(false);
  });
});
