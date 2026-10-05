"use server";

import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { revalidateScheduleSurfaces } from "@/lib/actions/shared/revalidate-schedule";
import { verifyAdminOrBranchManager } from "@/lib/actions/shared/verify-branch-manager";
import { callOffRefusal } from "@/lib/schedule/roster-entry";
import { createAdminClient } from "@/lib/supabase/admin";
import { israelMinutesOfDay } from "@/lib/utils/israel-time";
import { israelToday } from "@/lib/utils/tasks";
import { callOffSlotSchema, slotIdSchema } from "@/lib/validations/schedule";
import { revalidateStaffSurfaces } from "@/features/plans/lib/revalidate-staff";

type Result = { success: true } | { error: string };

/**
 * The Slot, after the check that the caller is an Admin or a Branch manager
 * of its branch. Called off moves sessions on every Card on its Roster, so it
 * is not a Trainer's call.
 */
async function loadManagedSlot(slotId: string) {
  const db = createAdminClient();
  const { data: slot } = await db
    .from("daily_schedule_slots")
    .select("id, schedule_date, start_time, branch_id, called_off_at, trainees:daily_schedule_slot_trainees(trainee_id)")
    .eq("id", slotId)
    .maybeSingle();
  if (!slot) return { error: "האימון לא נמצא" } as const;
  if (!slot.branch_id) return { error: "האימון אינו משויך לסניף" } as const;
  const denied = await verifyAdminOrBranchManager([slot.branch_id]);
  if (denied) return { error: denied } as const;
  return { db, slot };
}

/** Called off moves sessions on Cards: who did it, and why, go to the audit trail. */
async function logCalledOff(
  db: ReturnType<typeof createAdminClient>,
  slot: { id: string; schedule_date: string; start_time: string },
  actor: { id: string; name: string },
  action: "slot_called_off" | "slot_called_off_cleared",
  reason: string | null,
): Promise<void> {
  const { error } = await db.from("activity_logs").insert({
    user_id: actor.id,
    action,
    actor_id: actor.id,
    actor_name: actor.name,
    metadata: { slotId: slot.id, date: slot.schedule_date, time: slot.start_time, reason },
  });
  if (error) console.error(`[called-off] activity log failed:`, error.message);
}

function revalidateRoster(trainees: { trainee_id: string | null }[]): void {
  revalidateScheduleSurfaces();
  for (const t of trainees) if (t.trainee_id) revalidateStaffSurfaces(t.trainee_id);
}

/**
 * Marks a Slot that already happened as Called off by the academy. Its Roster
 * stays on record; nobody on it uses a session, so every Card on it gets the
 * session back on every screen.
 */
export async function callOffSlotAction(input: { slotId: string; reason: string }): Promise<Result> {
  const { error: authError, user, profile } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };
  const parsed = callOffSlotSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "קלט לא תקין" };

  const loaded = await loadManagedSlot(parsed.data.slotId);
  if ("error" in loaded) return { error: loaded.error ?? "שגיאה" };
  const { db, slot } = loaded;
  if (slot.called_off_at) return { error: "האימון כבר סומן כבוטל" };
  const refusal = callOffRefusal(slot, { date: israelToday(), minutes: israelMinutesOfDay(new Date()) });
  if (refusal) return { error: refusal };

  const { data: marked, error } = await db
    .from("daily_schedule_slots")
    .update({
      called_off_at: new Date().toISOString(),
      called_off_by: user!.id,
      called_off_by_name: (profile!.full_name ?? "צוות").slice(0, 100),
      called_off_reason: parsed.data.reason,
    })
    .eq("id", slot.id)
    .is("called_off_at", null)
    .select("id");
  if (error) {
    console.error("[called-off] update failed:", error.message);
    return { error: "הסימון נכשל. נסו שוב." };
  }
  if (!marked?.length) return { error: "האימון כבר סומן כבוטל" };
  await logCalledOff(db, slot, { id: user!.id, name: profile!.full_name ?? "צוות" }, "slot_called_off", parsed.data.reason);
  revalidateRoster(slot.trainees ?? []);
  return { success: true };
}

/** Undoes a Called off marked by mistake: the Roster counts again. */
export async function clearCalledOffAction(input: { slotId: string }): Promise<Result> {
  const { error: authError, user, profile } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };
  const parsed = slotIdSchema.safeParse(input);
  if (!parsed.success) return { error: "מזהה לא תקין" };

  const loaded = await loadManagedSlot(parsed.data.slotId);
  if ("error" in loaded) return { error: loaded.error ?? "שגיאה" };
  const { db, slot } = loaded;
  if (!slot.called_off_at) return { error: "האימון לא מסומן כבוטל" };

  const { data: cleared, error } = await db
    .from("daily_schedule_slots")
    .update({ called_off_at: null, called_off_by: null, called_off_by_name: null, called_off_reason: null })
    .eq("id", slot.id)
    .not("called_off_at", "is", null)
    .select("id");
  if (error) {
    console.error("[called-off] clear failed:", error.message);
    return { error: "ביטול הסימון נכשל. נסו שוב." };
  }
  if (!cleared?.length) return { error: "האימון לא מסומן כבוטל" };
  // The Roster counts again: a session given back and booked meanwhile may now overdraw a Card.
  await logCalledOff(db, slot, { id: user!.id, name: profile!.full_name ?? "צוות" }, "slot_called_off_cleared", null);
  revalidateRoster(slot.trainees ?? []);
  return { success: true };
}
