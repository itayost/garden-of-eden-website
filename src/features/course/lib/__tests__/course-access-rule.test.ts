import { describe, expect, test } from "vitest";

import {
  canOpenCourse,
  type CourseAccessContext,
  type CourseViewer,
} from "../course-access-rule";

const ctx: CourseAccessContext = { today: "2026-12-01", lastGoodSweepOn: "2026-11-30" };
const base: CourseViewer = {
  role: "trainee",
  isActive: true,
  seenTrainingOn: null,
  accessUntil: null,
  boughtCourse: false,
};
const digital = { slug: "eden-player-development", activeOnly: false };
const tactical = { slug: "tactical", activeOnly: true };

describe("canOpenCourse", () => {
  test("staff always open", () => {
    for (const role of ["admin", "trainer"]) {
      const viewer = { ...base, role, isActive: false };
      expect(canOpenCourse(digital, viewer, ctx)).toBe(true);
      expect(canOpenCourse(tactical, viewer, ctx)).toBe(true);
    }
  });

  test("opens when seen within the grace period", () => {
    const viewer = { ...base, seenTrainingOn: "2026-11-23" };
    expect(canOpenCourse(tactical, viewer, ctx)).toBe(true);
  });

  test("locks when seen 8 days before the last good sweep", () => {
    const viewer = { ...base, seenTrainingOn: "2026-11-22" };
    expect(canOpenCourse(tactical, viewer, ctx)).toBe(false);
    expect(canOpenCourse(digital, viewer, ctx)).toBe(false);
  });

  test("a sale today opens with an old sweep", () => {
    const viewer = { ...base, seenTrainingOn: "2026-12-01" };
    const old = { ...ctx, lastGoodSweepOn: "2026-11-20" };
    expect(canOpenCourse(tactical, viewer, old)).toBe(true);
  });

  test("an admin mark ending today opens", () => {
    expect(canOpenCourse(tactical, { ...base, accessUntil: "2026-12-01" }, ctx)).toBe(true);
    expect(canOpenCourse(tactical, { ...base, accessUntil: "2026-11-30" }, ctx)).toBe(false);
  });

  test("digital course buyers keep the digital course only", () => {
    const viewer = { ...base, boughtCourse: true };
    expect(canOpenCourse(digital, viewer, ctx)).toBe(true);
    expect(canOpenCourse(tactical, viewer, ctx)).toBe(false);
  });

  test("a viewer with no role opens nothing", () => {
    const viewer = { ...base, role: null, seenTrainingOn: "2026-12-01" };
    expect(canOpenCourse(digital, viewer, ctx)).toBe(false);
    expect(canOpenCourse(tactical, viewer, ctx)).toBe(false);
  });

  test("falls back to the old rule before the first good sweep", () => {
    const before = { ...ctx, lastGoodSweepOn: null };
    expect(canOpenCourse(digital, base, before)).toBe(true);
    expect(canOpenCourse(tactical, base, before)).toBe(true);
    expect(canOpenCourse(tactical, { ...base, isActive: false }, before)).toBe(false);
  });
});
