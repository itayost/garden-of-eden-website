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
      "new_trainees_ids, new_trainees_details, new_trainees_per_trainee, " +
      "discipline_trainee_ids, discipline_details, discipline_per_trainee, " +
      "injuries_trainee_ids, injuries_details, injuries_per_trainee, " +
      "limitations_trainee_ids, limitations_details, limitations_per_trainee, " +
      "worked_on_trainee_ids, worked_on_details, worked_on_per_trainee, " +
      "achievements_trainee_ids, achievements_details, achievements_per_trainee, " +
      "mental_state_trainee_ids, mental_state_details, mental_state_per_trainee, " +
      "complaints_trainee_ids, complaints_details, complaints_per_trainee, " +
      "insufficient_attention_trainee_ids, insufficient_attention_details, insufficient_attention_per_trainee, " +
      "pro_candidates_trainee_ids, pro_candidates_details, pro_candidates_per_trainee, " +
      "has_social_skills, social_skills_trainee_ids, social_skills_details, social_skills_per_trainee"
    )
    .or(
      `new_trainees_ids.cs.{${traineeId}},` +
      `discipline_trainee_ids.cs.{${traineeId}},` +
      `injuries_trainee_ids.cs.{${traineeId}},` +
      `limitations_trainee_ids.cs.{${traineeId}},` +
      `worked_on_trainee_ids.cs.{${traineeId}},` +
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
 * Removes the trainee ID from the category's UUID array AND removes the
 * per-trainee JSONB entry for that section.
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

  // Fetch the report for ownership check and current data.
  // The select string is dynamic; cast to string so Supabase's literal
  // inference doesn't produce a too-complex union type.
  const selectStr: string = `trainer_id, ${categoryCol.traineeIdsKey}, ${categoryCol.perTraineeKey}`;
  const { data: report, error: fetchError } = await supabase
    .from("trainer_shift_reports")
    .select(selectStr)
    .eq("id", reportId)
    .single();

  if (fetchError || !report) {
    return { error: "דוח לא נמצא" };
  }

  const reportData = report as unknown as Record<string, unknown>;

  // Permission check: trainers can only edit their own reports
  if (profile!.role !== "admin" && reportData.trainer_id !== user!.id) {
    return { error: "אין הרשאה לערוך דוח זה" };
  }

  // Remove trainee from the UUID array
  const currentIds = (reportData[categoryCol.traineeIdsKey] as string[]) ?? [];
  const updatedIds = currentIds.filter((id: string) => id !== traineeId);

  const updatePayload: Record<string, unknown> = {
    [categoryCol.traineeIdsKey]: updatedIds,
  };

  // Also remove from per-trainee JSONB (key omission, not value nulling)
  const currentPerTrainee = reportData[categoryCol.perTraineeKey] as
    | Record<string, unknown>
    | null
    | undefined;
  if (currentPerTrainee && Object.prototype.hasOwnProperty.call(currentPerTrainee, traineeId)) {
    const { [traineeId]: _removed, ...remaining } = currentPerTrainee;
    void _removed;
    updatePayload[categoryCol.perTraineeKey] = remaining;
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
 * Edit the per-trainee details for any shift-report category.
 * Updates `<section>_per_trainee[traineeId].details`, preserving any
 * existing `categories` array on the entry (relevant for achievements +
 * worked_on which support category taxonomy).
 */
export async function editTraineeNote(
  reportId: string,
  traineeId: string,
  categoryType: NoteCategoryType,
  newDetails: string,
): Promise<ActionResult> {
  if (!isValidUUID(reportId) || !isValidUUID(traineeId)) {
    return { error: "מזהה לא תקין" };
  }

  const categoryCol = CATEGORY_COLUMNS.find((c) => c.type === categoryType);
  if (!categoryCol) {
    return { error: "קטגוריה לא תקינה" };
  }

  const trimmedDetails = newDetails.trim();

  const { error: authError, user, profile } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  const supabase = await createClient();

  // Fetch the report for ownership check and current JSONB data.
  // Cast select string to plain `string` so Supabase's literal inference
  // doesn't produce a too-complex union type.
  const selectStr: string = `trainer_id, ${categoryCol.traineeIdsKey}, ${categoryCol.perTraineeKey}`;
  const { data: report, error: fetchError } = await supabase
    .from("trainer_shift_reports")
    .select(selectStr)
    .eq("id", reportId)
    .single();

  if (fetchError || !report) {
    return { error: "דוח לא נמצא" };
  }

  const reportData = report as unknown as Record<string, unknown>;

  // Permission check: trainers can only edit their own reports
  if (profile!.role !== "admin" && reportData.trainer_id !== user!.id) {
    return { error: "אין הרשאה לערוך דוח זה" };
  }

  // Validate trainee exists in the category's array (prevents JSONB injection)
  const traineeIds = (reportData[categoryCol.traineeIdsKey] as string[]) ?? [];
  if (!traineeIds.includes(traineeId)) {
    return { error: "המתאמן לא נמצא בקטגוריה זו" };
  }

  // Update the per-trainee JSONB entry, preserving categories if present
  const currentPerTrainee = (reportData[categoryCol.perTraineeKey] ?? {}) as Record<
    string,
    { details?: string; categories?: string[] }
  >;
  const existingEntry = currentPerTrainee[traineeId] ?? {};
  const updatedPerTrainee = {
    ...currentPerTrainee,
    [traineeId]: {
      ...existingEntry,
      details: trimmedDetails,
    },
  };

  const { error: updateError } = await supabase
    .from("trainer_shift_reports")
    .update({ [categoryCol.perTraineeKey]: updatedPerTrainee })
    .eq("id", reportId);

  if (updateError) {
    console.error("Error editing trainee note:", updateError);
    return { error: "שגיאה בעריכת ההערה" };
  }

  revalidatePath(`/admin/users/${traineeId}`);
  return { success: true };
}
