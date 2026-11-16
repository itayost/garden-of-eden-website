import { describe, expect, test } from "vitest";
import { CATEGORY_COLUMNS } from "@/lib/utils/trainee-notes";
import { IGNORED_NOTE_TYPES, SENSITIVE_NOTE_TYPES, WRITTEN_NOTE_TYPES } from "../sensitive";
import { shiftReportFacts, traineeDetails } from "../shift-notes";
import { ME, OTHER, shiftReport } from "./fixtures";

const column = (type: string) => {
  const found = CATEGORY_COLUMNS.find((c) => c.type === type);
  if (!found) throw new Error(`no column ${type}`);
  return found;
};

describe("the three note type lists", () => {
  test("cover all 14 Shift report categories exactly once", () => {
    const listed = [...WRITTEN_NOTE_TYPES, ...SENSITIVE_NOTE_TYPES, ...IGNORED_NOTE_TYPES];
    const all = CATEGORY_COLUMNS.map((c) => c.type);
    expect(all).toHaveLength(14);
    expect([...listed].sort()).toEqual([...all].sort());
    expect(new Set(listed).size).toBe(listed.length);
  });
});

describe("sensitive categories", () => {
  test("an injuries entry naming the Trainee holds once and copies nothing", () => {
    const report = shiftReport({
      injuries_trainee_ids: [ME],
      injuries_details: "PLANTED-INJURY shared",
      injuries_per_trainee: { [ME]: { details: "PLANTED-INJURY own" } },
    });
    const facts = shiftReportFacts([report], ME);
    expect(facts.holds).toEqual([{ code: "sensitive", text: "דוח משמרת מ-17/11 מציין פציעות" }]);
    expect(facts.workedOn).toEqual([]);
    expect(facts.progress).toEqual([]);
    expect(JSON.stringify(facts)).not.toContain("PLANTED-INJURY");
  });

  test("every sensitive category holds and none of its text reaches the facts", () => {
    const overrides = Object.fromEntries(
      SENSITIVE_NOTE_TYPES.flatMap((type) => {
        const c = column(type);
        return [
          [c.traineeIdsKey, [ME]],
          [c.detailsKey, `PLANTED-${type}-shared`],
          [c.perTraineeKey, { [ME]: { details: `PLANTED-${type}-own` } }],
        ];
      }),
    );
    const facts = shiftReportFacts([shiftReport(overrides)], ME);
    expect(facts.holds).toHaveLength(SENSITIVE_NOTE_TYPES.length);
    expect(facts.holds.every((h) => h.code === "sensitive")).toBe(true);
    expect(JSON.stringify(facts)).not.toContain("PLANTED");
  });

  test("a sensitive entry about another child does not hold", () => {
    const report = shiftReport({ injuries_trainee_ids: [OTHER], injuries_details: "PLANTED-INJURY" });
    expect(shiftReportFacts([report], ME).holds).toEqual([]);
  });
});

describe("ignored categories", () => {
  test("a pro candidates entry gives no hold and no item", () => {
    const report = shiftReport({
      pro_candidates_trainee_ids: [ME],
      pro_candidates_per_trainee: { [ME]: { details: "PLANTED-PRO" } },
      new_trainees_ids: [ME],
      social_skills_trainee_ids: [ME],
    });
    const facts = shiftReportFacts([report], ME);
    expect(facts).toEqual({ workedOn: [], progress: [], holds: [] });
  });
});

describe("traineeDetails", () => {
  test("uses the Trainee's own per-trainee details", () => {
    const report = shiftReport({
      worked_on_trainee_ids: [ME, OTHER],
      worked_on_details: "PLANTED-OTHER-CHILD",
      worked_on_per_trainee: { [ME]: { details: "בעיטה ברגל שמאל" } },
    });
    expect(traineeDetails(report, column("worked_on"), ME)).toBe("בעיטה ברגל שמאל");
  });

  test("never copies shared text of a category that names two children", () => {
    const report = shiftReport({
      worked_on_trainee_ids: [ME, OTHER],
      worked_on_details: "PLANTED-OTHER-CHILD ודני עבדו על מסירות",
    });
    expect(traineeDetails(report, column("worked_on"), ME)).toBeNull();
    expect(JSON.stringify(shiftReportFacts([report], ME))).not.toContain("PLANTED-OTHER-CHILD");
  });

  test("another child named only in the per-trainee keys counts too", () => {
    const report = shiftReport({
      praise_trainee_ids: [ME],
      praise_details: "PLANTED-OTHER-CHILD",
      praise_per_trainee: { [OTHER]: { details: "" } },
    });
    expect(traineeDetails(report, column("praise"), ME)).toBeNull();
    expect(JSON.stringify(shiftReportFacts([report], ME))).not.toContain("PLANTED-OTHER-CHILD");
  });

  test("another child whose per-trainee entry is malformed still counts", () => {
    const report = shiftReport({
      praise_trainee_ids: [ME],
      praise_details: "PLANTED-OTHER-CHILD",
      praise_per_trainee: { [OTHER]: null },
    });
    expect(traineeDetails(report, column("praise"), ME)).toBeNull();
  });

  test("copies shared text when the category names only this Trainee", () => {
    const report = shiftReport({ worked_on_trainee_ids: [ME], worked_on_details: "עבודה על סיומות" });
    expect(traineeDetails(report, column("worked_on"), ME)).toBe("עבודה על סיומות");
  });

  test("blank own details fall back only under the same rule", () => {
    const report = shiftReport({
      worked_on_trainee_ids: [ME],
      worked_on_details: "עבודה על סיומות",
      worked_on_per_trainee: { [ME]: { details: "   " } },
    });
    expect(traineeDetails(report, column("worked_on"), ME)).toBe("עבודה על סיומות");
  });
});

describe("written categories", () => {
  test("worked on keeps its work topics and details, with the trainer's first name only", () => {
    const report = shiftReport({
      worked_on_trainee_ids: [ME],
      worked_on_per_trainee: { [ME]: { details: "מסירות", categories: ["סריקות", "not-a-topic"] } },
    });
    const facts = shiftReportFacts([report], ME);
    expect(facts.workedOn).toEqual([
      { date: "2026-11-17", source: "דוח משמרת, המאמן יוסי", items: ["סריקות", "מסירות"] },
    ]);
    expect(JSON.stringify(facts)).not.toContain("כהן");
  });

  test("achievements keep their categories; praise, homework and video feedback are progress", () => {
    const report = shiftReport({
      achievements_trainee_ids: [ME],
      achievements_per_trainee: { [ME]: { details: "שיפור יפה", categories: ["מהירות"] } },
      praise_trainee_ids: [ME],
      homework_trainee_ids: [ME],
      homework_per_trainee: { [ME]: { details: "קפיצות בבית" } },
      video_feedback_trainee_ids: [ME],
    });
    const { progress, holds } = shiftReportFacts([report], ME);
    expect(holds).toEqual([]);
    expect(progress.map((p) => p.label)).toEqual(["הישגים", "שיעורי בית", "פידבק וידאו להורים", "פרגון"]);
    expect(progress[0]).toEqual({
      date: "2026-11-17",
      source: "דוח משמרת, המאמן יוסי",
      label: "הישגים",
      details: "שיפור יפה",
      categories: ["מהירות"],
    });
    expect(progress[1].details).toBe("קפיצות בבית");
    expect(progress[3]).toMatchObject({ details: null, categories: [] });
  });

  test("reports are read in date order", () => {
    const later = shiftReport({ id: "b", report_date: "2026-11-18", praise_trainee_ids: [ME] });
    const earlier = shiftReport({ id: "a", report_date: "2026-11-14", praise_trainee_ids: [ME] });
    expect(shiftReportFacts([later, earlier], ME).progress.map((p) => p.date)).toEqual(["2026-11-14", "2026-11-18"]);
  });
});
