import { describe, expect, test } from "vitest";

import {
  canOpenCourse,
  effectiveLastGoodSweep,
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

  test("falls back to the old rule while the rule is not on (no last good sweep)", () => {
    const before = { ...ctx, lastGoodSweepOn: null };
    expect(canOpenCourse(digital, base, before)).toBe(true);
    expect(canOpenCourse(tactical, base, before)).toBe(true);
    expect(canOpenCourse(tactical, { ...base, isActive: false }, before)).toBe(false);
  });
});

describe("effectiveLastGoodSweep", () => {
  const today = "2026-12-01";

  test("no sweeps gives null, so the old rule holds", () => {
    expect(effectiveLastGoodSweep({ oldest: null, newest: null }, today)).toBeNull();
  });

  test("an oldest sweep 6 days ago gives null: the marking week is not over", () => {
    expect(effectiveLastGoodSweep({ oldest: "2026-11-25", newest: "2026-12-01" }, today)).toBeNull();
  });

  test("an oldest sweep exactly 7 days ago gives the newest sweep", () => {
    expect(effectiveLastGoodSweep({ oldest: "2026-11-24", newest: "2026-11-30" }, today)).toBe("2026-11-30");
  });

  test("an oldest sweep long ago gives the newest sweep, however old", () => {
    expect(effectiveLastGoodSweep({ oldest: "2026-10-01", newest: "2026-11-20" }, today)).toBe("2026-11-20");
  });

  test("a failed read gives null, so the old rule holds", () => {
    expect(effectiveLastGoodSweep(null, today)).toBeNull();
  });
});

describe("canOpenCourse before the rule is on", () => {
  test("a viewer with no role opens nothing, as after the switch", () => {
    const ctx = { today: "2026-12-01", lastGoodSweepOn: null };
    const viewer = { role: null, isActive: false, seenTrainingOn: null, accessUntil: null, boughtCourse: false };
    expect(canOpenCourse({ slug: "eden-player-development", activeOnly: false }, viewer, ctx)).toBe(false);
  });
});
