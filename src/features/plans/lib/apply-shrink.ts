import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { ddmmyyyy } from "@/lib/plans/confirmation-copy";
import type { QueueRow } from "@/lib/plans/plan-queue";
import { countedRowIds } from "@/lib/schedule/booking-rules";
import { shrinkImpact } from "@/lib/plans/shrink";
import type { PlanContext } from "./plan-context";
import { planStamps, type StoredPlan } from "./queries";
import { revalidateStaffSurfaces } from "./revalidate-staff";

/** The notice a Trainee reads for one Booking the shrink rule cancelled. */
export function cancelledBookingNotice(row: Pick<QueueRow, "schedule_date" | "start_time">): string {
  return `האימון ב-${ddmmyyyy(row.schedule_date)} בשעה ${row.start_time.slice(0, 5)} בוטל כי המסלול שלך עודכן. אפשר להירשם לאימון אחר בלוח האימונים.`;
}

/**
 * What a guarded act's function (undo_plan, end_plan_early) takes to run the
 * shrink rule's cancellations in its own transaction, and the roster and Plan
 * stamps it was read on, compared under the per-trainee lock.
 */
export function guardedShrinkArgs(ctx: Pick<PlanContext, "rows" | "plans">, cancelled: readonly QueueRow[]) {
  return {
    p_cancel_row_ids: cancelled.map((r) => r.id),
    p_cancel_notices: cancelled.map(cancelledBookingNotice),
    p_counted_row_ids: countedRowIds(ctx.rows),
    p_plan_stamps: planStamps(ctx.plans),
  };
}

/**
 * Carries out the shrink rule's cancellations for one Trainee: each row is
 * cancelled as a normal, not late, cancellation, which frees the seat and
 * costs no session; the slot's group workout leaves with it; and the Trainee
 * gets an in-app notice. Rows moved to a Queued plan need no write: the
 * queue charges them there on its own. Returns how many were cancelled.
 */
export async function applyShrinkCancellations(
  db: SupabaseClient<Database>,
  profileId: string,
  rows: readonly QueueRow[],
): Promise<number> {
  if (rows.length === 0) return 0;
  const { data: cancelled, error } = await db
    .from("daily_schedule_slot_trainees")
    .update({ cancelled_at: new Date().toISOString(), late_cancel: false })
    .in("id", rows.map((r) => r.id))
    .is("cancelled_at", null)
    .select("id, slot_id");
  if (error) {
    console.error("[shrink] cancelling roster rows failed:", error.message);
    return 0;
  }

  await Promise.all(
    (cancelled ?? []).map(async (row) => {
      const { error: dropError } = await db.rpc("drop_slot_workout_session", {
        p_slot_id: row.slot_id,
        p_trainee_id: profileId,
      });
      if (dropError) console.error("[shrink] drop_slot_workout_session failed:", dropError.message);
    }),
  );

  const cancelledIds = new Set((cancelled ?? []).map((r) => r.id));
  const notices = rows
    .filter((r) => cancelledIds.has(r.id))
    .map((r) => ({ profile_id: profileId, body_he: cancelledBookingNotice(r) }));
  if (notices.length > 0) {
    const { error: noticeError } = await db.from("trainee_notices").insert(notices);
    if (noticeError) console.error("[shrink] notices failed:", noticeError.message);
  }
  return cancelledIds.size;
}

/**
 * After a change that may shrink the queue: the shrink rule for the Bookings
 * that no longer fit, then the staff screens refreshed. incomplete says some
 * cancellations did not land, so staff look at the roster.
 */
export async function applyShrinkAfter(
  db: SupabaseClient<Database>,
  ctx: Pick<PlanContext, "plans" | "rows" | "plan">,
  after: readonly StoredPlan[],
  today: string,
): Promise<{ cancelledCount: number; movedCount: number; incomplete: boolean }> {
  const impact = shrinkImpact(ctx.plans, after, ctx.rows, today);
  const cancelledCount = await applyShrinkCancellations(db, ctx.plan.profile_id, impact.cancelled);
  const incomplete = cancelledCount < impact.cancelled.length;
  if (incomplete) {
    console.error(`[shrink] plan ${ctx.plan.id}: cancelled ${cancelledCount} of ${impact.cancelled.length} bookings`);
  }
  revalidateStaffSurfaces(ctx.plan.profile_id);
  return { cancelledCount, movedCount: impact.moved.length, incomplete };
}
