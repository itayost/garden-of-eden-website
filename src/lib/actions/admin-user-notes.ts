"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { isValidUUID } from "@/lib/validations/common";
import {
  extractTraineeNotes,
  CATEGORY_COLUMNS,
  type TraineeReportNotes,
  type ShiftReportForNotes,
  type NoteCategoryType,
} from "@/lib/utils/trainee-notes";

type ActionResult =
  | { error: string; success?: never }
  | { success: true; error?: never };

/**
 * Fetch all shift report notes relevant to a specific trainee.
 * Queries reports where the trainee ID appears in any trainee ID array,
 * then extracts only the categories mentioning this trainee.
 */
export async function getTraineeNotes(
  traineeId: string,
): Promise<{ error: string | null; data: readonly TraineeReportNotes[] }> {
  if (!isValidUUID(traineeId)) {
    return { error: "מזהה משתמש לא תקין", data: [] };
  }

  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) {
    return { error: authError, data: [] };
  }

  const supabase = await createClient();

  // Query reports where the trainee appears in any of the trainee ID arrays.
  // Supabase's .or() with .cs() (contains) checks UUID[] columns.
  const { data: reports, error: dbError } = await supabase
    .from("trainer_shift_reports")
    .select(
      "id, trainer_id, trainer_name, report_date, " +
      "new_trainees_ids, new_trainees_details, " +
      "discipline_trainee_ids, discipline_details, " +
      "injuries_trainee_ids, injuries_details, " +
      "limitations_trainee_ids, limitations_details, " +
      "achievements_trainee_ids, achievements_details, achievements_per_trainee, " +
      "mental_state_trainee_ids, mental_state_details, " +
      "complaints_trainee_ids, complaints_details, " +
      "insufficient_attention_trainee_ids, insufficient_attention_details, " +
      "pro_candidates_trainee_ids, pro_candidates_details, " +
      "social_skills_trainee_ids, social_skills_details"
    )
    .or(
      `new_trainees_ids.cs.{${traineeId}},` +
      `discipline_trainee_ids.cs.{${traineeId}},` +
      `injuries_trainee_ids.cs.{${traineeId}},` +
      `limitations_trainee_ids.cs.{${traineeId}},` +
      `achievements_trainee_ids.cs.{${traineeId}},` +
      `mental_state_trainee_ids.cs.{${traineeId}},` +
      `complaints_trainee_ids.cs.{${traineeId}},` +
      `insufficient_attention_trainee_ids.cs.{${traineeId}},` +
      `pro_candidates_trainee_ids.cs.{${traineeId}},` +
      `social_skills_trainee_ids.cs.{${traineeId}}`
    )
    .order("report_date", { ascending: false });

  if (dbError) {
    console.error("Error fetching trainee notes:", dbError);
    return { error: "שגיאה בטעינת הערות", data: [] };
  }

  // The Supabase select returns a partial type that structurally matches ShiftReportForNotes
  const notes = extractTraineeNotes(
    (reports ?? []) as unknown as ShiftReportForNotes[],
    traineeId,
  );

  return { error: null, data: notes };
}

/**
 * Delete a trainee from a specific note category in a shift report.
 * Removes the trainee ID from the category's UUID array.
 * For achievements, also removes the per-trainee JSONB entry.
 */
export async function deleteTraineeNote(
  reportId: string,
  traineeId: string,
  categoryType: NoteCategoryType,
): Promise<ActionResult> {
  if (!isValidUUID(reportId) || !isValidUUID(traineeId)) {
    return { error: "מזהה לא תקין" };
  }

  const categoryCol = CATEGORY_COLUMNS.find((c) => c.type === categoryType);
  if (!categoryCol) {
    return { error: "קטגוריה לא תקינה" };
  }

  const { error: authError, user, profile } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  const supabase = await createClient();

  // Fetch the report for ownership check and current data
  const { data: report, error: fetchError } = await supabase
    .from("trainer_shift_reports")
    .select("trainer_id, " + categoryCol.traineeIdsKey + ", achievements_per_trainee")
    .eq("id", reportId)
    .single();

  if (fetchError || !report) {
    return { error: "דוח לא נמצא" };
  }

  // Cast to Record for dynamic key access (Supabase returns unknown shape for dynamic selects)
  const reportData = report as unknown as Record<string, unknown>;

  // Permission check: trainers can only edit their own reports
  if (profile!.role !== "admin" && reportData.trainer_id !== user!.id) {
    return { error: "אין הרשאה לערוך דוח זה" };
  }

  // Remove trainee from the UUID array
  const currentIds = (reportData[categoryCol.traineeIdsKey] as string[]) ?? [];
  const updatedIds = currentIds.filter((id: string) => id !== traineeId);

  // Build update payload
  const updatePayload: Record<string, unknown> = {
    [categoryCol.traineeIdsKey]: updatedIds,
  };

  // For achievements: also remove from per-trainee JSONB
  if (categoryType === "achievements" && reportData.achievements_per_trainee) {
    const { [traineeId]: _removed, ...remaining } = reportData.achievements_per_trainee as Record<
      string,
      { details?: string; categories: string[] }
    >;
    updatePayload.achievements_per_trainee = remaining;
  }

  const { error: updateError } = await supabase
    .from("trainer_shift_reports")
    .update(updatePayload)
    .eq("id", reportId);

  if (updateError) {
    console.error("Error deleting trainee note:", updateError);
    return { error: "שגיאה במחיקת ההערה" };
  }

  revalidatePath(`/admin/users/${traineeId}`);
  return { success: true };
}

/**
 * Edit the per-trainee details for an achievements note.
 * Only works for the achievements category (which has per-trainee JSONB).
 */
export async function editTraineeNote(
  reportId: string,
  traineeId: string,
  newDetails: string,
): Promise<ActionResult> {
  if (!isValidUUID(reportId) || !isValidUUID(traineeId)) {
    return { error: "מזהה לא תקין" };
  }

  const trimmedDetails = newDetails.trim();

  const { error: authError, user, profile } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  const supabase = await createClient();

  // Fetch the report for ownership check and current JSONB data
  const { data: report, error: fetchError } = await supabase
    .from("trainer_shift_reports")
    .select("trainer_id, achievements_trainee_ids, achievements_per_trainee")
    .eq("id", reportId)
    .single();

  if (fetchError || !report) {
    return { error: "דוח לא נמצא" };
  }

  // Permission check: trainers can only edit their own reports
  if (profile!.role !== "admin" && report.trainer_id !== user!.id) {
    return { error: "אין הרשאה לערוך דוח זה" };
  }

  // Validate trainee exists in achievements array (prevents JSONB injection)
  const achievementIds = (report.achievements_trainee_ids as string[]) ?? [];
  if (!achievementIds.includes(traineeId)) {
    return { error: "המתאמן לא נמצא בקטגוריית הישגים" };
  }

  // Update the per-trainee JSONB entry, preserving categories
  const currentPerTrainee = (report.achievements_per_trainee ?? {}) as Record<
    string,
    { details?: string; categories: string[] }
  >;
  const existingEntry = currentPerTrainee[traineeId] ?? { categories: [] };
  const updatedPerTrainee = {
    ...currentPerTrainee,
    [traineeId]: {
      ...existingEntry,
      details: trimmedDetails,
    },
  };

  const { error: updateError } = await supabase
    .from("trainer_shift_reports")
    .update({ achievements_per_trainee: updatedPerTrainee })
    .eq("id", reportId);

  if (updateError) {
    console.error("Error editing trainee note:", updateError);
    return { error: "שגיאה בעריכת ההערה" };
  }

  revalidatePath(`/admin/users/${traineeId}`);
  return { success: true };
}
