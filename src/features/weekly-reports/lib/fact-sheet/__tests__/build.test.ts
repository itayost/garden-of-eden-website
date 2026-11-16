import { describe, expect, test } from "vitest";
import { buildFactSheet } from "../build";
import { MISSING_GENDER_HOLD, type TraineeWeekInput } from "../types";
import { ME, OTHER, WEEK, assessment, emptyWeek, goal, shiftReport } from "./fixtures";

const PHONE = "0527654321";

/** A week with something in every part, and planted text in every place that must stay out. */
function fullWeek(overrides: Partial<TraineeWeekInput> = {}): TraineeWeekInput {
  const base = emptyWeek();
  // Extra fields a careless loader might pass along; the builder must pick, never spread.
  const profile = { ...base.profile, full_name: "PLANTED-FULL-NAME ישראלי", phone: PHONE, medical_notes: "PLANTED-MEDICAL" };
  return {
    ...base,
    profile,
    roster: [
      { date: "2026-11-17", startTime: "17:00", focus: "מהירות", slotId: "slot-1", counts: true, lateCancel: false, trainerFirstNames: ["יוסי"] },
      { date: "2026-11-18", startTime: "17:00", focus: "כדרור", slotId: "slot-2", counts: true, lateCancel: false, trainerFirstNames: ["דנה"] },
    ],
    arbox: [{ date: "2026-11-15", className: "קבוצתי" }],
    shiftReports: [
      shiftReport({
        report_date: "2026-11-17",
        worked_on_trainee_ids: [ME, OTHER],
        worked_on_details: "PLANTED-OTHER-CHILD",
        worked_on_per_trainee: { [ME]: { details: "3 סטים של קפיצות", categories: ["סריקות"] } },
        injuries_trainee_ids: [ME],
        injuries_per_trainee: { [ME]: { details: "PLANTED-INJURY" } },
        complaints_trainee_ids: [ME],
        complaints_details: `PLANTED-COMPLAINT ${PHONE}`,
      }),
      shiftReport({ id: "report-2", report_date: "2026-11-17", injuries_trainee_ids: [ME], injuries_details: "PLANTED-INJURY" }),
    ],
    sessions: [{ date: "2026-11-16", exercises: [{ name: "סקוואט", category: "כוח", target: "3 סטים" }] }],
    tags: [
      { slotId: "slot-1", date: "2026-11-17", tag: "pain" },
      { slotId: "slot-2", date: "2026-11-18", tag: "effort" },
    ],
    notes: [
      { slotId: "slot-1", date: "2026-11-17", note: "PLANTED-PAIN-NOTE" },
      { slotId: "slot-2", date: "2026-11-18", note: "השקיע מאוד" },
    ],
    checkins: [
      { date: "2026-11-14", sleepHours: 7, energy: 3, soreness: false },
      { date: "2026-11-15", sleepHours: 8, energy: 4, soreness: true },
    ],
    assessment: {
      inWeek: assessment({ sprint_10m: 2.0, notes: "PLANTED-ASSESSMENT-NOTE" }),
      previous: assessment({ id: "a-prev", assessment_date: "2026-09-01", sprint_10m: 2.1 }),
      groupStats: null,
    },
    measurement: {
      inWeek: { measurement_date: "2026-11-16", weight_kg: 61.3, height_cm: 152.4, bmi: 26.4, bmi_percentile: 88, height_percentile: 47 },
      previous: { measurement_date: "2026-08-01", weight_kg: 59.1, height_cm: 150.2, bmi: 26.2, bmi_percentile: 87, height_percentile: 46 },
    },
    dietitianNote: "PLANTED-DIETITIAN להוסיף ירקות",
    goals: [goal()],
    nextGame: { date: "2026-11-22", opponent: "מכבי חיפה" },
    drillCandidates: [{ id: "drill-1", name: "קפיצות צד", why: "זריזות" }],
    ...overrides,
  };
}

describe("buildFactSheet", () => {
  test("fills every part of the sheet", () => {
    const { sheet } = buildFactSheet(fullWeek());
    expect(sheet.version).toBe(1);
    expect(sheet.week).toEqual({ from: WEEK, to: "2026-11-19" });
    expect(sheet.player).toEqual({ gender: "male", ageGroup: "U12", position: "חלוץ", branches: ["קריית אתא"] });
    expect(sheet.attendance.total).toBe(3);
    expect(sheet.workedOn.map((w) => w.source)).toEqual(["אימון אישי", "דוח משמרת, המאמן יוסי"]);
    expect(sheet.workedOn[1].items).toEqual(["סריקות", "3 סטים של קפיצות"]);
    expect(sheet.progress).toEqual([
      { date: "2026-11-18", source: "תגיות מהאימון", label: "תגיות המאמן", details: "השקיע מאוד", categories: ["השקיע"] },
    ]);
    expect(sheet.habits?.sleepAverage).toBe(7.5);
    expect(sheet.assessment?.improvements).toHaveLength(1);
    expect(sheet.goals).toHaveLength(1);
    expect(sheet.drills).toEqual([{ id: "drill-1", name: "קפיצות צד", why: "זריזות" }]);
    expect(sheet.nextGame).toEqual({ date: "2026-11-22", opponent: "מכבי חיפה" });
    expect(sheet.hasNewMeasurement).toBe(true);
    expect(sheet.hasDietitianNote).toBe(true);
  });

  test("never holds a name, a phone, a sensitive entry, body numbers or the dietitian's text", () => {
    const { sheet } = buildFactSheet(fullWeek());
    const text = JSON.stringify(sheet);
    expect(text).not.toContain("PLANTED");
    expect(text).not.toContain("ישראלי");
    expect(text).not.toContain(PHONE);
    expect(text).not.toContain(PHONE.slice(1));
    expect(text).not.toContain("61.3");
    expect(text).not.toContain("152.4");
    expect(text).not.toContain("ירקות");
    expect(text).not.toContain(ME);
    expect(text).not.toContain("2014-03-02");
  });

  test("the body numbers and the dietitian's note stay beside the sheet", () => {
    const { body } = buildFactSheet(fullWeek());
    expect(body).toMatchObject({
      date: "2026-11-16",
      weightKg: 61.3,
      heightCm: 152.4,
      bmiPercentile: 88,
      change: { weightKg: 2.2, heightCm: 2.2 },
      dietitianNote: "PLANTED-DIETITIAN להוסיף ירקות",
    });
  });

  test("sensitive entries and caution tags hold, each reason once", () => {
    const { holds } = buildFactSheet(fullWeek());
    expect(holds).toEqual([
      { code: "sensitive", text: "דוח משמרת מ-17/11 מציין פציעות" },
      { code: "sensitive", text: "דוח משמרת מ-17/11 מציין תלונות" },
      { code: "sensitive", text: "תגית כאב או פציעה מ-17/11" },
    ]);
  });

  test("missing gender holds", () => {
    const base = emptyWeek();
    const { sheet, holds } = buildFactSheet({ ...base, profile: { ...base.profile, gender: null } });
    expect(sheet.player.gender).toBeNull();
    expect(holds).toEqual([MISSING_GENDER_HOLD]);
  });

  test("a quiet week gives an empty sheet and no holds", () => {
    const { sheet, body, holds } = buildFactSheet(emptyWeek());
    expect(holds).toEqual([]);
    expect(body).toBeNull();
    expect(sheet).toMatchObject({
      attendance: { total: 0, lateCancels: 0, days: [] },
      workedOn: [],
      progress: [],
      habits: null,
      assessment: null,
      goals: [],
      drills: [],
      nextGame: null,
      hasNewMeasurement: false,
      hasDietitianNote: false,
    });
  });
});
