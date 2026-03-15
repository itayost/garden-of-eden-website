import type { TrainerShiftReport } from "@/types/database";

/** Subset of TrainerShiftReport fields actually used by extractTraineeNotes */
export type ShiftReportForNotes = Pick<
  TrainerShiftReport,
  | "id"
  | "trainer_id"
  | "report_date"
  | "trainer_name"
  | "new_trainees_ids"
  | "new_trainees_details"
  | "discipline_trainee_ids"
  | "discipline_details"
  | "injuries_trainee_ids"
  | "injuries_details"
  | "limitations_trainee_ids"
  | "limitations_details"
  | "achievements_trainee_ids"
  | "achievements_details"
  | "achievements_per_trainee"
  | "mental_state_trainee_ids"
  | "mental_state_details"
  | "complaints_trainee_ids"
  | "complaints_details"
  | "insufficient_attention_trainee_ids"
  | "insufficient_attention_details"
  | "pro_candidates_trainee_ids"
  | "pro_candidates_details"
  | "has_social_skills"
  | "social_skills_trainee_ids"
  | "social_skills_details"
>;

/** Note category types that link trainees via UUID arrays */
export type NoteCategoryType =
  | "new_trainee"
  | "discipline"
  | "injuries"
  | "limitations"
  | "achievements"
  | "mental_state"
  | "complaints"
  | "insufficient_attention"
  | "pro_candidates"
  | "social_skills";

/** Hebrew labels for each category */
export const NOTE_CATEGORY_LABELS: Record<NoteCategoryType, string> = {
  new_trainee: "מתאמן חדש",
  discipline: "משמעת",
  injuries: "פציעות",
  limitations: "מגבלות",
  achievements: "הישגים",
  mental_state: "מצב נפשי",
  complaints: "תלונות",
  insufficient_attention: "חוסר תשומת לב",
  pro_candidates: "מועמד למקצוענות",
  social_skills: "כישורים חברתיים",
};

/** Visual variant for each category */
export const NOTE_CATEGORY_VARIANT: Record<NoteCategoryType, "destructive" | "warning" | "success" | "info" | "default"> = {
  new_trainee: "info",
  discipline: "warning",
  injuries: "destructive",
  limitations: "warning",
  achievements: "success",
  mental_state: "destructive",
  complaints: "warning",
  insufficient_attention: "warning",
  pro_candidates: "success",
  social_skills: "info",
};

/** A single note extracted for a trainee from a shift report */
export interface TraineeNote {
  readonly type: NoteCategoryType;
  readonly label: string;
  readonly details: string | null;
  /** Only for achievements — the specific categories selected */
  readonly achievementCategories?: readonly string[];
}

/** A shift report entry with only the notes relevant to a specific trainee */
export interface TraineeReportNotes {
  readonly reportId: string;
  readonly reportDate: string;
  readonly trainerName: string;
  readonly trainerId: string;
  readonly notes: readonly TraineeNote[];
}

/** Mapping from category type to the trainee IDs array column and details column */
export const CATEGORY_COLUMNS: ReadonlyArray<{
  type: NoteCategoryType;
  traineeIdsKey: keyof ShiftReportForNotes;
  detailsKey: keyof ShiftReportForNotes;
}> = [
  { type: "new_trainee", traineeIdsKey: "new_trainees_ids", detailsKey: "new_trainees_details" },
  { type: "discipline", traineeIdsKey: "discipline_trainee_ids", detailsKey: "discipline_details" },
  { type: "injuries", traineeIdsKey: "injuries_trainee_ids", detailsKey: "injuries_details" },
  { type: "limitations", traineeIdsKey: "limitations_trainee_ids", detailsKey: "limitations_details" },
  { type: "achievements", traineeIdsKey: "achievements_trainee_ids", detailsKey: "achievements_details" },
  { type: "mental_state", traineeIdsKey: "mental_state_trainee_ids", detailsKey: "mental_state_details" },
  { type: "complaints", traineeIdsKey: "complaints_trainee_ids", detailsKey: "complaints_details" },
  { type: "insufficient_attention", traineeIdsKey: "insufficient_attention_trainee_ids", detailsKey: "insufficient_attention_details" },
  { type: "pro_candidates", traineeIdsKey: "pro_candidates_trainee_ids", detailsKey: "pro_candidates_details" },
  { type: "social_skills", traineeIdsKey: "social_skills_trainee_ids", detailsKey: "social_skills_details" },
];

/**
 * Extract notes relevant to a specific trainee from a list of shift reports.
 * Returns reports sorted by date descending, only including reports that mention
 * the trainee in at least one category.
 */
export function extractTraineeNotes(
  reports: readonly ShiftReportForNotes[],
  traineeId: string,
): readonly TraineeReportNotes[] {
  const results: TraineeReportNotes[] = [];

  for (const report of reports) {
    const notes: TraineeNote[] = [];

    for (const col of CATEGORY_COLUMNS) {
      const traineeIds = report[col.traineeIdsKey] as string[] | undefined;
      if (!traineeIds || !traineeIds.includes(traineeId)) continue;

      if (col.type === "achievements") {
        const perTrainee = report.achievements_per_trainee;
        const entry = perTrainee?.[traineeId];
        notes.push({
          type: "achievements",
          label: NOTE_CATEGORY_LABELS.achievements,
          details: entry?.details ?? (report[col.detailsKey] as string | null),
          achievementCategories: entry?.categories ?? [],
        });
      } else {
        notes.push({
          type: col.type,
          label: NOTE_CATEGORY_LABELS[col.type],
          details: report[col.detailsKey] as string | null,
        });
      }
    }

    if (notes.length > 0) {
      results.push({
        reportId: report.id,
        reportDate: report.report_date,
        trainerName: report.trainer_name,
        trainerId: report.trainer_id,
        notes,
      });
    }
  }

  return results.sort(
    (a, b) => new Date(b.reportDate).getTime() - new Date(a.reportDate).getTime(),
  );
}
