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
  courseOnly: false,
};
const digital = { slug: "eden-player-development", activeOnly: false };
const tactical = { slug: "tactical", activeOnly: true };
/** A course an admin created: active_only, as createCourse inserts it. */
const created = { slug: "mental-training", activeOnly: true };

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
    const viewer = {
      role: null,
      isActive: false,
      seenTrainingOn: null,
      accessUntil: null,
      boughtCourse: false,
      courseOnly: false,
    };
    expect(canOpenCourse({ slug: "eden-player-development", activeOnly: false }, viewer, ctx)).toBe(false);
  });
});

describe("canOpenCourse for a course-only buyer", () => {
  const buyer: CourseViewer = { ...base, isActive: true, boughtCourse: true, courseOnly: true };
  const regimes: [string, CourseAccessContext][] = [
    ["the old rule", { today: "2026-12-01", lastGoodSweepOn: null }],
    ["the new rule", ctx],
  ];

  for (const [name, regime] of regimes) {
    test(`under ${name}, opens the digital course only`, () => {
      expect(canOpenCourse(digital, buyer, regime)).toBe(true);
      expect(canOpenCourse(tactical, buyer, regime)).toBe(false);
      expect(canOpenCourse(created, buyer, regime)).toBe(false);
      expect(canOpenCourse({ slug: "open-course", activeOnly: false }, buyer, regime)).toBe(false);
    });

    test(`under ${name}, stays on the digital course even while seen training or marked`, () => {
      const training = { ...buyer, seenTrainingOn: "2026-11-30", accessUntil: "2026-12-31" };
      expect(canOpenCourse(digital, training, regime)).toBe(true);
      expect(canOpenCourse(tactical, training, regime)).toBe(false);
    });

    test(`under ${name}, a course-only viewer with no role opens nothing`, () => {
      expect(canOpenCourse(digital, { ...buyer, role: null }, regime)).toBe(false);
    });
  }

  test("staff are never confined, whatever their Arbox facts", () => {
    for (const role of ["admin", "trainer"]) {
      expect(canOpenCourse(tactical, { ...buyer, role }, ctx)).toBe(true);
    }
  });
});

describe("canOpenCourse for a course an admin created", () => {
  test("under the old rule it opens like the tactical course: active trainees only", () => {
    const before = { ...ctx, lastGoodSweepOn: null };
    expect(canOpenCourse(created, base, before)).toBe(true);
    expect(canOpenCourse(created, { ...base, isActive: false }, before)).toBe(false);
  });
});
