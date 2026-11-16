import "server-only";

import { assertBranchWritable } from "@/lib/actions/shared/assert-branch";
import { getBranchScopeAction } from "@/lib/actions/shared/branch-scope";
import { mayCorrectPastSlot } from "@/lib/schedule/roster-entry";
import { israelMinutesOfDay } from "@/lib/utils/israel-time";
import { israelToday } from "@/lib/utils/tasks";
import { typedFrom } from "@/lib/supabase/helpers";
import type { createClient } from "@/lib/supabase/server";
import { SLOT_SELECT_WITH_TRAINEES, type ScheduleSlot } from "@/types/schedule";

/**
 * The Slot checks every roster edit and Quick tag shares: load a Slot the
 * caller may write in its branch, and decide who may correct one that already
 * happened. Server only, and kept out of the "use server" files on purpose:
 * an export there would be callable from the browser.
 */

export type ServerClient = Awaited<ReturnType<typeof createClient>>;

export const israelNow = () => ({ date: israelToday(), minutes: israelMinutesOfDay(new Date()) });

/**
 * Whether the caller may correct the Roster of this Slot once it happened:
 * the Trainers who ran it, and Admins and Branch managers of its branch.
 */
export async function mayCorrect(
  loaded: { slot: ScheduleSlot; branchId: string },
  actor: { userId: string; role: string },
): Promise<boolean> {
  const scope = await getBranchScopeAction();
  const managesBranch = "error" in scope ? false : scope.data.managedBranchIds.includes(loaded.branchId);
  const trainerIds = loaded.slot.trainers.map((t) => t.trainer_id).filter((id): id is string => id !== null);
  return mayCorrectPastSlot({ role: actor.role, userId: actor.userId, managesBranch }, { trainerIds });
}

export async function loadWritableSlot(
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
