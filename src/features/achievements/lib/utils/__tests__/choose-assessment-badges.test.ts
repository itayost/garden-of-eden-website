import { describe, it, expect } from "vitest";
import { chooseAssessmentBadges } from "../choose-assessment-badges";
import type { PlayerAssessment } from "@/types/assessment";

const empty = (over: Partial<PlayerAssessment>): PlayerAssessment => ({
  id: "x", user_id: "u", assessment_date: "2026-04-24",
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
  ...over,
});

describe("chooseAssessmentBadges — count milestones", () => {
  it("first_assessment when this is the trainee's first", () => {
    expect(
      chooseAssessmentBadges({
        priorAssessmentCount: 0,
        prevAssessment: null,
        newAssessment: empty({ sprint_5m: 1.1 }),
        prevSnapshotOverall: null,
        newSnapshotOverall: 60,
      })
    ).toContain("first_assessment");
  });

  it("five_assessments when this is the 5th", () => {
    const badges = chooseAssessmentBadges({
      priorAssessmentCount: 4,
      prevAssessment: empty({}),
      newAssessment: empty({}),
      prevSnapshotOverall: 60,
      newSnapshotOverall: 60,
    });
    expect(badges).toContain("five_assessments");
    expect(badges).not.toContain("first_assessment");
  });

  it("ten_assessments when this is the 10th", () => {
    expect(
      chooseAssessmentBadges({
        priorAssessmentCount: 9,
        prevAssessment: empty({}),
        newAssessment: empty({}),
        prevSnapshotOverall: 60,
        newSnapshotOverall: 60,
      })
    ).toContain("ten_assessments");
  });
});

describe("chooseAssessmentBadges — sprint_improved", () => {
  it("granted when any sprint metric got faster (lower)", () => {
    const badges = chooseAssessmentBadges({
      priorAssessmentCount: 1,
      prevAssessment: empty({ sprint_5m: 1.2 }),
      newAssessment: empty({ sprint_5m: 1.1 }),
      prevSnapshotOverall: null,
      newSnapshotOverall: null,
    });
    expect(badges).toContain("sprint_improved");
  });

  it("not granted when sprint got slower (higher)", () => {
    const badges = chooseAssessmentBadges({
      priorAssessmentCount: 1,
      prevAssessment: empty({ sprint_5m: 1.1 }),
      newAssessment: empty({ sprint_5m: 1.2 }),
      prevSnapshotOverall: null,
      newSnapshotOverall: null,
    });
    expect(badges).not.toContain("sprint_improved");
  });

  it("not granted on first assessment (no prev to compare)", () => {
    const badges = chooseAssessmentBadges({
      priorAssessmentCount: 0,
      prevAssessment: null,
      newAssessment: empty({ sprint_5m: 1.1 }),
      prevSnapshotOverall: null,
      newSnapshotOverall: null,
    });
    expect(badges).not.toContain("sprint_improved");
  });
});

describe("chooseAssessmentBadges — jump_improved", () => {
  it("granted when any jump metric improved (higher)", () => {
    const badges = chooseAssessmentBadges({
      priorAssessmentCount: 1,
      prevAssessment: empty({ jump_2leg_distance: 150 }),
      newAssessment: empty({ jump_2leg_distance: 160 }),
      prevSnapshotOverall: null,
      newSnapshotOverall: null,
    });
    expect(badges).toContain("jump_improved");
  });
});

describe("chooseAssessmentBadges — overall improvement", () => {
  it("overall_improved_5pts when overall went up by exactly 5", () => {
    const badges = chooseAssessmentBadges({
      priorAssessmentCount: 1,
      prevAssessment: empty({}), newAssessment: empty({}),
      prevSnapshotOverall: 55, newSnapshotOverall: 60,
    });
    expect(badges).toContain("overall_improved_5pts");
    expect(badges).not.toContain("overall_improved_10pts");
  });

  it("overall_improved_10pts when overall went up by 10 or more (and includes 5pts)", () => {
    const badges = chooseAssessmentBadges({
      priorAssessmentCount: 1,
      prevAssessment: empty({}), newAssessment: empty({}),
      prevSnapshotOverall: 50, newSnapshotOverall: 60,
    });
    expect(badges).toContain("overall_improved_10pts");
    expect(badges).toContain("overall_improved_5pts");
  });

  it("no overall badges when prev or new snapshot is null", () => {
    const badges = chooseAssessmentBadges({
      priorAssessmentCount: 1,
      prevAssessment: empty({}), newAssessment: empty({}),
      prevSnapshotOverall: null, newSnapshotOverall: 60,
    });
    expect(badges).not.toContain("overall_improved_5pts");
    expect(badges).not.toContain("overall_improved_10pts");
  });

  it("no overall badges when overall did not improve", () => {
    const badges = chooseAssessmentBadges({
      priorAssessmentCount: 1,
      prevAssessment: empty({}), newAssessment: empty({}),
      prevSnapshotOverall: 60, newSnapshotOverall: 58,
    });
    expect(badges).not.toContain("overall_improved_5pts");
  });
});
