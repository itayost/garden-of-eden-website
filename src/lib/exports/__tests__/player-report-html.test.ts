import { describe, it, expect } from "vitest";
import { buildPlayerReportHtml } from "../player-report-html";
import type { StaticAssets, PlayerReportHtmlProps } from "../player-report-html";
import type { PlayerAssessment } from "@/types/assessment";

const mockAssets: StaticAssets = {
  heeboRegularB64: "AAAA",
  heeboBoldB64: "BBBB",
  cardTemplateB64: "CCCC",
};

function makeAssessment(overrides: Partial<PlayerAssessment> = {}): PlayerAssessment {
  return {
    id: "1",
    user_id: "u1",
    assessment_date: "2026-01-01",
    sprint_5m: 1.2,
    sprint_10m: 2.0,
    sprint_20m: 3.5,
    jump_2leg_height: 40,
    jump_2leg_distance: 180,
    jump_right_leg: 90,
    jump_left_leg: 88,
    blaze_spot_time: 30,
    kick_power_kaiser: 250,
    kick_power_right_foot: 250,
    kick_power_left_foot: null,
    kick_power_machine_pct: null,
    flexibility_ankle: 15,
    flexibility_knee: 12,
    flexibility_hip: 20,
    coordination: "advanced",
    leg_power_technique: "normal",
    body_structure: "good_build",
    concentration_notes: null,
    decision_making_notes: null,
    work_ethic_notes: null,
    recovery_notes: null,
    nutrition_notes: null,
    assessed_by: null,
    notes: null,
    created_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const mockProfile: PlayerReportHtmlProps["profile"] = {
  full_name: "ישראל ישראלי",
  birthdate: "2010-01-01",
  position: "ST",
  club: "מועדון העדן",
  created_at: "2024-01-01T00:00:00Z",
  processed_avatar_url: null,
};

const mockStats: NonNullable<PlayerReportHtmlProps["stats"]> = {
  overall_rating: 75,
  pace: 80,
  shooting: 70,
  passing: 72,
  dribbling: 78,
  defending: 65,
  physical: 77,
  card_type: "gold",
};

function makeProps(overrides: Partial<PlayerReportHtmlProps> = {}): PlayerReportHtmlProps {
  return {
    profile: mockProfile,
    assessments: [],
    stats: null,
    attendance: null,
    summary: "",
    strengths: [],
    weaknesses: [],
    socialSkills: [],
    avatarDataUri: null,
    ...overrides,
  };
}

describe("buildPlayerReportHtml", () => {
  it("returns a string starting with DOCTYPE", () => {
    const html = buildPlayerReportHtml(makeProps(), mockAssets);
    expect(html).toMatch(/^<!DOCTYPE html>/);
  });

  it("includes the player name", () => {
    const html = buildPlayerReportHtml(makeProps(), mockAssets);
    expect(html).toContain("ישראל ישראלי");
  });

  it("includes FIFA card with card template image when stats provided", () => {
    const html = buildPlayerReportHtml(makeProps({ stats: mockStats }), mockAssets);
    expect(html).toContain("data:image/webp;base64,CCCC");
    expect(html).toContain("75"); // overall_rating
  });

  it("omits card template and shows fallback when stats are null", () => {
    const html = buildPlayerReportHtml(makeProps({ stats: null }), mockAssets);
    expect(html).not.toContain("data:image/webp;base64,CCCC");
    expect(html).toContain("אין נתוני FIFA");
  });

  it("shows לא זמין for attendance when null", () => {
    const html = buildPlayerReportHtml(makeProps({ attendance: null }), mockAssets);
    expect(html).toContain("לא זמין");
    expect(html).not.toContain("נוכחות לא זמין");
  });

  it("shows attendance stats when provided", () => {
    const html = buildPlayerReportHtml(
      makeProps({ attendance: { totalSessions: 42, weeklyAverage: 2.5 } }),
      mockAssets,
    );
    expect(html).toContain("42");
  });

  it("includes assessment table metric labels when assessments present", () => {
    const html = buildPlayerReportHtml(
      makeProps({ assessments: [makeAssessment()] }),
      mockAssets,
    );
    expect(html).toContain("ספרינט 5 מטר");
  });

  it("omits assessment table when assessments empty", () => {
    const html = buildPlayerReportHtml(makeProps({ assessments: [] }), mockAssets);
    expect(html).not.toContain("ספרינט 5 מטר");
  });

  it("maps coordination enum to Hebrew label", () => {
    const html = buildPlayerReportHtml(
      makeProps({ assessments: [makeAssessment({ coordination: "advanced" })] }),
      mockAssets,
    );
    expect(html).toContain("מתקדמת");
  });

  it("shows mini chart SVG when 2+ assessments", () => {
    const html = buildPlayerReportHtml(
      makeProps({ assessments: [makeAssessment(), makeAssessment()] }),
      mockAssets,
    );
    expect(html).toContain("<polyline");
  });

  it("shows ערכים נוכחיים section (not chart) when exactly 1 assessment", () => {
    const html = buildPlayerReportHtml(
      makeProps({ assessments: [makeAssessment()] }),
      mockAssets,
    );
    expect(html).toContain("ערכים נוכחיים");
    expect(html).not.toContain("<polyline");
  });

  it("uses green (#22c55e) for improved metrics (lower sprint time)", () => {
    // sprint lower is better; a1=latest=1.0 < a2=prev=1.5 → improved
    const a1 = makeAssessment({ sprint_5m: 1.0 });
    const a2 = makeAssessment({ sprint_5m: 1.5 });
    const html = buildPlayerReportHtml(
      makeProps({ assessments: [a1, a2] }),
      mockAssets,
    );
    expect(html).toContain("#22c55e");
  });

  it("uses amber (#d97706) for declined metrics (higher sprint time)", () => {
    // sprint lower is better; a1=latest=1.5 > a2=prev=1.2 → declined
    const a1 = makeAssessment({ sprint_5m: 1.5 });
    const a2 = makeAssessment({ sprint_5m: 1.2 });
    const html = buildPlayerReportHtml(
      makeProps({ assessments: [a1, a2] }),
      mockAssets,
    );
    expect(html).toContain("#d97706");
  });

  it("includes radar SVG polygon when stats provided", () => {
    const html = buildPlayerReportHtml(makeProps({ stats: mockStats }), mockAssets);
    expect(html).toContain("rgba(34,197,94,0.2)");
  });

  it("omits radar SVG when stats are null", () => {
    const html = buildPlayerReportHtml(makeProps({ stats: null }), mockAssets);
    expect(html).not.toContain("rgba(34,197,94,0.2)");
  });

  it("embeds avatar data URI in FIFA card when provided", () => {
    const html = buildPlayerReportHtml(
      makeProps({ stats: mockStats, avatarDataUri: "data:image/png;base64,AVATAR" }),
      mockAssets,
    );
    expect(html).toContain("data:image/png;base64,AVATAR");
  });

  it("shows player initials in FIFA card when no avatar", () => {
    const html = buildPlayerReportHtml(
      makeProps({ stats: mockStats, avatarDataUri: null }),
      mockAssets,
    );
    // First char of full_name
    expect(html).toContain("ישראל ישראלי".charAt(0));
  });

  it("includes summary text", () => {
    const html = buildPlayerReportHtml(makeProps({ summary: "שחקן מצוין" }), mockAssets);
    expect(html).toContain("שחקן מצוין");
  });

  it("includes strength and weakness bullets", () => {
    const html = buildPlayerReportHtml(
      makeProps({ strengths: ["מהיר"], weaknesses: ["חלש בהגנה"] }),
      mockAssets,
    );
    expect(html).toContain("מהיר");
    expect(html).toContain("חלש בהגנה");
  });

  it("shows both page footers", () => {
    const html = buildPlayerReportHtml(makeProps(), mockAssets);
    expect(html).toContain("דף 1 מתוך 2");
    expect(html).toContain("דף 2 מתוך 2");
  });

  it("shows אין שיפורים מדידים when no metrics improved across 2 assessments", () => {
    // Both assessments identical → no improvement
    const a = makeAssessment({ sprint_5m: 1.2, jump_2leg_height: 40 });
    const html = buildPlayerReportHtml(
      makeProps({ assessments: [a, a] }),
      mockAssets,
    );
    expect(html).toContain("אין שיפורים מדידים");
  });

  it("embeds Heebo font data URIs", () => {
    const html = buildPlayerReportHtml(makeProps(), mockAssets);
    expect(html).toContain("base64,AAAA"); // heeboRegularB64
    expect(html).toContain("base64,BBBB"); // heeboBoldB64
  });

  it("escapes HTML special chars in full_name to prevent XSS", () => {
    const html = buildPlayerReportHtml(
      makeProps({ profile: { ...mockProfile, full_name: '<script>alert(1)</script>' } }),
      mockAssets,
    );
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });

  it("escapes HTML special chars in summary to prevent XSS", () => {
    const html = buildPlayerReportHtml(
      makeProps({ summary: '<img src=x onerror=alert(1)>' }),
      mockAssets,
    );
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img");
  });

  it("escapes HTML special chars in strengths to prevent XSS", () => {
    const html = buildPlayerReportHtml(
      makeProps({ strengths: ['<script>evil()</script>'] }),
      mockAssets,
    );
    expect(html).not.toContain("<script>evil");
    expect(html).toContain("&lt;script&gt;");
  });
});
