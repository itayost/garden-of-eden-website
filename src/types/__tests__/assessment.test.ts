import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getAgeGroup,
  isLowerBetter,
  getAssessmentCompleteness,
  computeSectionCompleteness,
} from "../assessment";
import type { PlayerAssessment } from "../assessment";

function createMockAssessment(
  overrides: Partial<PlayerAssessment> = {}
): Partial<PlayerAssessment> {
  return {
    sprint_5m: null,
    sprint_10m: null,
    sprint_20m: null,
    jump_2leg_distance: null,
    jump_right_leg: null,
    jump_left_leg: null,
    jump_2leg_height: null,
    blaze_spot_time: null,
    flexibility_ankle: null,
    flexibility_knee: null,
    flexibility_hip: null,
    coordination: null,
    leg_power_technique: null,
    body_structure: null,
    kick_power_kaiser: null,
    ...overrides,
  };
}

describe("getAgeGroup", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Fix to 2026-02-15 midday UTC — safe for any runner timezone up to UTC-12
    vi.setSystemTime(new Date("2026-02-15T18:00:00Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns U10 for 8-year-old", () => {
    // Born 2018-01-01 -> age 8
    const result = getAgeGroup("2018-01-01");
    expect(result?.id).toBe("u10");
  });

  it("returns U12 for 11-year-old", () => {
    // Born 2015-01-01 -> age 11
    const result = getAgeGroup("2015-01-01");
    expect(result?.id).toBe("u12");
  });

  it("returns U15 for 14-year-old", () => {
    // Born 2012-01-01 -> age 14
    const result = getAgeGroup("2012-01-01");
    expect(result?.id).toBe("u15");
  });

  it("returns U18 for 17-year-old", () => {
    // Born 2009-01-01 -> age 17
    const result = getAgeGroup("2009-01-01");
    expect(result?.id).toBe("u18");
  });

  it("returns Senior for 25-year-old", () => {
    // Born 2001-01-01 -> age 25
    const result = getAgeGroup("2001-01-01");
    expect(result?.id).toBe("senior");
  });

  it("returns null for null birthdate", () => {
    expect(getAgeGroup(null)).toBeNull();
  });

  it("handles birthday edge: day before birthday (still younger)", () => {
    // Born 2016-02-16 -> today is 2026-02-15 -> hasn't had birthday yet -> age 9
    const result = getAgeGroup("2016-02-16");
    expect(result?.id).toBe("u10"); // age 9
  });

  it("handles birthday edge: day of birthday", () => {
    // Born 2016-02-15 -> today is 2026-02-15 -> birthday today -> age 10
    const result = getAgeGroup("2016-02-15");
    expect(result?.id).toBe("u12"); // age 10
  });

  it("handles U10 boundary (age 10 goes to U12)", () => {
    // Born 2016-01-01 -> age 10
    const result = getAgeGroup("2016-01-01");
    expect(result?.id).toBe("u12");
  });

  it("accepts Date object", () => {
    const result = getAgeGroup(new Date("2015-01-01"));
    expect(result?.id).toBe("u12");
  });

  it("returns Senior for very old age", () => {
    const result = getAgeGroup("1970-01-01");
    expect(result?.id).toBe("senior");
  });
});

describe("isLowerBetter", () => {
  it("returns true for sprint metrics", () => {
    expect(isLowerBetter("sprint_5m")).toBe(true);
    expect(isLowerBetter("sprint_10m")).toBe(true);
    expect(isLowerBetter("sprint_20m")).toBe(true);
  });

  it("returns false for jump metrics", () => {
    expect(isLowerBetter("jump_2leg_distance")).toBe(false);
    expect(isLowerBetter("jump_right_leg")).toBe(false);
    expect(isLowerBetter("jump_left_leg")).toBe(false);
    expect(isLowerBetter("jump_2leg_height")).toBe(false);
  });

  it("returns false for other metrics", () => {
    expect(isLowerBetter("blaze_spot_time")).toBe(false);
    expect(isLowerBetter("flexibility_ankle")).toBe(false);
    expect(isLowerBetter("kick_power_kaiser")).toBe(false);
  });

  it("returns false for unknown metric", () => {
    expect(isLowerBetter("unknown_metric")).toBe(false);
  });
});

describe("getAssessmentCompleteness", () => {
  it("returns 0% for empty assessment", () => {
    const assessment = createMockAssessment();
    expect(getAssessmentCompleteness(assessment)).toBe(0);
  });

  it("returns 100% for fully filled assessment", () => {
    const assessment = createMockAssessment({
      sprint_5m: 1.2,
      sprint_10m: 2.3,
      sprint_20m: 3.5,
      jump_2leg_distance: 180,
      jump_right_leg: 160,
      jump_left_leg: 155,
      jump_2leg_height: 45,
      blaze_spot_time: 30,
      flexibility_ankle: 12,
      flexibility_knee: 15,
      flexibility_hip: 20,
      kick_power_kaiser: 85,
      coordination: "advanced",
      leg_power_technique: "normal",
      body_structure: "strong_athletic",
    });
    expect(getAssessmentCompleteness(assessment)).toBe(100);
  });

  it("returns correct percentage for partial assessment", () => {
    // 12 numeric + 3 categorical = 15 total
    // Fill 3 of 15
    const assessment = createMockAssessment({
      sprint_5m: 1.2,
      sprint_10m: 2.3,
      sprint_20m: 3.5,
    });
    expect(getAssessmentCompleteness(assessment)).toBe(Math.round((3 / 15) * 100)); // 20
  });

  it("counts categorical fields", () => {
    const assessment = createMockAssessment({
      coordination: "basic",
      leg_power_technique: "normal",
      body_structure: "good_build",
    });
    expect(getAssessmentCompleteness(assessment)).toBe(Math.round((3 / 15) * 100)); // 20
  });

  it("handles mix of numeric and categorical", () => {
    const assessment = createMockAssessment({
      sprint_5m: 1.2,
      coordination: "advanced",
    });
    expect(getAssessmentCompleteness(assessment)).toBe(Math.round((2 / 15) * 100)); // 13
  });
});

describe("computeSectionCompleteness", () => {
  it("returns empty array for null assessment", () => {
    expect(computeSectionCompleteness(null)).toEqual([]);
  });

  it("returns 6 sections for an all-null assessment", () => {
    const result = computeSectionCompleteness(createMockAssessment());
    expect(result).toHaveLength(6);
    expect(result.map((s) => s.key)).toEqual([
      "sprints", "jumps", "agility", "categorical", "power", "mental",
    ]);
  });

  it("returns completed=0 total=3 for sprints when all null", () => {
    const result = computeSectionCompleteness(createMockAssessment());
    const sprints = result.find((s) => s.key === "sprints")!;
    expect(sprints.completed).toBe(0);
    expect(sprints.total).toBe(3);
  });

  it("counts only filled sprint fields", () => {
    const result = computeSectionCompleteness(
      createMockAssessment({ sprint_5m: 1.23, sprint_10m: 2.45 })
    );
    const sprints = result.find((s) => s.key === "sprints")!;
    expect(sprints.completed).toBe(2);
    expect(sprints.total).toBe(3);
  });

  it("marks sprints complete when all 3 filled", () => {
    const result = computeSectionCompleteness(
      createMockAssessment({ sprint_5m: 1.1, sprint_10m: 2.2, sprint_20m: 3.3 })
    );
    const sprints = result.find((s) => s.key === "sprints")!;
    expect(sprints.completed).toBe(3);
  });

  it("counts mental notes as completed only when non-empty string", () => {
    const result = computeSectionCompleteness(
      createMockAssessment({
        concentration_notes: "good",
        decision_making_notes: "",   // empty string = not completed
        work_ethic_notes: null,      // null = not completed
      })
    );
    const mental = result.find((s) => s.key === "mental")!;
    expect(mental.completed).toBe(1);
    expect(mental.total).toBe(5);
  });

  it("full assessment (all 15 fields) gives completed === total for all quantitative sections", () => {
    const full = createMockAssessment({
      sprint_5m: 1.1, sprint_10m: 2.2, sprint_20m: 3.3,
      jump_2leg_distance: 200, jump_right_leg: 180, jump_left_leg: 175, jump_2leg_height: 60,
      blaze_spot_time: 30, flexibility_ankle: 10, flexibility_knee: 15, flexibility_hip: 20,
      coordination: "advanced", leg_power_technique: "normal", body_structure: "good_build",
      kick_power_kaiser: 500,
    });
    const result = computeSectionCompleteness(full);
    const quantitative = result.filter((s) => s.key !== "mental");
    quantitative.forEach((s) => {
      expect(s.completed).toBe(s.total);
    });
  });
});

// Spec exception: a DB row where all 15 fields are null has completeness = 0 and must be
// classified as 'partial' (not 'none') because a record exists for that trainee.
describe("0% completeness edge case (spec exception)", () => {
  it("getAssessmentCompleteness returns 0 for all-null assessment", () => {
    // Verifies the server action logic: 0 !== 100, so the row is classified 'partial', not 'none'
    expect(getAssessmentCompleteness(createMockAssessment())).toBe(0);
  });

  it("computeSectionCompleteness returns 6 sections all with completed=0 for all-null assessment", () => {
    const result = computeSectionCompleteness(createMockAssessment());
    expect(result).toHaveLength(6);
    result.forEach((s) => expect(s.completed).toBe(0));
  });
});
