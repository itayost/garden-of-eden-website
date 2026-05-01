import { describe, it, expect } from "vitest";
import { playerReportPdfBodySchema } from "../pdf/schema";

const validAssessment = {
  id: "1", user_id: "u1", assessment_date: "2026-01-01", created_at: "2026-01-01T00:00:00Z",
  sprint_5m: null, sprint_10m: null, sprint_20m: null,
  jump_2leg_height: null, jump_2leg_distance: null, jump_right_leg: null, jump_left_leg: null,
  blaze_spot_time: null, kick_power_kaiser: null,
  kick_power_right_foot: null, kick_power_left_foot: null, kick_power_machine_pct: null,
  flexibility_ankle: null, flexibility_knee: null, flexibility_hip: null,
  coordination: null, leg_power_technique: null, body_structure: null,
  concentration_notes: null, decision_making_notes: null, work_ethic_notes: null,
  recovery_notes: null, nutrition_notes: null, assessed_by: null, notes: null,
};

const validBody = {
  profile: {
    full_name: "ישראל", birthdate: "2010-01-01", position: "ST",
    club: "מועדון", created_at: "2024-01-01T00:00:00Z", processed_avatar_url: null,
  },
  assessments: [],
  stats: null,
  attendance: null,
  summary: "",
  strengths: [],
  weaknesses: [],
  socialSkills: [],
};

describe("playerReportPdfBodySchema", () => {
  it("accepts a valid body", () => {
    expect(() => playerReportPdfBodySchema.parse(validBody)).not.toThrow();
  });

  it("rejects missing profile", () => {
    expect(() => playerReportPdfBodySchema.parse({ ...validBody, profile: undefined })).toThrow();
  });

  it("accepts null stats", () => {
    const result = playerReportPdfBodySchema.parse(validBody);
    expect(result.stats).toBeNull();
  });

  it("accepts null attendance", () => {
    const result = playerReportPdfBodySchema.parse(validBody);
    expect(result.attendance).toBeNull();
  });

  it("accepts full stats object", () => {
    const body = {
      ...validBody,
      stats: { overall_rating: 75, pace: 80, shooting: 70, passing: 72, dribbling: 78, defending: 65, physical: 77, card_type: "gold" },
    };
    expect(() => playerReportPdfBodySchema.parse(body)).not.toThrow();
  });

  it("accepts strengths as string array", () => {
    const result = playerReportPdfBodySchema.parse({ ...validBody, strengths: ["מהיר", "חזק"] });
    expect(result.strengths).toEqual(["מהיר", "חזק"]);
  });

  it("rejects invalid coordination enum in assessment", () => {
    const body = {
      ...validBody,
      assessments: [{ ...validAssessment, coordination: "invalid_value" }],
    };
    expect(() => playerReportPdfBodySchema.parse(body)).toThrow();
  });

  it("accepts valid coordination enum", () => {
    const body = {
      ...validBody,
      assessments: [{ ...validAssessment, coordination: "advanced" }],
    };
    expect(() => playerReportPdfBodySchema.parse(body)).not.toThrow();
  });

  it("accepts valid body_structure enum", () => {
    const body = {
      ...validBody,
      assessments: [{ ...validAssessment, body_structure: "good_build" }],
    };
    expect(() => playerReportPdfBodySchema.parse(body)).not.toThrow();
  });

  it("rejects invalid body_structure enum", () => {
    const body = {
      ...validBody,
      assessments: [{ ...validAssessment, body_structure: "invalid" }],
    };
    expect(() => playerReportPdfBodySchema.parse(body)).toThrow();
  });

  it("requires created_at in profile", () => {
    const { created_at: _omitted, ...profileWithout } = validBody.profile;
    expect(() => playerReportPdfBodySchema.parse({ ...validBody, profile: profileWithout })).toThrow();
  });
});
