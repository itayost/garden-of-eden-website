"use server";

import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { assertBranchWritable } from "@/lib/actions/shared/assert-branch";
import { revalidateScheduleSurfaces } from "@/lib/actions/shared/revalidate-schedule";
import { verifyRosterTrainees } from "@/lib/actions/shared/verify-roster-trainees";
import { planRosterAdd, planRosterRemove } from "@/lib/schedule/roster-entry";
import { typedFrom } from "@/lib/supabase/helpers";
import { createClient } from "@/lib/supabase/server";
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
type RemoveResult = { success: true } | { error: string };

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/** Postgres unique_violation: a concurrent add of the same trainee won the race. */
const UNIQUE_VIOLATION = "23505";

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
  const { error: authError } = await verifyAdminOrTrainer();
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

  const plan = planRosterAdd(loaded.slot.trainees, { traineeId, name }, loaded.slot.max_trainees);
  if (plan.kind === "reject") return { error: plan.error };

  const table = typedFrom(supabase, "daily_schedule_slot_trainees");
  const { data: written, error } =
    plan.kind === "reinstate"
      ? await table
          .update({ cancelled_at: null, late_cancel: false, source: "staff", trainee_name: name })
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

  revalidateScheduleSurfaces();
  return { success: true, data: { overCapacity: plan.overCapacity } };
}

export async function removeSlotTraineeAction(input: RosterRemoveInput): Promise<RemoveResult> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  const validated = rosterRemoveSchema.safeParse(input);
  if (!validated.success) return { error: "מזהה רישום לא תקין" };
  const { rosterEntryId } = validated.data;

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

  const { data: deleted, error } = await typedFrom(supabase, "daily_schedule_slot_trainees")
    .delete()
    .eq("id", rosterEntryId)
    .select("id");

  if (error) {
    console.error("Remove slot trainee error:", error);
    return { error: "שגיאה בהסרת המתאמן" };
  }
  if ((deleted?.length ?? 0) === 0) return { error: "הרישום לא נמצא" };

  revalidateScheduleSurfaces();
  return { success: true };
}
