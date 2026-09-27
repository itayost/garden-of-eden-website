"use server";

import { verifyAdmin } from "@/lib/actions/shared";
import { materializeBookableSlots } from "@/features/booking/lib/materialize";
import { clearSlotWorkout } from "@/lib/actions/shared/clear-slot-workout";
import { revalidateScheduleSurfaces } from "@/lib/actions/shared/revalidate-schedule";
import { assertBranchWritable } from "@/lib/actions/shared/assert-branch";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import { bandSlotSyncs, type BandCopy } from "@/lib/schedule/band-slot-sync";
import { partitionMovedBandSlots } from "@/lib/schedule/moved-band-slots";
import { getIsraelTime } from "@/lib/utils/israel-time";
import { israelToday } from "@/lib/utils/tasks";
import {
  bandIdSchema,
  bandSchema,
  bandUpdateSchema,
  type BandInput,
  type BandUpdateInput,
} from "@/lib/validations/weekly-schedule";
import type { WeeklyBand } from "@/types/weekly-schedule";

type BandResult =
  | { success: true; data: WeeklyBand }
  | { error: string; fieldErrors?: Record<string, string[]> };

type DeleteResult = { success: true } | { error: string };

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

/**
 * Projects the branch's bookable hours into the calendar now, rather than at
 * the nightly run, so a new or edited hour shows up as soon as it is saved.
 * Service role, like the cron: slot tables are staff-only under RLS and the
 * projection writes on the band author's behalf. Best-effort: the band is
 * saved either way, and the nightly run fills in whatever this misses.
 */
async function projectBranchNow(branchId: string): Promise<void> {
  try {
    const { error } = await materializeBookableSlots(createAdminClient(), branchId, israelToday());
    if (error) console.error("Project after band save error:", error);
  } catch (error) {
    console.error("Project after band save error:", error);
  }
}

/**
 * A band moved to another weekday or branch leaves its future days on the old
 * one, still bookable. Bookings close first, so none can land mid-way and be
 * deleted with its day. Then days nobody is on and nothing was prepared for
 * are deleted, as a deleted band's are; the rest (someone on them, or a group
 * workout written) are kept, detached from the band. A day whose workout
 * cannot be cleared is detached rather than deleted, so its sessions are not
 * orphaned. Best-effort: the move is saved either way.
 */
async function releaseOldDaySlots(
  supabase: Awaited<ReturnType<typeof createClient>>,
  bandId: string,
): Promise<void> {
  const future = await futureBandSlotIds(supabase, bandId);
  if ("error" in future || future.ids.length === 0) return;

  // book_slot locks the slot row and refuses one with no seats.
  const { error: closeError } = await typedFrom(supabase, "daily_schedule_slots")
    .update({ max_trainees: null })
    .in("id", future.ids);
  if (closeError) {
    console.error("Moved band close bookings error:", closeError);
    return;
  }

  const [slotsRead, rosterRead] = await Promise.all([
    typedFrom(supabase, "daily_schedule_slots").select("id, workout_updated_at").in("id", future.ids),
    typedFrom(supabase, "daily_schedule_slot_trainees")
      .select("slot_id, cancelled_at, late_cancel")
      .in("slot_id", future.ids),
  ]);
  if (slotsRead.error || rosterRead.error) {
    console.error("Moved band read error:", slotsRead.error ?? rosterRead.error);
    return;
  }
  const { deleteIds, detachIds } = partitionMovedBandSlots(
    ((slotsRead.data ?? []) as { id: string; workout_updated_at: string | null }[]).map((slot) => ({
      id: slot.id,
      hasWorkout: slot.workout_updated_at !== null,
    })),
    (rosterRead.data ?? []) as { slot_id: string; cancelled_at: string | null; late_cancel: boolean }[],
  );

  const cleared = await Promise.all(
    deleteIds.map(async (id) => ({ id, ok: (await clearSlotWorkout(supabase, id)).error === null })),
  );
  const deletable = cleared.filter((c) => c.ok).map((c) => c.id);
  const keep = [...detachIds, ...cleared.filter((c) => !c.ok).map((c) => c.id)];

  if (deletable.length > 0) {
    const { error: deleteError } = await typedFrom(supabase, "daily_schedule_slots").delete().in("id", deletable);
    if (deleteError) console.error("Moved band old-day delete error:", deleteError);
  }
  if (keep.length > 0) {
    const { error: detachError } = await typedFrom(supabase, "daily_schedule_slots")
      .update({ band_id: null })
      .in("id", keep);
    if (detachError) console.error("Moved band old-day detach error:", detachError);
  }
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

  if (isBookable) await projectBranchNow(branchId);

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
  // The band's copied fields as they were, so projected hours that still show
  // them can follow the edit below.
  const { data: existing } = await typedFrom(supabase, "weekly_schedule_bands")
    .select("id, weekday, branch_id, start_time, label_he, location_he")
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

  const moved = existing.weekday !== weekday || existing.branch_id !== branchId;
  if (moved) await releaseOldDaySlots(supabase, bandId);

  // Slots already projected from this band keep their trainer (a built day is
  // a record), but they stop taking self-bookings the moment the band is no
  // longer bookable. Seats follow the band while it is.
  const { error: seatsError } = await typedFrom(supabase, "daily_schedule_slots")
    .update({ max_trainees: isBookable ? maxTrainees : null })
    .eq("band_id", bandId)
    .gte("schedule_date", israelToday());
  if (seatsError) console.error("Update projected seats error:", seatsError);

  // A moved band's old-day slots were just released; the rest follow the edit.
  if (!moved) {
    await syncProjectedSlots(supabase, bandId, existing, {
      start_time: startTime,
      label_he: label,
      location_he: location,
    });
  }

  // After the sync, so days projected now take the band's new details.
  if (isBookable) await projectBranchNow(branchId);

  revalidateScheduleSurfaces();

  return { success: true, data: updated as WeeklyBand };
}

/**
 * The dated hours a band has projected that have not started yet.
 *
 * One definition of "still to come", shared by the count the admin is shown and
 * the delete that acts on it, so the dialog can never promise a different
 * number than the one that is removed.
 *
 * "Not started yet" rather than "from tomorrow": a band deleted at 09:00 must
 * take today's 18:00 hour with it, or that hour is stranded on the calendar
 * with its band_id nulled and nothing left to find it by. And not "from today"
 * either, which would delete an hour that already happened along with its
 * record of it.
 */
async function futureBandSlotIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  bandId: string,
): Promise<{ ids: string[] } | { error: true }> {
  const today = israelToday();
  const { hour, minute } = getIsraelTime();
  const now = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}:00`;

  const { data, error } = (await typedFrom(supabase, "daily_schedule_slots")
    .select("id")
    .eq("band_id", bandId)
    .or(
      `schedule_date.gt.${today},and(schedule_date.eq.${today},start_time.gt.${now})`,
    )) as {
    data: { id: string }[] | null;
    error: { message: string } | null;
  };

  if (error) {
    console.error("Future band slots query error:", error);
    return { error: true };
  }

  return { ids: (data ?? []).map((slot) => slot.id) };
}

/**
 * Carries a band edit's time, title and place to the hours it already
 * projected that have not started. A field changes only on slots that still
 * show the band's old value, so a single day staff edited by hand keeps its
 * own. Best-effort like the seats: the band is saved either way, and a slot
 * left behind is fixed by editing it.
 */
async function syncProjectedSlots(
  supabase: Awaited<ReturnType<typeof createClient>>,
  bandId: string,
  before: BandCopy,
  after: BandCopy,
): Promise<void> {
  const syncs = bandSlotSyncs(before, after);
  if (syncs.length === 0) return;

  const future = await futureBandSlotIds(supabase, bandId);
  if ("error" in future || future.ids.length === 0) return;

  const results = await Promise.all(
    syncs.map(({ column, from, to }) => {
      const query = typedFrom(supabase, "daily_schedule_slots")
        .update({ [column]: to })
        .in("id", future.ids);
      return from === null ? query.is(column, null) : query.eq(column, from);
    }),
  );
  results.forEach(({ error }, index) => {
    if (error) console.error(`Sync projected ${syncs[index].column} error:`, error);
  });
}

/**
 * How many dated hours a band's deletion would take with it.
 *
 * Only the future ones. daily_schedule_slots.band_id is ON DELETE SET NULL, so
 * without this the deletion silently leaves them on the calendar as orphans and
 * "remove it from the calendar" would be a lie the admin discovers tomorrow.
 */
export async function bandDeletionImpactAction(
  bandId: string,
): Promise<{ success: true; data: { futureSlots: number } } | { error: string }> {
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };

  const validated = bandIdSchema.safeParse({ bandId });
  if (!validated.success) return { error: "מזהה רצועה לא תקין" };

  const supabase = await createClient();
  const future = await futureBandSlotIds(supabase, validated.data.bandId);
  if ("error" in future) return { error: "שגיאה בבדיקת הרצועה" };

  return { success: true, data: { futureSlots: future.ids.length } };
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
  // there is no way left to tell which hours came from this stretch. A failed
  // lookup therefore has to stop the whole thing — deleting the band anyway
  // would strand hours nobody can find again, which is the one outcome this
  // action exists to prevent.
  const future = await futureBandSlotIds(supabase, validated.data.bandId);
  if ("error" in future) return { error: "שגיאה במחיקת הרצועה" };

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

  if (future.ids.length > 0) {
    // Each hour's group workout first, for the reason spelled out in
    // clearSlotWorkout. Independent per slot, so they go together.
    await Promise.all(future.ids.map((id) => clearSlotWorkout(supabase, id)));

    const { error: slotsError } = await typedFrom(supabase, "daily_schedule_slots")
      .delete()
      .in("id", future.ids);
    // The band is already gone, so the admin's intent stands either way. A
    // failure here leaves orphaned hours, which is what used to happen anyway.
    if (slotsError) console.error("Delete band future slots error:", slotsError);
  }

  revalidateScheduleSurfaces();

  return { success: true };
}
