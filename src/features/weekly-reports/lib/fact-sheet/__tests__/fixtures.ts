/**
 * Shared fixtures for the Fact sheet tests. Not a test file itself: vitest
 * collects only *.test.ts.
 */

import type { ShiftReportForNotes } from "@/lib/utils/trainee-notes";
import type { PlayerAssessment } from "@/types/assessment";
import type { PlayerGoalRow } from "@/types/database";
import type { TraineeWeekInput } from "../types";

export const ME = "11111111-1111-4111-8111-111111111111";
export const OTHER = "22222222-2222-4222-8222-222222222222";
export const WEEK = "2026-11-13";

/** A Shift report that names nobody; override the categories a test needs. */
export function shiftReport(overrides: Partial<ShiftReportForNotes> = {}): ShiftReportForNotes {
  return {
    id: "report-1",
    trainer_id: "trainer-1",
    report_date: "2026-11-17",
    trainer_name: "יוסי כהן",
    has_social_skills: false,
    new_trainees_ids: [],
    new_trainees_details: null,
    new_trainees_per_trainee: {},
    discipline_trainee_ids: [],
    discipline_details: null,
    discipline_per_trainee: {},
    injuries_trainee_ids: [],
    injuries_details: null,
    injuries_per_trainee: {},
    limitations_trainee_ids: [],
    limitations_details: null,
    limitations_per_trainee: {},
    worked_on_trainee_ids: [],
    worked_on_details: null,
    worked_on_per_trainee: {},
    achievements_trainee_ids: [],
    achievements_details: null,
    achievements_per_trainee: {},
    mental_state_trainee_ids: [],
    mental_state_details: null,
    mental_state_per_trainee: {},
    complaints_trainee_ids: [],
    complaints_details: null,
    complaints_per_trainee: {},
    insufficient_attention_trainee_ids: [],
    insufficient_attention_details: null,
    insufficient_attention_per_trainee: {},
    pro_candidates_trainee_ids: [],
    pro_candidates_details: null,
    pro_candidates_per_trainee: {},
    social_skills_trainee_ids: [],
    social_skills_details: null,
    social_skills_per_trainee: {},
    homework_trainee_ids: [],
    homework_details: null,
    homework_per_trainee: {},
    video_feedback_trainee_ids: [],
    video_feedback_details: null,
    video_feedback_per_trainee: {},
    praise_trainee_ids: [],
    praise_details: null,
    praise_per_trainee: {},
    ...overrides,
  };
}

/** An Assessment with no results; override the metrics a test needs. */
export function assessment(overrides: Partial<PlayerAssessment> = {}): PlayerAssessment {
  return {
    id: "assessment-1",
    user_id: ME,
    assessment_date: "2026-11-16",
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
    envelope: null,
    envelope_ball: null,
    concentration_notes: null,
    decision_making_notes: null,
    work_ethic_notes: null,
    recovery_notes: null,
    nutrition_notes: null,
    assessed_by: null,
    notes: null,
    created_at: "2026-11-16T10:00:00Z",
    ...overrides,
  };
}

export function goal(overrides: Partial<PlayerGoalRow> = {}): PlayerGoalRow {
  return {
    id: "goal-1",
    user_id: ME,
    metric_key: "sprint_10m",
    target_value: 1.9,
    baseline_value: 2.1,
    current_value: 2.0,
    achieved_at: null,
    achieved_value: null,
    is_lower_better: true,
    created_at: "2026-10-01T10:00:00Z",
    created_by: null,
    updated_at: "2026-10-01T10:00:00Z",
    ...overrides,
  };
}

/** A week with nothing in it but the profile. */
export function emptyWeek(overrides: Partial<TraineeWeekInput> = {}): TraineeWeekInput {
  return {
    traineeId: ME,
    weekStart: WEEK,
    profile: {
      gender: "male",
      birthdate: "2014-03-02",
      position: "חלוץ",
      ageGroup: "U12",
      branchNames: ["קריית אתא"],
    },
    roster: [],
    arbox: [],
    shiftReports: [],
    sessions: [],
    tags: [],
    notes: [],
    checkins: [],
    preForms: [],
    postForms: [],
    assessment: { inWeek: null, previous: null, groupStats: null },
    measurement: { inWeek: null, previous: null },
    dietitianNote: null,
    goals: [],
    nextGame: null,
    drillCandidates: [],
    ...overrides,
  };
}
