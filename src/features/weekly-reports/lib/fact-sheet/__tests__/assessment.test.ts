import { describe, expect, test } from "vitest";
import { ASSESSMENT_LABELS_HE } from "@/types/assessment";
import { assessmentFacts } from "../assessment";
import { assessment } from "./fixtures";

const previous = assessment({
  id: "a-prev",
  assessment_date: "2026-09-01",
  sprint_10m: 2.1,
  jump_2leg_distance: 180,
  flexibility_knee: 10,
});
const inWeek = assessment({
  id: "a-now",
  assessment_date: "2026-11-16",
  sprint_10m: 2.0,
  jump_2leg_distance: 170,
  flexibility_knee: 10,
});

describe("assessmentFacts", () => {
  test("null without an Assessment in the week", () => {
    expect(assessmentFacts({ inWeek: null, previous, groupStats: null })).toBeNull();
  });

  test("lists improvements with their labels and counts regressions without naming them", () => {
    const facts = assessmentFacts({ inWeek, previous, groupStats: null });
    expect(facts).not.toBeNull();
    expect(facts?.first).toBe(false);
    expect(facts?.date).toBe("2026-11-16");
    expect(facts?.improvements).toHaveLength(1);
    expect(facts?.improvements[0].label).toBe(ASSESSMENT_LABELS_HE.sprint_10m);
    expect(facts?.improvements[0].change).toContain("-0.1");
    expect(facts?.regressions).toBe(1);
    expect(facts?.unchanged).toBe(1);
    expect(JSON.stringify(facts)).not.toContain(ASSESSMENT_LABELS_HE.jump_2leg_distance);
  });

  test("a first Assessment has no changes", () => {
    expect(assessmentFacts({ inWeek, previous: null, groupStats: null })).toEqual({
      date: "2026-11-16",
      first: true,
      improvements: [],
      unchanged: 0,
      regressions: 0,
      rating: null,
    });
  });

  test("the rating is null without group stats", () => {
    expect(assessmentFacts({ inWeek, previous, groupStats: null })?.rating).toBeNull();
  });

  test("the Assessment's written notes never reach the facts", () => {
    const noted = { ...inWeek, notes: "PLANTED-NOTE", recovery_notes: "PLANTED-RECOVERY" };
    expect(JSON.stringify(assessmentFacts({ inWeek: noted, previous, groupStats: null }))).not.toContain("PLANTED");
  });
});
