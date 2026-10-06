import { createHash } from "node:crypto";
import { countedRowIds, type RosterRowLite } from "@/lib/schedule/booking-rules";

/**
 * A short fingerprint of what a confirmation dialog showed: the Trainee's
 * counted roster rows and Plan stamps, the same picture the guarded functions
 * compare (assert_trainee_unchanged). An act refuses when its own read no
 * longer matches the dialog's, so it never cancels a Booking staff did not see.
 */
export function readToken(
  rows: readonly (Pick<RosterRowLite, "cancelled_at" | "late_cancel" | "called_off"> & { id: string })[],
  plans: readonly { updated_at: string }[],
): string {
  const ids = [...countedRowIds(rows)].sort();
  const stamps = plans.map((p) => p.updated_at).sort();
  return createHash("sha256").update(`${ids.join(",")}|${stamps.join(",")}`).digest("hex");
}
