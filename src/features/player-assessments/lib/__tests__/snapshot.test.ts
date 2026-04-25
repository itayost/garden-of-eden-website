import { describe, it, expect } from "vitest";
import { composeSnapshot } from "../snapshot";
import type { PlayerAssessment } from "@/types/assessment";
import type { CalculatedRatings } from "@/lib/assessment-to-rating";

const baseAssessment: PlayerAssessment = {
  id: "asmt-1",
  user_id: "user-1",
  assessment_date: "2026-04-24",
  sprint_5m: null, sprint_10m: null, sprint_20m: null,
  jump_2leg_distance: null, jump_right_leg: null, jump_left_leg: null,
  jump_2leg_height: null, blaze_spot_time: null,
  flexibility_ankle: null, flexibility_knee: null, flexibility_hip: null,
  coordination: null, leg_power_technique: null, body_structure: null,
  kick_power_kaiser: null,
  concentration_notes: null, decision_making_notes: null,
  work_ethic_notes: null, recovery_notes: null, nutrition_notes: null,
  assessed_by: null, notes: null,
  created_at: "2026-04-24T00:00:00Z",
};

const sampleRatings: CalculatedRatings = {
  pace: 78, shooting: null, passing: 55, dribbling: 59,
  defending: null, physical: 59, overall_rating: 63,
};

describe("composeSnapshot", () => {
  it("builds a row keyed on assessment_id with the rating values", () => {
    const row = composeSnapshot({
      assessment: baseAssessment,
      ageGroupId: "u12",
      ratings: sampleRatings,
    });
    expect(row.assessment_id).toBe("asmt-1");
    expect(row.user_id).toBe("user-1");
    expect(row.assessment_date).toBe("2026-04-24");
    expect(row.age_group).toBe("u12");
    expect(row.pace).toBe(78);
    expect(row.shooting).toBeNull();
    expect(row.overall_rating).toBe(63);
  });

  it("handles a null age group (no birthdate / unknown cohort)", () => {
    const row = composeSnapshot({
      assessment: baseAssessment,
      ageGroupId: null,
      ratings: sampleRatings,
    });
    expect(row.age_group).toBeNull();
  });
});
