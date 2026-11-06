import { describe, it, expect } from "vitest";
import {
  ACHIEVEMENT_CATEGORIES,
  DEFAULT_SHIFT_REPORT,
  WORK_TOPICS,
  shiftReportSchema,
} from "../shift-report";

const NEW_WORK_TOPICS = [
  "סיומות לשער",
  "סריקות",
  "דיוק במסירה לשער קטן",
  "השתחררות מלחץ",
  "עבודה כנגד גומיית התנגדות",
] as const;

const TRAINEE_ID = "7f0c6a1e-2b4d-4c8e-9a51-3d2f6b8e0c14";

function reportWith(
  field: "worked_on_per_trainee" | "achievements_per_trainee",
  categories: readonly string[],
) {
  return {
    ...DEFAULT_SHIFT_REPORT,
    report_date: "2026-11-01",
    [field]: { [TRAINEE_ID]: { details: "", categories: [...categories] } },
  };
}

describe("WORK_TOPICS", () => {
  it("keeps every existing topic, in order, then adds the five new ones", () => {
    expect(WORK_TOPICS).toEqual([...ACHIEVEMENT_CATEGORIES, ...NEW_WORK_TOPICS]);
  });

  it("leaves the achievement categories as they were", () => {
    for (const topic of NEW_WORK_TOPICS) {
      expect(ACHIEVEMENT_CATEGORIES).not.toContain(topic);
    }
    expect(ACHIEVEMENT_CATEGORIES).toHaveLength(13);
  });
});

describe("shiftReportSchema: worked-on topics and achievements", () => {
  it("accepts each new topic under what was worked on", () => {
    const parsed = shiftReportSchema.safeParse(reportWith("worked_on_per_trainee", NEW_WORK_TOPICS));
    expect(parsed.success).toBe(true);
  });

  it("keeps the selected topics when parsing", () => {
    const parsed = shiftReportSchema.parse(reportWith("worked_on_per_trainee", ["סריקות", "כדרור"]));
    expect(parsed.worked_on_per_trainee?.[TRAINEE_ID]?.categories).toEqual(["סריקות", "כדרור"]);
  });

  it("still accepts a saved report's existing worked-on topics", () => {
    const parsed = shiftReportSchema.safeParse(reportWith("worked_on_per_trainee", ACHIEVEMENT_CATEGORIES));
    expect(parsed.success).toBe(true);
  });

  it.each(NEW_WORK_TOPICS)("refuses %s as an achievement", (topic) => {
    const parsed = shiftReportSchema.safeParse(reportWith("achievements_per_trainee", [topic]));
    expect(parsed.success).toBe(false);
  });

  it("still accepts the existing achievement categories", () => {
    const parsed = shiftReportSchema.safeParse(reportWith("achievements_per_trainee", ACHIEVEMENT_CATEGORIES));
    expect(parsed.success).toBe(true);
  });

  it("refuses a topic outside the list", () => {
    const parsed = shiftReportSchema.safeParse(reportWith("worked_on_per_trainee", ["נושא שלא קיים"]));
    expect(parsed.success).toBe(false);
  });
});
