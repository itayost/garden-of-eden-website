"use server";

import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { assertBranchWritable } from "@/lib/actions/shared/assert-branch";
import { revalidateScheduleSurfaces } from "@/lib/actions/shared/revalidate-schedule";
import { verifyRosterTrainees } from "@/lib/actions/shared/verify-roster-trainees";
import { getBranchScopeAction } from "@/lib/actions/shared/branch-scope";
import { mayCorrectPastSlot, planRosterAdd, planRosterRemove, rosterRemovalMode } from "@/lib/schedule/roster-entry";
import { israelMinutesOfDay } from "@/lib/utils/israel-time";
import { israelToday } from "@/lib/utils/tasks";
import { revalidateStaffSurfaces } from "@/features/plans/lib/revalidate-staff";
import { typedFrom } from "@/lib/supabase/helpers";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  rosterAddSchema,
  rosterRemoveSchema,
  type RosterAddInput,
  type RosterRemoveInput,
} from "@/lib/validations/schedule";
import { SLOT_SELECT_WITH_TRAINEES, type ScheduleSlot, type SlotTrainee } from "@/types/schedule";

/**
 * Roster edits one entry at a time.
 *
 * The slot form saves a whole roster through replace_slot_roster, which
 * deletes anyone missing from the list it was handed. A trainee who booked
 * while a staff member had that form open would be deleted by the save. These
 * actions touch only the row they name, so the calendar cannot lose a booking.
 *
 * Writes go through the server client: the staff-write RLS policy on
 * daily_schedule_slot_trainees applies, and .select() after each write turns
 * a silent RLS rejection (zero rows, no error) into a reported failure.
 */

type AddResult = { success: true; data: { overCapacity: boolean } } | { error: string };
/** needsReason: the Slot already happened; ask why and send it again. */
type RemoveResult = { success: true } | { error: string; needsReason?: true };

/** The audit snapshot of a name fits its column. */
const NAME_SNAPSHOT_MAX = 100;

/**
 * Whether the caller may correct the Roster of this Slot once it happened:
 * the Trainers who ran it, and Admins and Branch managers of its branch.
 */
async function mayCorrect(
  loaded: { slot: ScheduleSlot; branchId: string },
  actor: { userId: string; role: string },
): Promise<boolean> {
  const scope = await getBranchScopeAction();
  const managesBranch = "error" in scope ? false : scope.data.managedBranchIds.includes(loaded.branchId);
  const trainerIds = loaded.slot.trainers.map((t) => t.trainer_id).filter((id): id is string => id !== null);
  return mayCorrectPastSlot({ role: actor.role, userId: actor.userId, managesBranch }, { trainerIds });
}

const israelNow = () => ({ date: israelToday(), minutes: israelMinutesOfDay(new Date()) });

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/** Postgres unique_violation: a concurrent add of the same trainee won the race. */
const UNIQUE_VIOLATION = "23505";

/**
 * A slot's group workout follows its roster.
 *
 * Someone joining a slot that already has a group workout is the same event as
 * booking into it, and someone leaving stops being owed it. Both RPCs decide
 * for themselves whether there is anything to do: applying to a slot with no
 * group workout is a no-op, and dropping refuses to touch a session a trainer
 * edited individually or one the trainee already completed.
 *
 * A failure here is logged, never returned: the roster edit the staff member
 * asked for has already happened, and re-saving the group workout repairs the
 * copy. Refusing the edit would be the worse of the two outcomes.
 */
async function syncSlotWorkout(
  supabase: ServerClient,
  fn: "apply_slot_workout_to_trainee" | "drop_slot_workout_session",
  slotId: string,
  traineeId: string,
): Promise<void> {
  const rpcClient = supabase as unknown as {
    rpc: (
      name: string,
      args: Record<string, unknown>,
    ) => Promise<{ error: { message: string } | null }>;
  };
  const { error } = await rpcClient.rpc(fn, {
    p_slot_id: slotId,
    p_trainee_id: traineeId,
  });
  if (error) console.error(`${fn} failed:`, error);
}

async function loadWritableSlot(
  supabase: ServerClient,
  slotId: string,
): Promise<{ slot: ScheduleSlot; branchId: string } | { error: string }> {
  const { data, error } = (await typedFrom(supabase, "daily_schedule_slots")
    .select(SLOT_SELECT_WITH_TRAINEES)
    .eq("id", slotId)
    .maybeSingle()) as { data: ScheduleSlot | null; error: { message: string } | null };

  if (error) {
    console.error("Load slot for roster error:", error);
    return { error: "שגיאה בטעינת הסלוט" };
  }
  if (!data) return { error: "הסלוט לא נמצא" };
  // Every slot written since branches shipped carries one; a legacy row
  // without it cannot be scope-checked, so it is not edited from here.
  if (!data.branch_id) return { error: "הסלוט אינו משויך לסניף" };

  const branchCheck = await assertBranchWritable(data.branch_id);
  if (branchCheck.error) return { error: branchCheck.error };

  return { slot: data, branchId: data.branch_id };
}

export async function addSlotTraineeAction(input: RosterAddInput): Promise<AddResult> {
  const { error: authError, user, profile } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  const validated = rosterAddSchema.safeParse(input);
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "אימות נתונים נכשל" };
  }
  const { slotId, traineeId, name } = validated.data;

  const supabase = await createClient();
  const loaded = await loadWritableSlot(supabase, slotId);
  if ("error" in loaded) return { error: loaded.error };

  const rosterCheck = await verifyRosterTrainees([{ traineeId, name }], loaded.branchId);
  if (rosterCheck.error) return { error: rosterCheck.error };

  // Adding to an hour that already happened charges a session: the same
  // people who may correct its Roster may add to it.
  const past = rosterRemovalMode(loaded.slot, israelNow()) === "record";
  if (past && !(await mayCorrect(loaded, { userId: user!.id, role: profile!.role }))) {
    return { error: "אפשר לתקן רק אימון שהעברת" };
  }

  const plan = planRosterAdd(loaded.slot.trainees, { traineeId, name }, loaded.slot.max_trainees);
  if (plan.kind === "reject") return { error: plan.error };

  // Re-adding someone removed from a past hour takes back a recorded
  // removal, which only the server may write.
  const reinstatesRemoval =
    plan.kind === "reinstate" && Boolean(loaded.slot.trainees.find((t) => t.id === plan.rowId)?.removed_at);
  const table = reinstatesRemoval
    ? typedFrom(createAdminClient(), "daily_schedule_slot_trainees")
    : typedFrom(supabase, "daily_schedule_slot_trainees");
  const { data: written, error } =
    plan.kind === "reinstate"
      ? await table
          .update({
            cancelled_at: null,
            late_cancel: false,
            source: "staff",
            trainee_name: name,
            removed_at: null,
            removed_by: null,
            removed_by_name: null,
            removed_reason: null,
          })
          .eq("id", plan.rowId)
          .select("id")
      : await table
          .insert({
            slot_id: slotId,
            trainee_id: traineeId,
            trainee_name: name,
            order_index: plan.orderIndex,
            source: "staff",
          })
          .select("id");

  if (error?.code === UNIQUE_VIOLATION) return { error: "המתאמן כבר רשום לסלוט" };
  if (error) {
    console.error("Add slot trainee error:", error);
    return { error: "שגיאה בהוספת המתאמן" };
  }
  if ((written?.length ?? 0) === 0) return { error: "אין הרשאה לעדכן את הסלוט" };

  // A free-text name has no account and can hold no session.
  if (traineeId) {
    await syncSlotWorkout(supabase, "apply_slot_workout_to_trainee", slotId, traineeId);
  }

  revalidateScheduleSurfaces();
  return { success: true, data: { overCapacity: plan.overCapacity } };
}

/**
 * Removes a name from a Slot's Roster. Before the Slot starts it is deleted,
 * as always. From a Slot that already happened it is a recorded removal: the
 * row is cancelled (not late, so it costs no session) and keeps who and why.
 * Only the Trainers who ran that Slot, and Admins and Branch managers of its
 * branch, may correct a past Roster.
 */
export async function removeSlotTraineeAction(input: RosterRemoveInput): Promise<RemoveResult> {
  const { error: authError, user, profile } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  const validated = rosterRemoveSchema.safeParse(input);
  if (!validated.success) return { error: validated.error.issues[0]?.message ?? "מזהה רישום לא תקין" };
  const { rosterEntryId, reason } = validated.data;

  const supabase = await createClient();
  const { data: row, error: rowError } = (await typedFrom(supabase, "daily_schedule_slot_trainees")
    .select("id, slot_id, trainee_id, trainee_name, order_index, source, booked_at, cancelled_at, late_cancel, reminded_at")
    .eq("id", rosterEntryId)
    .maybeSingle()) as { data: SlotTrainee | null; error: { message: string } | null };

  if (rowError) {
    console.error("Load roster entry error:", rowError);
    return { error: "שגיאה בטעינת הרישום" };
  }
  if (!row) return { error: "הרישום לא נמצא" };

  const refusal = planRosterRemove(row);
  if (refusal) return { error: refusal };

  const loaded = await loadWritableSlot(supabase, row.slot_id);
  if ("error" in loaded) return { error: loaded.error };

  const past = rosterRemovalMode(loaded.slot, israelNow()) === "record";
  if (past && (reason ?? "").length < 2) {
    return { error: "בהסרה מאימון שכבר התקיים צריך לכתוב סיבה", needsReason: true };
  }
  const outcome = past
    ? await recordPastRemoval(loaded, row, {
        userId: user!.id,
        role: profile!.role,
        name: (profile!.full_name ?? "צוות").slice(0, NAME_SNAPSHOT_MAX),
        reason: reason!,
      })
    : await deleteFutureEntry(supabase, rosterEntryId);
  if (outcome) return { error: outcome };

  if (row.trainee_id) {
    await syncSlotWorkout(supabase, "drop_slot_workout_session", row.slot_id, row.trainee_id);
    revalidateStaffSurfaces(row.trainee_id);
  }
  revalidateScheduleSurfaces();
  return { success: true };
}

/** A Slot that has not started: the entry goes, as it always did. Returns an error or null. */
async function deleteFutureEntry(supabase: ServerClient, rosterEntryId: string): Promise<string | null> {
  const { data: deleted, error } = await typedFrom(supabase, "daily_schedule_slot_trainees")
    .delete()
    .eq("id", rosterEntryId)
    // The trainee may cancel between the read above and this delete; a
    // cancellation is usage history, so it must not be erased by the race.
    .is("cancelled_at", null)
    .select("id");
  if (error) {
    console.error("Remove slot trainee error:", error);
    return "שגיאה בהסרת המתאמן";
  }
  return (deleted?.length ?? 0) === 0 ? "הרישום לא נמצא או שכבר בוטל" : null;
}

/** A Slot that already happened: the entry stays on record and stops counting. Returns an error or null. */
async function recordPastRemoval(
  loaded: { slot: ScheduleSlot; branchId: string },
  row: SlotTrainee,
  actor: { userId: string; role: string; name: string; reason: string },
): Promise<string | null> {
  if (!(await mayCorrect(loaded, actor))) return "אפשר לתקן רק אימון שהעברת";

  // A recorded removal is written by the server only (guard_roster_removal).
  const at = new Date().toISOString();
  const { data: recorded, error } = await typedFrom(createAdminClient(), "daily_schedule_slot_trainees")
    .update({
      cancelled_at: at,
      late_cancel: false,
      removed_at: at,
      removed_by: actor.userId,
      removed_by_name: actor.name,
      removed_reason: actor.reason,
    })
    .eq("id", row.id)
    .is("cancelled_at", null)
    .select("id");
  if (error) {
    console.error("Record roster removal error:", error);
    return "שגיאה בהסרת המתאמן";
  }
  return (recorded?.length ?? 0) === 0 ? "הרישום לא נמצא או שכבר בוטל" : null;
}
