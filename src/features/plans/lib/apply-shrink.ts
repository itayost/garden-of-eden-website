import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";
import { ddmmyyyy } from "@/lib/plans/confirmation-copy";
import type { QueueRow } from "@/lib/plans/plan-queue";

/** The notice a Trainee reads for one Booking the shrink rule cancelled. */
export function cancelledBookingNotice(row: Pick<QueueRow, "schedule_date" | "start_time">): string {
  return `האימון ב-${ddmmyyyy(row.schedule_date)} בשעה ${row.start_time.slice(0, 5)} בוטל כי המסלול שלך עודכן. אפשר להירשם לאימון אחר בלוח האימונים.`;
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
