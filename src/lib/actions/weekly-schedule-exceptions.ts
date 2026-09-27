"use server";

import { verifyAdmin } from "@/lib/actions/shared";
import { revalidateScheduleSurfaces } from "@/lib/actions/shared/revalidate-schedule";
import { assertBranchWritable } from "@/lib/actions/shared/assert-branch";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import {
  exceptionIdSchema,
  exceptionSchema,
  exceptionUpdateSchema,
  type ExceptionInput,
  type ExceptionUpdateInput,
} from "@/lib/validations/weekly-schedule";
import type { WeeklyException } from "@/types/weekly-schedule";

type ExceptionResult =
  | { success: true; data: WeeklyException }
  | { error: string; fieldErrors?: Record<string, string[]> };

type DeleteResult = { success: true } | { error: string };

/**
 * Resolves the trainer's display-name snapshot.
 *
 * Admin client for the same reason as resolveTrainerName in
 * daily-schedule-mutate.ts: the profiles SELECT policies let a trainer read
 * only their own row and active trainer rows, so an admin-who-coaches would
 * otherwise fail this check. Safe because every caller is gated on
 * verifyAdmin() and this reads one name.
 *
 * Unlike the slot version this DOES require is_active. A band is standing
 * staffing, not a historical record: scheduling someone who has been
 * deactivated is a mistake worth blocking, whereas a slot already carrying a
 * since-deactivated trainer must stay editable.
 */
async function resolveActiveTrainerName(
  trainerId: string,
): Promise<{ name: string } | { error: string }> {
  const { data, error } = await createAdminClient()
    .from("profiles")
    .select("full_name")
    .eq("id", trainerId)
    .in("role", ["trainer", "admin"])
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();

  // A query failure is not "trainer does not exist" — reporting it as such
  // would send the admin investigating a healthy trainer account.
  if (error) {
    console.error("Resolve trainer name error:", error);
    return { error: "שגיאה באימות המאמן" };
  }

  if (!data) return { error: "המאמן שנבחר אינו קיים או אינו פעיל" };
  return { name: data.full_name ?? "מאמן" };
}

/**
 * Records a dated deviation. Exceptions never edit the standing week, so next
 * week is unaffected — that is the whole point of keeping them in their own
 * table rather than mutating the band.
 */
export async function createExceptionAction(
  input: ExceptionInput,
): Promise<ExceptionResult> {
  const { error: authError, user } = await verifyAdmin();
  if (authError) return { error: authError };

  const validated = exceptionSchema.safeParse(input);
  if (!validated.success) {
    return {
      error: "אימות נתונים נכשל",
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { branchId, exceptionDate, trainerId, kind, note } = validated.data;

  const trainerResult = await resolveActiveTrainerName(trainerId);
  if ("error" in trainerResult) return { error: trainerResult.error };

  const branchCheck = await assertBranchWritable(branchId);
  if (branchCheck.error) return { error: branchCheck.error };

  const supabase = await createClient();

  const { data: created, error } = await typedFrom(
    supabase,
    "weekly_schedule_exceptions",
  )
    .insert({
      branch_id: branchId,
      exception_date: exceptionDate,
      trainer_id: trainerId,
      trainer_name: trainerResult.name,
      kind,
      note_he: note,
      created_by: user!.id,
    })
    .select()
    .single();

  if (error || !created) {
    console.error("Create exception error:", error);
    // The partial unique index allows one absence per trainer per date; a
    // second one is a duplicate click, not a system fault.
    if (error?.code === "23505") {
      return { error: "כבר קיימת היעדרות למאמן זה בתאריך הזה" };
    }
    return { error: "שגיאה ביצירת החריגה" };
  }

  revalidateScheduleSurfaces();

  return { success: true, data: created as WeeklyException };
}

/**
 * Corrects an absence from where it is shown in the calendar: a different
 * trainer, date or note. Same rules as creating one; only absences exist.
 */
export async function updateExceptionAction(
  input: ExceptionUpdateInput,
): Promise<ExceptionResult> {
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };

  const validated = exceptionUpdateSchema.safeParse(input);
  if (!validated.success) {
    return {
      error: "אימות נתונים נכשל",
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { exceptionId, branchId, exceptionDate, trainerId, note } = validated.data;

  const trainerResult = await resolveActiveTrainerName(trainerId);
  if ("error" in trainerResult) return { error: trainerResult.error };

  const branchCheck = await assertBranchWritable(branchId);
  if (branchCheck.error) return { error: branchCheck.error };

  const supabase = await createClient();

  // .update().eq() on a missing row returns no error; the .select() below
  // turns "nothing matched" into a real answer.
  const { data: updated, error } = await typedFrom(supabase, "weekly_schedule_exceptions")
    .update({
      exception_date: exceptionDate,
      trainer_id: trainerId,
      trainer_name: trainerResult.name,
      note_he: note,
    })
    .eq("id", exceptionId)
    .eq("kind", "absent")
    .select()
    .maybeSingle();

  if (error) {
    console.error("Update exception error:", error);
    if (error.code === "23505") {
      return { error: "כבר קיימת היעדרות למאמן זה בתאריך הזה" };
    }
    return { error: "שגיאה בעדכון ההיעדרות" };
  }
  if (!updated) return { error: "ההיעדרות לא נמצאה" };

  revalidateScheduleSurfaces();

  return { success: true, data: updated as WeeklyException };
}

export async function deleteExceptionAction(
  exceptionId: string,
): Promise<DeleteResult> {
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };

  const validated = exceptionIdSchema.safeParse({ exceptionId });
  if (!validated.success) return { error: "מזהה חריגה לא תקין" };

  const supabase = await createClient();

  const { data: deleted, error } = await typedFrom(
    supabase,
    "weekly_schedule_exceptions",
  )
    .delete()
    .eq("id", validated.data.exceptionId)
    .select("id");

  if (error) {
    console.error("Delete exception error:", error);
    return { error: "שגיאה במחיקת החריגה" };
  }

  if ((deleted?.length ?? 0) === 0) return { error: "החריגה לא נמצאה" };

  revalidateScheduleSurfaces();

  return { success: true };
}
