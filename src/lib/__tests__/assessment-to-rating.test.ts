import { describe, it, expect } from "vitest";
import {
  calculateCardRatings,
  CARD_STAT_CONFIG,
  type GroupStats,
} from "../assessment-to-rating";
import type { PlayerAssessment } from "@/types/assessment";

const FULL_GROUP_STATS: GroupStats = {
  sprint_5m: { best: 1.0, worst: 1.4 },
  sprint_10m: { best: 1.8, worst: 2.4 },
  sprint_20m: { best: 3.0, worst: 4.0 },
  jump_2leg_distance: { best: 220, worst: 140 },
  jump_right_leg: { best: 200, worst: 120 },
  jump_left_leg: { best: 200, worst: 120 },
  jump_2leg_height: { best: 50, worst: 25 },
  blaze_spot_time: { best: 80, worst: 20 },
  flexibility_ankle: { best: 15, worst: 5 },
  flexibility_knee: { best: 20, worst: 8 },
  flexibility_hip: { best: 25, worst: 10 },
  kick_power_kaiser: { best: 500, worst: 50 },
};

const NO_DATA_GROUP_STATS: GroupStats = {
  sprint_5m: { best: -1, worst: -1 },
  sprint_10m: { best: -1, worst: -1 },
  sprint_20m: { best: -1, worst: -1 },
  jump_2leg_distance: { best: -1, worst: -1 },
  jump_right_leg: { best: -1, worst: -1 },
  jump_left_leg: { best: -1, worst: -1 },
  jump_2leg_height: { best: -1, worst: -1 },
  blaze_spot_time: { best: -1, worst: -1 },
  flexibility_ankle: { best: -1, worst: -1 },
  flexibility_knee: { best: -1, worst: -1 },
  flexibility_hip: { best: -1, worst: -1 },
  kick_power_kaiser: { best: -1, worst: -1 },
};

function emptyAssessment(): PlayerAssessment {
  return {
    id: "test",
    user_id: "test-user",
    assessment_date: "2026-04-24",
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
    concentration_notes: null,
    decision_making_notes: null,
    work_ethic_notes: null,
    recovery_notes: null,
    nutrition_notes: null,
    assessed_by: null,
    notes: null,
    created_at: "2026-04-24T00:00:00Z",
  };
}

describe("CARD_STAT_CONFIG", () => {
  it("has each numeric metric appear as a primary input for at most one stat", () => {
    const seen = new Map<string, string>();
    for (const [statKey, config] of Object.entries(CARD_STAT_CONFIG)) {
      for (const input of config.primary) {
        const existing = seen.get(input.metric);
        expect(existing, `${input.metric} appears in both ${existing} and ${statKey}`).toBeUndefined();
        seen.set(input.metric, statKey);
      }
    }
  });
});

describe("calculateCardRatings — Yarin's case (sprints + all 4 jumps + blaze)", () => {
  const assessment: PlayerAssessment = {
    ...emptyAssessment(),
    sprint_5m: 1.08,
    sprint_10m: 2.0,
    jump_2leg_distance: 169,
    jump_right_leg: 156,
    jump_left_leg: 149,
    jump_2leg_height: 42.2,
    blaze_spot_time: 43,
  };

  const ratings = calculateCardRatings(assessment, FULL_GROUP_STATS);

  it("produces real numbers for the four card slots backed by tests he did", () => {
    expect(ratings.pace).toBeTypeOf("number");
    expect(ratings.physical).toBeTypeOf("number");
    expect(ratings.dribbling).toBeTypeOf("number");
    expect(ratings.passing).toBeTypeOf("number");
  });

  it("returns null for shooting (no kick test) and defending (no flexibility tests)", () => {
    expect(ratings.shooting).toBeNull();
    expect(ratings.defending).toBeNull();
  });

  it("computes overall_rating as the average of only the non-null stats", () => {
    const realStats = [ratings.pace, ratings.physical, ratings.dribbling, ratings.passing] as number[];
    const expected = Math.round(realStats.reduce((a, b) => a + b, 0) / realStats.length);
    expect(ratings.overall_rating).toBe(expected);
  });

  it("dribbling is now driven by single-leg jumps, not by blaze", () => {
    const noBlaze = calculateCardRatings({ ...assessment, blaze_spot_time: null }, FULL_GROUP_STATS);
    expect(noBlaze.dribbling).toBe(ratings.dribbling);
    expect(noBlaze.passing).toBeNull();
  });
});

describe("calculateCardRatings — full assessment", () => {
  const fullAssessment: PlayerAssessment = {
    ...emptyAssessment(),
    sprint_5m: 1.05,
    sprint_10m: 1.9,
    sprint_20m: 3.2,
    jump_2leg_distance: 200,
    jump_right_leg: 170,
    jump_left_leg: 165,
    jump_2leg_height: 45,
    blaze_spot_time: 60,
    flexibility_ankle: 12,
    flexibility_knee: 15,
    flexibility_hip: 20,
    kick_power_kaiser: 300,
    coordination: "advanced",
    body_structure: "strong_athletic",
    leg_power_technique: "normal",
  };

  it("all six stats and overall are non-null numbers within 1..99", () => {
    const r = calculateCardRatings(fullAssessment, FULL_GROUP_STATS);
    for (const v of Object.values(r)) {
      expect(v).not.toBeNull();
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(99);
    }
  });
});

describe("calculateCardRatings — all-null assessment", () => {
  it("returns null for every stat and for overall_rating", () => {
    const r = calculateCardRatings(emptyAssessment(), FULL_GROUP_STATS);
    expect(r.pace).toBeNull();
    expect(r.physical).toBeNull();
    expect(r.shooting).toBeNull();
    expect(r.passing).toBeNull();
    expect(r.dribbling).toBeNull();
    expect(r.defending).toBeNull();
    expect(r.overall_rating).toBeNull();
  });
});

describe("calculateCardRatings — partial primary inputs", () => {
  it("PAC averages whichever sprints are present (no fake fill for missing sprint)", () => {
    const a: PlayerAssessment = {
      ...emptyAssessment(),
      sprint_5m: 1.08,
      sprint_10m: 2.0,
    };
    const r = calculateCardRatings(a, FULL_GROUP_STATS);
    expect(r.pace).toBeTypeOf("number");
  });
});

describe("calculateCardRatings — bonuses without a primary signal", () => {
  it("body_structure alone does not produce a physical rating", () => {
    const a: PlayerAssessment = {
      ...emptyAssessment(),
      body_structure: "strong_athletic",
    };
    const r = calculateCardRatings(a, FULL_GROUP_STATS);
    expect(r.physical).toBeNull();
  });

  it("coordination alone does not produce a dribbling or passing rating", () => {
    const a: PlayerAssessment = { ...emptyAssessment(), coordination: "advanced" };
    const r = calculateCardRatings(a, FULL_GROUP_STATS);
    expect(r.dribbling).toBeNull();
    expect(r.passing).toBeNull();
  });
});

describe("calculateCardRatings — sentinel groupStats (no comparison data)", () => {
  it("returns null for every stat when groupStats best/worst are -1", () => {
    const a: PlayerAssessment = {
      ...emptyAssessment(),
      sprint_5m: 1.0,
      jump_2leg_distance: 200,
      blaze_spot_time: 60,
      kick_power_kaiser: 300,
      flexibility_ankle: 12,
    };
    const r = calculateCardRatings(a, NO_DATA_GROUP_STATS);
    expect(r.pace).toBeNull();
    expect(r.physical).toBeNull();
    expect(r.dribbling).toBeNull();
    expect(r.passing).toBeNull();
    expect(r.defending).toBeNull();
    expect(r.shooting).toBeNull();
    expect(r.overall_rating).toBeNull();
  });
});
