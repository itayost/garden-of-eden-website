"use server";

import { createClient } from "@/lib/supabase/server";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { isValidUUID } from "@/lib/validations/common";
import { extractTraineeNotes, type TraineeReportNotes, type ShiftReportForNotes } from "@/lib/utils/trainee-notes";

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
      "pro_candidates_trainee_ids, pro_candidates_details"
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
      `pro_candidates_trainee_ids.cs.{${traineeId}}`
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
