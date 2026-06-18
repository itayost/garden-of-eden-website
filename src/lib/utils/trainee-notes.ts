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
  | "new_trainees_per_trainee"
  | "discipline_trainee_ids"
  | "discipline_details"
  | "discipline_per_trainee"
  | "injuries_trainee_ids"
  | "injuries_details"
  | "injuries_per_trainee"
  | "limitations_trainee_ids"
  | "limitations_details"
  | "limitations_per_trainee"
  | "worked_on_trainee_ids"
  | "worked_on_details"
  | "worked_on_per_trainee"
  | "achievements_trainee_ids"
  | "achievements_details"
  | "achievements_per_trainee"
  | "mental_state_trainee_ids"
  | "mental_state_details"
  | "mental_state_per_trainee"
  | "complaints_trainee_ids"
  | "complaints_details"
  | "complaints_per_trainee"
  | "insufficient_attention_trainee_ids"
  | "insufficient_attention_details"
  | "insufficient_attention_per_trainee"
  | "pro_candidates_trainee_ids"
  | "pro_candidates_details"
  | "pro_candidates_per_trainee"
  | "has_social_skills"
  | "social_skills_trainee_ids"
  | "social_skills_details"
  | "social_skills_per_trainee"
  | "homework_trainee_ids"
  | "homework_details"
  | "homework_per_trainee"
  | "video_feedback_trainee_ids"
  | "video_feedback_details"
  | "video_feedback_per_trainee"
  | "praise_trainee_ids"
  | "praise_details"
  | "praise_per_trainee"
>;

/** Note category types that link trainees via UUID arrays + per-trainee JSONB */
export type NoteCategoryType =
  | "new_trainee"
  | "discipline"
  | "injuries"
  | "limitations"
  | "worked_on"
  | "achievements"
  | "mental_state"
  | "complaints"
  | "insufficient_attention"
  | "pro_candidates"
  | "social_skills"
  | "homework"
  | "video_feedback"
  | "praise";

/** Hebrew labels for each category */
export const NOTE_CATEGORY_LABELS: Record<NoteCategoryType, string> = {
  new_trainee: "מתאמן חדש",
  discipline: "משמעת",
  injuries: "פציעות",
  limitations: "מגבלות",
  worked_on: "עבודה ממוקדת",
  achievements: "הישגים",
  mental_state: "מצב נפשי",
  complaints: "תלונות",
  insufficient_attention: "חוסר תשומת לב",
  pro_candidates: "מועמד למקצוענות",
  social_skills: "כישורים חברתיים",
  homework: "שיעורי בית",
  video_feedback: "פידבק וידאו להורים",
  praise: "פרגון",
};

/** Visual variant for each category */
export const NOTE_CATEGORY_VARIANT: Record<NoteCategoryType, "destructive" | "warning" | "success" | "info" | "default"> = {
  new_trainee: "info",
  discipline: "warning",
  injuries: "destructive",
  limitations: "warning",
  worked_on: "info",
  achievements: "success",
  mental_state: "destructive",
  complaints: "warning",
  insufficient_attention: "warning",
  pro_candidates: "success",
  social_skills: "info",
  homework: "info",
  video_feedback: "success",
  praise: "success",
};

/** A single note extracted for a trainee from a shift report */
export interface TraineeNote {
  readonly type: NoteCategoryType;
  readonly label: string;
  readonly details: string | null;
  /** Only for sections with a category taxonomy (achievements, worked_on) */
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

/** Mapping from category type to legacy + per-trainee JSONB columns */
export const CATEGORY_COLUMNS: ReadonlyArray<{
  type: NoteCategoryType;
  traineeIdsKey: keyof ShiftReportForNotes;
  detailsKey: keyof ShiftReportForNotes;
  perTraineeKey: keyof ShiftReportForNotes;
  hasCategories: boolean;
}> = [
  { type: "new_trainee", traineeIdsKey: "new_trainees_ids", detailsKey: "new_trainees_details", perTraineeKey: "new_trainees_per_trainee", hasCategories: false },
  { type: "discipline", traineeIdsKey: "discipline_trainee_ids", detailsKey: "discipline_details", perTraineeKey: "discipline_per_trainee", hasCategories: false },
  { type: "injuries", traineeIdsKey: "injuries_trainee_ids", detailsKey: "injuries_details", perTraineeKey: "injuries_per_trainee", hasCategories: false },
  { type: "limitations", traineeIdsKey: "limitations_trainee_ids", detailsKey: "limitations_details", perTraineeKey: "limitations_per_trainee", hasCategories: false },
  { type: "worked_on", traineeIdsKey: "worked_on_trainee_ids", detailsKey: "worked_on_details", perTraineeKey: "worked_on_per_trainee", hasCategories: true },
  { type: "achievements", traineeIdsKey: "achievements_trainee_ids", detailsKey: "achievements_details", perTraineeKey: "achievements_per_trainee", hasCategories: true },
  { type: "mental_state", traineeIdsKey: "mental_state_trainee_ids", detailsKey: "mental_state_details", perTraineeKey: "mental_state_per_trainee", hasCategories: false },
  { type: "complaints", traineeIdsKey: "complaints_trainee_ids", detailsKey: "complaints_details", perTraineeKey: "complaints_per_trainee", hasCategories: false },
  { type: "insufficient_attention", traineeIdsKey: "insufficient_attention_trainee_ids", detailsKey: "insufficient_attention_details", perTraineeKey: "insufficient_attention_per_trainee", hasCategories: false },
  { type: "pro_candidates", traineeIdsKey: "pro_candidates_trainee_ids", detailsKey: "pro_candidates_details", perTraineeKey: "pro_candidates_per_trainee", hasCategories: false },
  { type: "social_skills", traineeIdsKey: "social_skills_trainee_ids", detailsKey: "social_skills_details", perTraineeKey: "social_skills_per_trainee", hasCategories: false },
  { type: "homework", traineeIdsKey: "homework_trainee_ids", detailsKey: "homework_details", perTraineeKey: "homework_per_trainee", hasCategories: false },
  { type: "video_feedback", traineeIdsKey: "video_feedback_trainee_ids", detailsKey: "video_feedback_details", perTraineeKey: "video_feedback_per_trainee", hasCategories: false },
  { type: "praise", traineeIdsKey: "praise_trainee_ids", detailsKey: "praise_details", perTraineeKey: "praise_per_trainee", hasCategories: false },
];

type PerTraineeJsonb = Record<string, { details?: string; categories?: string[] }> | null | undefined;

/**
 * Extract notes relevant to a specific trainee from a list of shift reports.
 * For each category, prefers per-trainee JSONB details and falls back to the
 * legacy shared text column for older reports. Returns reports sorted by date
 * descending, only including reports that mention the trainee in at least one
 * category.
 */
export function extractTraineeNotes(
  reports: readonly ShiftReportForNotes[],
  traineeId: string,
): readonly TraineeReportNotes[] {
  const results: TraineeReportNotes[] = [];

  for (const report of reports) {
    const notes: TraineeNote[] = [];

    for (const col of CATEGORY_COLUMNS) {
      const ids = report[col.traineeIdsKey] as string[] | null | undefined;
      const perTrainee = report[col.perTraineeKey] as PerTraineeJsonb;

      const inIds = !!ids && ids.includes(traineeId);
      const inJsonb = !!perTrainee && Object.prototype.hasOwnProperty.call(perTrainee, traineeId);
      if (!inIds && !inJsonb) continue;

      const entry = perTrainee?.[traineeId];
      const details =
        entry?.details && entry.details.trim() !== ""
          ? entry.details
          : ((report[col.detailsKey] as string | null | undefined) ?? null);

      notes.push({
        type: col.type,
        label: NOTE_CATEGORY_LABELS[col.type],
        details,
        achievementCategories: col.hasCategories ? entry?.categories ?? [] : undefined,
      });
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
