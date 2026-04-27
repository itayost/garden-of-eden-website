import { describe, it, expect } from "vitest";
import { extractTraineeNotes, type ShiftReportForNotes } from "../trainee-notes";

// Helper to create a minimal shift report with defaults
function makeReport(
  overrides: Partial<ShiftReportForNotes> & Pick<ShiftReportForNotes, "id" | "report_date" | "trainer_name">,
): ShiftReportForNotes {
  return {
    trainer_id: "trainer-default-id",
    new_trainees_ids: [],
    new_trainees_details: null,
    new_trainees_per_trainee: null,
    discipline_trainee_ids: [],
    discipline_details: null,
    discipline_per_trainee: null,
    injuries_trainee_ids: [],
    injuries_details: null,
    injuries_per_trainee: null,
    limitations_trainee_ids: [],
    limitations_details: null,
    limitations_per_trainee: null,
    worked_on_trainee_ids: [],
    worked_on_details: null,
    worked_on_per_trainee: null,
    achievements_trainee_ids: [],
    achievements_details: null,
    achievements_per_trainee: null,
    mental_state_trainee_ids: [],
    mental_state_details: null,
    mental_state_per_trainee: null,
    complaints_trainee_ids: [],
    complaints_details: null,
    complaints_per_trainee: null,
    insufficient_attention_trainee_ids: [],
    insufficient_attention_details: null,
    insufficient_attention_per_trainee: null,
    pro_candidates_trainee_ids: [],
    pro_candidates_details: null,
    pro_candidates_per_trainee: null,
    has_social_skills: false,
    social_skills_trainee_ids: [],
    social_skills_details: null,
    social_skills_per_trainee: null,
    ...overrides,
  };
}

const TRAINEE_A = "aaaa-aaaa-aaaa-aaaa";
const TRAINEE_B = "bbbb-bbbb-bbbb-bbbb";

describe("extractTraineeNotes", () => {
  it("returns empty array when no reports provided", () => {
    const result = extractTraineeNotes([], TRAINEE_A);
    expect(result).toEqual([]);
  });

  it("returns empty array when trainee is not mentioned in any report", () => {
    const reports = [
      makeReport({
        id: "r1",
        report_date: "2026-03-01",
        trainer_name: "מאמן א",
        discipline_trainee_ids: [TRAINEE_B],
        discipline_details: "בעיות משמעת",
      }),
    ];
    const result = extractTraineeNotes(reports, TRAINEE_A);
    expect(result).toEqual([]);
  });

  it("extracts discipline note when trainee is tagged", () => {
    const reports = [
      makeReport({
        id: "r1",
        report_date: "2026-03-01",
        trainer_name: "מאמן א",
        discipline_trainee_ids: [TRAINEE_A, TRAINEE_B],
        discipline_details: "בעיות משמעת באימון",
      }),
    ];
    const result = extractTraineeNotes(reports, TRAINEE_A);
    expect(result).toHaveLength(1);
    expect(result[0].reportId).toBe("r1");
    expect(result[0].reportDate).toBe("2026-03-01");
    expect(result[0].trainerName).toBe("מאמן א");
    expect(result[0].notes).toHaveLength(1);
    expect(result[0].notes[0]).toEqual({
      type: "discipline",
      label: "משמעת",
      details: "בעיות משמעת באימון",
    });
  });

  it("extracts multiple categories from one report", () => {
    const reports = [
      makeReport({
        id: "r1",
        report_date: "2026-03-02",
        trainer_name: "מאמן ב",
        discipline_trainee_ids: [TRAINEE_A],
        discipline_details: "אחר",
        injuries_trainee_ids: [TRAINEE_A],
        injuries_details: "פציעה ברגל",
        pro_candidates_trainee_ids: [TRAINEE_A],
        pro_candidates_details: "פוטנציאל גבוה",
      }),
    ];
    const result = extractTraineeNotes(reports, TRAINEE_A);
    expect(result).toHaveLength(1);
    expect(result[0].notes).toHaveLength(3);

    const types = result[0].notes.map((n) => n.type);
    expect(types).toContain("discipline");
    expect(types).toContain("injuries");
    expect(types).toContain("pro_candidates");
  });

  it("extracts achievements with per-trainee details and categories", () => {
    const reports = [
      makeReport({
        id: "r1",
        report_date: "2026-03-03",
        trainer_name: "מאמן ג",
        achievements_trainee_ids: [TRAINEE_A, TRAINEE_B],
        achievements_per_trainee: {
          [TRAINEE_A]: {
            details: "שיפור משמעותי",
            categories: ["מהירות", "זריזות"],
          },
          [TRAINEE_B]: {
            details: "סבבה",
            categories: ["כוח רגליים"],
          },
        },
      }),
    ];
    const result = extractTraineeNotes(reports, TRAINEE_A);
    expect(result).toHaveLength(1);
    expect(result[0].notes).toHaveLength(1);
    expect(result[0].notes[0]).toEqual({
      type: "achievements",
      label: "הישגים",
      details: "שיפור משמעותי",
      achievementCategories: ["מהירות", "זריזות"],
    });
  });

  it("uses general achievements_details when per-trainee entry has no details", () => {
    const reports = [
      makeReport({
        id: "r1",
        report_date: "2026-03-03",
        trainer_name: "מאמן ד",
        achievements_trainee_ids: [TRAINEE_A],
        achievements_details: "הישגים כלליים",
        achievements_per_trainee: {
          [TRAINEE_A]: {
            categories: ["כוח מתפרץ"],
          },
        },
      }),
    ];
    const result = extractTraineeNotes(reports, TRAINEE_A);
    expect(result[0].notes[0].details).toBe("הישגים כלליים");
    expect(result[0].notes[0].achievementCategories).toEqual(["כוח מתפרץ"]);
  });

  it("sorts results by report_date descending", () => {
    const reports = [
      makeReport({
        id: "r-old",
        report_date: "2026-02-01",
        trainer_name: "מאמן א",
        injuries_trainee_ids: [TRAINEE_A],
        injuries_details: "ישן",
      }),
      makeReport({
        id: "r-new",
        report_date: "2026-03-05",
        trainer_name: "מאמן ב",
        injuries_trainee_ids: [TRAINEE_A],
        injuries_details: "חדש",
      }),
      makeReport({
        id: "r-mid",
        report_date: "2026-02-15",
        trainer_name: "מאמן ג",
        discipline_trainee_ids: [TRAINEE_A],
        discipline_details: "אמצע",
      }),
    ];
    const result = extractTraineeNotes(reports, TRAINEE_A);
    expect(result).toHaveLength(3);
    expect(result[0].reportId).toBe("r-new");
    expect(result[1].reportId).toBe("r-mid");
    expect(result[2].reportId).toBe("r-old");
  });

  it("handles note with null details", () => {
    const reports = [
      makeReport({
        id: "r1",
        report_date: "2026-03-01",
        trainer_name: "מאמן א",
        discipline_trainee_ids: [TRAINEE_A],
        discipline_details: null,
      }),
    ];
    const result = extractTraineeNotes(reports, TRAINEE_A);
    expect(result).toHaveLength(1);
    expect(result[0].notes[0].details).toBeNull();
  });

  it("includes new_trainee category when trainee is in new_trainees_ids", () => {
    const reports = [
      makeReport({
        id: "r1",
        report_date: "2026-03-01",
        trainer_name: "מאמן א",
        new_trainees_ids: [TRAINEE_A],
        new_trainees_details: "מתאמן חדש, צריך ליווי",
      }),
    ];
    const result = extractTraineeNotes(reports, TRAINEE_A);
    expect(result).toHaveLength(1);
    expect(result[0].notes[0].type).toBe("new_trainee");
    expect(result[0].notes[0].details).toBe("מתאמן חדש, צריך ליווי");
  });

  it("extracts social_skills note when trainee is tagged", () => {
    const reports = [
      makeReport({
        id: "r1",
        report_date: "2026-03-01",
        trainer_name: "מאמן א",
        has_social_skills: true,
        social_skills_trainee_ids: [TRAINEE_A],
        social_skills_details: "שחקן קבוצתי מעולה",
      }),
    ];
    const result = extractTraineeNotes(reports, TRAINEE_A);
    expect(result).toHaveLength(1);
    expect(result[0].notes).toHaveLength(1);
    expect(result[0].notes[0].type).toBe("social_skills");
    expect(result[0].notes[0].details).toBe("שחקן קבוצתי מעולה");
  });

  it("does not mutate the input reports array", () => {
    const reports = [
      makeReport({
        id: "r2",
        report_date: "2026-02-01",
        trainer_name: "מאמן א",
        injuries_trainee_ids: [TRAINEE_A],
        injuries_details: "a",
      }),
      makeReport({
        id: "r1",
        report_date: "2026-03-01",
        trainer_name: "מאמן ב",
        injuries_trainee_ids: [TRAINEE_A],
        injuries_details: "b",
      }),
    ];
    const reportsCopy = [...reports];
    extractTraineeNotes(reports, TRAINEE_A);
    expect(reports).toEqual(reportsCopy);
  });
});
