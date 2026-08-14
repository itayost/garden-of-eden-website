"use server";

import { revalidatePath } from "next/cache";

import { verifyAdmin } from "@/lib/actions/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import {
  bandIdSchema,
  bandSchema,
  bandUpdateSchema,
  exceptionIdSchema,
  exceptionSchema,
  type BandInput,
  type BandUpdateInput,
  type ExceptionInput,
} from "@/lib/validations/weekly-schedule";
import type { WeeklyBand, WeeklyException } from "@/types/weekly-schedule";

type BandResult =
  | { success: true; data: WeeklyBand }
  | { error: string; fieldErrors?: Record<string, string[]> };

type ExceptionResult =
  | { success: true; data: WeeklyException }
  | { error: string; fieldErrors?: Record<string, string[]> };

type DeleteResult = { success: true } | { error: string };

/**
 * Both surfaces read this data: the weekly editor owns it, and the daily board
 * derives its on-duty strip from it.
 */
function revalidateWeeklySchedule() {
  revalidatePath("/admin/weekly-schedule");
  revalidatePath("/admin/schedule");
}

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

export async function createBandAction(input: BandInput): Promise<BandResult> {
  const { error: authError, user } = await verifyAdmin();
  if (authError) return { error: authError };

  const validated = bandSchema.safeParse(input);
  if (!validated.success) {
    return {
      error: "אימות נתונים נכשל",
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { weekday, startTime, endTime, trainerId, location, label, isStandby } =
    validated.data;

  const trainerResult = await resolveActiveTrainerName(trainerId);
  if ("error" in trainerResult) return { error: trainerResult.error };

  const supabase = await createClient();

  const { data: created, error } = await typedFrom(supabase, "weekly_schedule_bands")
    .insert({
      weekday,
      start_time: startTime,
      end_time: endTime,
      trainer_id: trainerId,
      trainer_name: trainerResult.name,
      location_he: location,
      label_he: label,
      is_standby: isStandby,
      created_by: user!.id,
    })
    .select()
    .single();

  if (error || !created) {
    console.error("Create band error:", error);
    return { error: "שגיאה ביצירת הרצועה" };
  }

  revalidateWeeklySchedule();

  return { success: true, data: created as WeeklyBand };
}

export async function updateBandAction(
  input: BandUpdateInput,
): Promise<BandResult> {
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };

  const validated = bandUpdateSchema.safeParse(input);
  if (!validated.success) {
    return {
      error: "אימות נתונים נכשל",
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { bandId, weekday, startTime, endTime, trainerId, location, label, isStandby } =
    validated.data;
  const supabase = await createClient();

  // .update().eq() on a missing row returns no error and updates nothing, so
  // without this the action would report success on a deleted band.
  const { data: existing } = await typedFrom(supabase, "weekly_schedule_bands")
    .select("id")
    .eq("id", bandId)
    .maybeSingle();

  if (!existing) return { error: "הרצועה לא נמצאה" };

  const trainerResult = await resolveActiveTrainerName(trainerId);
  if ("error" in trainerResult) return { error: trainerResult.error };

  const { data: updated, error } = await typedFrom(supabase, "weekly_schedule_bands")
    .update({
      weekday,
      start_time: startTime,
      end_time: endTime,
      trainer_id: trainerId,
      trainer_name: trainerResult.name,
      location_he: location,
      label_he: label,
      is_standby: isStandby,
    })
    .eq("id", bandId)
    .select()
    .single();

  if (error || !updated) {
    console.error("Update band error:", error);
    return { error: "שגיאה בעדכון הרצועה" };
  }

  revalidateWeeklySchedule();

  return { success: true, data: updated as WeeklyBand };
}

export async function deleteBandAction(bandId: string): Promise<DeleteResult> {
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };

  const validated = bandIdSchema.safeParse({ bandId });
  if (!validated.success) return { error: "מזהה רצועה לא תקין" };

  const supabase = await createClient();

  // The .select() is not decoration: a delete that RLS rejects returns no error
  // and zero rows, which would otherwise be reported as a successful deletion.
  const { data: deleted, error } = await typedFrom(supabase, "weekly_schedule_bands")
    .delete()
    .eq("id", validated.data.bandId)
    .select("id");

  if (error) {
    console.error("Delete band error:", error);
    return { error: "שגיאה במחיקת הרצועה" };
  }

  if ((deleted?.length ?? 0) === 0) return { error: "הרצועה לא נמצאה" };

  revalidateWeeklySchedule();

  return { success: true };
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

  const { exceptionDate, trainerId, kind, startTime, endTime, location, label, note } =
    validated.data;

  const trainerResult = await resolveActiveTrainerName(trainerId);
  if ("error" in trainerResult) return { error: trainerResult.error };

  const supabase = await createClient();

  const { data: created, error } = await typedFrom(
    supabase,
    "weekly_schedule_exceptions",
  )
    .insert({
      exception_date: exceptionDate,
      trainer_id: trainerId,
      trainer_name: trainerResult.name,
      kind,
      start_time: startTime,
      end_time: endTime,
      location_he: location,
      label_he: label,
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

  revalidateWeeklySchedule();

  return { success: true, data: created as WeeklyException };
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

  revalidateWeeklySchedule();

  return { success: true };
}
