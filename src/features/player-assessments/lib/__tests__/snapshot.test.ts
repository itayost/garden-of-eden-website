import { describe, it, expect } from "vitest";
import { composeSnapshot, rateAssessment } from "../snapshot";
import type { PlayerAssessment } from "@/types/assessment";
import type { CalculatedRatings, GroupStats } from "@/lib/assessment-to-rating";
import { NUMERIC_METRIC_KEYS } from "@/lib/utils/assessment-metrics";

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
  kick_power_right_foot: null,
  kick_power_left_foot: null,
  kick_power_machine_pct: null,
  shuffle_10m: null,
  sprint_10m_h: null,
  sprint_10m_h_ball: null,
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

// Every metric spans 100 (worst) to 200 (best), so a jump of 150 sits mid-scale.
const flatStats = Object.fromEntries(
  NUMERIC_METRIC_KEYS.map((key) => [key, { best: 200, worst: 100 }])
) as GroupStats;

describe("rateAssessment", () => {
  const jumped = { ...baseAssessment, assessment_date: "2025-11-01", jump_2leg_distance: 150 };
  const born = (birthdate: string | null) => ({
    birthdate,
    age_group_override: null,
    age_group_override_until: null,
  });

  it("uses the age group on the assessment date, not today", () => {
    // Born 2015-06-01: 10 on 2025-11-01 (U12); on 2025-05-01 she was 9 (U10).
    const stats = new Map([["u10", flatStats], ["u12", flatStats]]);
    const early = rateAssessment({ ...jumped, assessment_date: "2025-05-01" }, born("2015-06-01"), stats);
    const late = rateAssessment(jumped, born("2015-06-01"), stats);
    expect(early.ok && early.row.age_group).toBe("u10");
    expect(late.ok && late.row.age_group).toBe("u12");
  });

  it("uses a staff-set group while it lasts", () => {
    // Born 2014-02-27: 12 on 2026-09-30 (U15 by age), set to U12 until his next birthday.
    const yarin = { birthdate: "2014-02-27", age_group_override: "u12", age_group_override_until: "2027-02-27" };
    const stats = new Map([["u12", flatStats], ["u15", flatStats]]);
    const during = rateAssessment({ ...jumped, assessment_date: "2026-09-30" }, yarin, stats);
    const after = rateAssessment({ ...jumped, assessment_date: "2027-03-01" }, yarin, stats);
    expect(during.ok && during.row.age_group).toBe("u12");
    expect(after.ok && after.row.age_group).toBe("u15");
  });

  it("rates against that group's benchmarks", () => {
    const result = rateAssessment(jumped, born("2015-06-01"), new Map([["u12", flatStats]]));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.row.physical).not.toBeNull();
  });

  it("reports no_age_group for a missing profile, birthdate, or future birthdate", () => {
    const stats = new Map([["u12", flatStats]]);
    expect(rateAssessment(jumped, null, stats)).toEqual({ ok: false, reason: "no_age_group" });
    expect(rateAssessment(jumped, born(null), stats)).toEqual({ ok: false, reason: "no_age_group" });
    expect(rateAssessment(jumped, born("2026-01-10"), stats)).toEqual({ ok: false, reason: "no_age_group" });
  });

  it("reports no_benchmarks when the group has none", () => {
    expect(rateAssessment(jumped, born("2015-06-01"), new Map([["u12", null]]))).toEqual({
      ok: false,
      reason: "no_benchmarks",
    });
  });
});
