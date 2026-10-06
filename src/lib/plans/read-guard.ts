import { createHash } from "node:crypto";
import { countedRowIds, type RosterRowLite } from "@/lib/schedule/booking-rules";

type GuardRow = Pick<RosterRowLite, "cancelled_at" | "late_cancel" | "called_off"> & { id: string };

/**
 * What a guarded function (book_slot_checked, the adjust and freeze functions,
 * undo_plan, end_plan_early) compares under the per-trainee lock through
 * assert_trainee_unchanged: the Trainee's counted roster rows and Plan stamps
 * (trainee_plans.updated_at) as the caller read them.
 */
export function guardArgs(rows: readonly GuardRow[], plans: readonly { updated_at: string }[]) {
  return { p_counted_row_ids: countedRowIds(rows), p_plan_stamps: plans.map((p) => p.updated_at) };
}

/**
 * A short fingerprint of the same picture, for a confirmation dialog to send
 * back: an act refuses when its own read no longer matches the dialog's, so it
 * never cancels a Booking staff did not see.
 */
export function readToken(rows: readonly GuardRow[], plans: readonly { updated_at: string }[]): string {
  const { p_counted_row_ids, p_plan_stamps } = guardArgs(rows, plans);
  return createHash("sha256")
    .update(`${[...p_counted_row_ids].sort().join(",")}|${[...p_plan_stamps].sort().join(",")}`)
    .digest("hex");
}
