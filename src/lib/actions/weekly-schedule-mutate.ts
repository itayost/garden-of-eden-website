"use server";

import { verifyAdmin } from "@/lib/actions/shared";
import { revalidateScheduleSurfaces } from "@/lib/actions/shared/revalidate-schedule";
import { assertBranchWritable } from "@/lib/actions/shared/assert-branch";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import { israelToday } from "@/lib/utils/tasks";
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
 * The same lookup for a band's whole list, in the order the admin picked.
 *
 * Keeps the singular version's is_active filter: unlike a slot, a band is the
 * standing week, and putting a deactivated trainer on it going forward is a
 * mistake rather than a state to preserve.
 */
async function resolveActiveTrainerNames(
  trainerIds: readonly string[],
): Promise<{ names: { trainerId: string; name: string }[] } | { error: string }> {
  if (trainerIds.length === 0) return { names: [] };

  const { data, error } = await createAdminClient()
    .from("profiles")
    .select("id, full_name")
    .in("id", [...trainerIds])
    .in("role", ["trainer", "admin"])
    .eq("is_active", true)
    .is("deleted_at", null);

  if (error) {
    console.error("Resolve trainer names error:", error);
    return { error: "שגיאה באימות המאמן" };
  }

  const byId = new Map((data ?? []).map((row) => [row.id, row.full_name ?? "מאמן"]));
  if (trainerIds.some((id) => !byId.has(id))) {
    return { error: "אחד המאמנים שנבחרו אינו קיים או אינו פעיל" };
  }

  // The admin's order is the order on the card, so it survives the query.
  return { names: trainerIds.map((id) => ({ trainerId: id, name: byId.get(id)! })) };
}

/** The band's trainers, replaced wholesale. Same reasoning as the slot's. */
async function replaceBandTrainers(
  supabase: Awaited<ReturnType<typeof createClient>>,
  bandId: string,
  names: readonly { trainerId: string; name: string }[],
): Promise<{ error: string | null }> {
  const { error: deleteError } = await typedFrom(supabase, "weekly_schedule_band_trainers")
    .delete()
    .eq("band_id", bandId);
  if (deleteError) {
    console.error("Clear band trainers error:", deleteError);
    return { error: "שגיאה בשמירת המאמנים" };
  }

  if (names.length === 0) return { error: null };

  const { error: insertError } = await typedFrom(
    supabase,
    "weekly_schedule_band_trainers",
  ).insert(
    names.map((entry, index) => ({
      band_id: bandId,
      trainer_id: entry.trainerId,
      trainer_name: entry.name,
      order_index: index,
    })),
  );
  if (insertError) {
    console.error("Insert band trainers error:", insertError);
    return { error: "שגיאה בשמירת המאמנים" };
  }

  return { error: null };
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

  const { branchId, weekday, startTime, endTime, trainerIds, location, label, isStandby, maxTrainees, isBookable } =
    validated.data;

  const trainerResult = await resolveActiveTrainerNames(trainerIds);
  if ("error" in trainerResult) return { error: trainerResult.error };

  const branchCheck = await assertBranchWritable(branchId);
  if (branchCheck.error) return { error: branchCheck.error };

  const supabase = await createClient();

  const { data: created, error } = await typedFrom(supabase, "weekly_schedule_bands")
    .insert({
      branch_id: branchId,
      weekday,
      start_time: startTime,
      end_time: endTime,
      location_he: location,
      label_he: label,
      is_standby: isStandby,
      max_trainees: maxTrainees,
      is_bookable: isBookable,
      created_by: user!.id,
    })
    .select()
    .single();

  if (error || !created) {
    console.error("Create band error:", error);
    return { error: "שגיאה ביצירת הרצועה" };
  }

  const trainersWritten = await replaceBandTrainers(supabase, created.id, trainerResult.names);
  if (trainersWritten.error) {
    // A band whose trainers did not land would read as unstaffed on the
    // standing week, which is not the band the admin described.
    await typedFrom(supabase, "weekly_schedule_bands").delete().eq("id", created.id);
    return { error: trainersWritten.error };
  }

  revalidateScheduleSurfaces();

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

  const { branchId, bandId, weekday, startTime, endTime, trainerIds, location, label, isStandby, maxTrainees, isBookable } =
    validated.data;
  const supabase = await createClient();

  // .update().eq() on a missing row returns no error and updates nothing, so
  // without this the action would report success on a deleted band.
  const { data: existing } = await typedFrom(supabase, "weekly_schedule_bands")
    .select("id")
    .eq("id", bandId)
    .maybeSingle();

  if (!existing) return { error: "הרצועה לא נמצאה" };

  const trainerResult = await resolveActiveTrainerNames(trainerIds);
  if ("error" in trainerResult) return { error: trainerResult.error };

  const branchCheck = await assertBranchWritable(branchId);
  if (branchCheck.error) return { error: branchCheck.error };

  const { data: updated, error } = await typedFrom(supabase, "weekly_schedule_bands")
    .update({
      branch_id: branchId,
      weekday,
      start_time: startTime,
      end_time: endTime,
      location_he: location,
      label_he: label,
      is_standby: isStandby,
      max_trainees: maxTrainees,
      is_bookable: isBookable,
    })
    .eq("id", bandId)
    .select()
    .single();

  if (error || !updated) {
    console.error("Update band error:", error);
    return { error: "שגיאה בעדכון הרצועה" };
  }

  const trainersWritten = await replaceBandTrainers(supabase, bandId, trainerResult.names);
  if (trainersWritten.error) return { error: trainersWritten.error };

  // Slots already projected from this band keep their time and trainer (a
  // built day is a record), but they stop taking self-bookings the moment
  // the band is no longer bookable. Seats follow the band while it is.
  const { error: seatsError } = await typedFrom(supabase, "daily_schedule_slots")
    .update({ max_trainees: isBookable ? maxTrainees : null })
    .eq("band_id", bandId)
    .gte("schedule_date", israelToday());
  if (seatsError) console.error("Update projected seats error:", seatsError);

  revalidateScheduleSurfaces();

  return { success: true, data: updated as WeeklyBand };
}

/**
 * How many dated hours a band's deletion would take with it.
 *
 * Only the future ones. daily_schedule_slots.band_id is ON DELETE SET NULL, so
 * without this the deletion silently leaves them on the calendar as orphans and
 * "remove it from the calendar" would be a lie the admin discovers tomorrow.
 * Past hours are history and are never touched.
 */
export async function bandDeletionImpactAction(
  bandId: string,
): Promise<{ success: true; data: { futureSlots: number } } | { error: string }> {
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };

  const validated = bandIdSchema.safeParse({ bandId });
  if (!validated.success) return { error: "מזהה רצועה לא תקין" };

  const supabase = await createClient();
  const { data, error } = await typedFrom(supabase, "daily_schedule_slots")
    .select("id")
    .eq("band_id", validated.data.bandId)
    .gt("schedule_date", israelToday());

  if (error) {
    console.error("Band deletion impact error:", error);
    return { error: "שגיאה בבדיקת הרצועה" };
  }

  return { success: true, data: { futureSlots: data?.length ?? 0 } };
}

/**
 * Removes a stretch from the standing week, and with it every hour it has
 * already projected onto a future date.
 *
 * The band goes first and the slots after, deliberately. If the band delete
 * fails nothing has been removed; if the slot delete fails the band is gone and
 * the slots are orphans, which is exactly the behaviour this replaces rather
 * than something worse. The other order would delete real hours off the board
 * and then leave the band standing.
 */
export async function deleteBandAction(bandId: string): Promise<DeleteResult> {
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };

  const validated = bandIdSchema.safeParse({ bandId });
  if (!validated.success) return { error: "מזהה רצועה לא תקין" };

  const supabase = await createClient();

  // Captured before the band goes: afterwards band_id is NULL on these rows and
  // there is no way left to tell which hours came from this stretch.
  const { data: futureSlots } = (await typedFrom(supabase, "daily_schedule_slots")
    .select("id")
    .eq("band_id", validated.data.bandId)
    .gt("schedule_date", israelToday())) as { data: { id: string }[] | null };

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

  const futureIds = (futureSlots ?? []).map((slot) => slot.id);
  if (futureIds.length > 0) {
    const rpcClient = supabase as unknown as {
      rpc: (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ error: { message: string } | null }>;
    };

    // Each hour's group workout first: training_sessions.slot_id is ON DELETE
    // SET NULL, so a session fanned out from one of these would survive the
    // slot and leave a trainee with a workout for an hour that no longer
    // exists. Same reasoning as deleteSlotAction.
    for (const id of futureIds) {
      const { error: clearError } = await rpcClient.rpc("clear_slot_workout", {
        p_slot_id: id,
      });
      if (clearError) console.error("clear_slot_workout failed:", clearError);
    }

    const { error: slotsError } = await typedFrom(supabase, "daily_schedule_slots")
      .delete()
      .in("id", futureIds);
    // The band is already gone, so the admin's intent stands either way. A
    // failure here leaves orphaned hours, which is what used to happen anyway.
    if (slotsError) console.error("Delete band future slots error:", slotsError);
  }

  revalidateScheduleSurfaces();

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

  const { branchId, exceptionDate, trainerId, kind, startTime, endTime, location, label, note } =
    validated.data;

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

  revalidateScheduleSurfaces();

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

  revalidateScheduleSurfaces();

  return { success: true };
}
