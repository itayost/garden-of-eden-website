import { describe, expect, it } from "vitest";
import { playerReportPdfBodySchema } from "../schema";

const baseBody = {
  profile: {
    full_name: "דני כהן",
    birthdate: "2010-05-01",
    position: "חלוץ",
    club: "מכבי",
    created_at: "2025-01-01T00:00:00.000Z",
    processed_avatar_url: null,
  },
  assessments: [],
  attendance: null,
  summary: "",
  strengths: [],
  weaknesses: [],
  socialSkills: [],
};

const numericStats = {
  overall_rating: 72,
  pace: 70,
  shooting: 65,
  passing: 68,
  dribbling: 71,
  defending: 60,
  physical: 66,
  card_type: null,
};

const nullStats = {
  overall_rating: null,
  pace: null,
  shooting: null,
  passing: null,
  dribbling: null,
  defending: null,
  physical: null,
  card_type: null,
};

describe("playerReportPdfBodySchema stats", () => {
  it("accepts stats with all-null rating fields (no snapshot yet)", () => {
    const result = playerReportPdfBodySchema.safeParse({ ...baseBody, stats: nullStats });
    expect(result.success).toBe(true);
  });

  it("accepts fully-numeric stats", () => {
    const result = playerReportPdfBodySchema.safeParse({ ...baseBody, stats: numericStats });
    expect(result.success).toBe(true);
  });

  it("accepts stats: null (trainee with zero assessments)", () => {
    const result = playerReportPdfBodySchema.safeParse({ ...baseBody, stats: null });
    expect(result.success).toBe(true);
  });

  it("rejects non-numeric, non-null rating values", () => {
    const result = playerReportPdfBodySchema.safeParse({
      ...baseBody,
      stats: { ...numericStats, pace: "fast" },
    });
    expect(result.success).toBe(false);
  });
});
