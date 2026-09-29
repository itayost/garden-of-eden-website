import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getAgeGroup,
  isLowerBetter,
  getAssessmentCompleteness,
  computeSectionCompleteness,
  ASSESSMENT_SECTIONS,
  ASSESSMENT_LABELS_HE,
  ASSESSMENT_UNITS,
  DRIBBLING_TESTS_SINCE,
  DRIBBLING_TEST_KEYS,
} from "../assessment";
import type { PlayerAssessment } from "../assessment";

const TOTAL_FIELDS = ASSESSMENT_SECTIONS
  .filter((s) => s.type !== "textarea")
  .reduce((sum, s) => sum + s.fields.length, 0);

function createMockAssessment(
  overrides: Partial<PlayerAssessment> = {}
): Partial<PlayerAssessment> {
  return {
    assessment_date: "2026-10-15",
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
    kick_power_right_foot: null,
    kick_power_left_foot: null,
    kick_power_machine_pct: null,
    shuffle_10m: null,
    sprint_10m_h: null,
    sprint_10m_h_ball: null,
    concentration_notes: null,
    decision_making_notes: null,
    work_ethic_notes: null,
    recovery_notes: null,
    nutrition_notes: null,
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
    // U10 = under 10, so a player who has just turned 10 moves up to U12
    const result = getAgeGroup("2016-02-15");
    expect(result?.id).toBe("u12");
  });

  it("places age 10 in U12 (U10 means under 10)", () => {
    // Born 2016-01-01 -> age 10
    const result = getAgeGroup("2016-01-01");
    expect(result?.id).toBe("u12");
  });

  it("places age 12 in U15 (U12 means under 12)", () => {
    // Born 2014-01-01 -> age 12
    const result = getAgeGroup("2014-01-01");
    expect(result?.id).toBe("u15");
  });

  it("places age 15 in U18 (U15 means under 15)", () => {
    // Born 2011-01-01 -> age 15
    const result = getAgeGroup("2011-01-01");
    expect(result?.id).toBe("u18");
  });

  it("places age 18 in Senior (U18 means under 18)", () => {
    // Born 2008-01-01 -> age 18
    const result = getAgeGroup("2008-01-01");
    expect(result?.id).toBe("senior");
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

  it("returns true for the timed dribbling tests", () => {
    expect(isLowerBetter("shuffle_10m")).toBe(true);
    expect(isLowerBetter("sprint_10m_h")).toBe(true);
    expect(isLowerBetter("sprint_10m_h_ball")).toBe(true);
  });

  it("labels the dribbling tests in Hebrew with seconds as the unit", () => {
    expect(ASSESSMENT_LABELS_HE.shuffle_10m).toBe("צעדי רדיפה 10 מטר");
    expect(ASSESSMENT_LABELS_HE.sprint_10m_h).toBe("ספרינט 10 מטר צורת ח");
    expect(ASSESSMENT_LABELS_HE.sprint_10m_h_ball).toBe("ספרינט 10 מטר צורת ח עם כדור");
    for (const key of DRIBBLING_TEST_KEYS) {
      expect(ASSESSMENT_UNITS[key]).toBe("שניות");
    }
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
      kick_power_right_foot: 85,
      kick_power_left_foot: 80,
      kick_power_machine_pct: 35,
      coordination: "advanced",
      leg_power_technique: "normal",
      body_structure: "strong_athletic",
      shuffle_10m: 3.0,
      sprint_10m_h: 2.8,
      sprint_10m_h_ball: 3.3,
    });
    expect(getAssessmentCompleteness(assessment)).toBe(100);
  });

  it("returns correct percentage for partial assessment", () => {
    const assessment = createMockAssessment({
      sprint_5m: 1.2,
      sprint_10m: 2.3,
      sprint_20m: 3.5,
    });
    expect(getAssessmentCompleteness(assessment)).toBe(Math.round((3 / TOTAL_FIELDS) * 100));
  });

  it("counts categorical fields", () => {
    const assessment = createMockAssessment({
      coordination: "basic",
      leg_power_technique: "normal",
      body_structure: "good_build",
    });
    expect(getAssessmentCompleteness(assessment)).toBe(Math.round((3 / TOTAL_FIELDS) * 100));
  });

  it("handles mix of numeric and categorical", () => {
    const assessment = createMockAssessment({
      sprint_5m: 1.2,
      coordination: "advanced",
    });
    expect(getAssessmentCompleteness(assessment)).toBe(Math.round((2 / TOTAL_FIELDS) * 100));
  });
});

describe("dribbling tests only count from their rollout date", () => {
  const WITHOUT_DRIBBLING: Partial<PlayerAssessment> = {
    sprint_5m: 1.2, sprint_10m: 2.3, sprint_20m: 3.5,
    jump_2leg_distance: 180, jump_right_leg: 160, jump_left_leg: 155, jump_2leg_height: 45,
    blaze_spot_time: 30, flexibility_ankle: 12, flexibility_knee: 15, flexibility_hip: 20,
    kick_power_right_foot: 85, kick_power_left_foot: 80, kick_power_machine_pct: 35,
    coordination: "advanced", leg_power_technique: "normal", body_structure: "strong_athletic",
  };

  it("keeps an older complete assessment at 100%", () => {
    const old = createMockAssessment({ ...WITHOUT_DRIBBLING, assessment_date: "2026-09-01" });
    expect(getAssessmentCompleteness(old)).toBe(100);
  });

  it("requires the dribbling tests from the rollout date on", () => {
    const onRollout = createMockAssessment({ ...WITHOUT_DRIBBLING, assessment_date: DRIBBLING_TESTS_SINCE });
    expect(getAssessmentCompleteness(onRollout)).toBe(Math.round((17 / 20) * 100));
  });

  it("drops the dribbling section from older assessments' section list", () => {
    const old = createMockAssessment({ assessment_date: "2026-09-01" });
    expect(computeSectionCompleteness(old).map((s) => s.key)).not.toContain("dribbling");
  });

  it("never pushes an older assessment past 100% when a dribbling test is present", () => {
    const old = createMockAssessment({
      ...WITHOUT_DRIBBLING, assessment_date: "2026-09-01", shuffle_10m: 3.0,
    });
    expect(getAssessmentCompleteness(old)).toBe(100);
  });
});

describe("computeSectionCompleteness", () => {
  it("returns empty array for null assessment", () => {
    expect(computeSectionCompleteness(null)).toEqual([]);
  });

  it("returns 7 sections for an all-null assessment", () => {
    const result = computeSectionCompleteness(createMockAssessment());
    expect(result).toHaveLength(7);
    expect(result.map((s) => s.key)).toEqual([
      "sprints", "dribbling", "jumps", "agility", "categorical", "power", "mental",
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

  it("full assessment gives completed === total for all quantitative sections", () => {
    const full = createMockAssessment({
      sprint_5m: 1.1, sprint_10m: 2.2, sprint_20m: 3.3,
      shuffle_10m: 3.0, sprint_10m_h: 2.8, sprint_10m_h_ball: 3.3,
      jump_2leg_distance: 200, jump_right_leg: 180, jump_left_leg: 175, jump_2leg_height: 60,
      blaze_spot_time: 30, flexibility_ankle: 10, flexibility_knee: 15, flexibility_hip: 20,
      coordination: "advanced", leg_power_technique: "normal", body_structure: "good_build",
      kick_power_right_foot: 500, kick_power_left_foot: 480, kick_power_machine_pct: 35,
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

  it("computeSectionCompleteness returns 7 sections all with completed=0 for all-null assessment", () => {
    const result = computeSectionCompleteness(createMockAssessment());
    expect(result).toHaveLength(7);
    result.forEach((s) => expect(s.completed).toBe(0));
  });
});
