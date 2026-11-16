/**
 * Holds a report before it is approved or sent when a caution Quick tag or a
 * sensitive Shift report entry naming its Trainee arrived after the Fact sheet
 * was built. The content still never reaches the report; only the Hold does.
 */
import "server-only";

import type { HoldReason } from "../fact-sheet/types";
import { reportWeekEnd } from "../report-week";
import { newSensitiveHolds, sensitiveHoldsNow } from "../sensitive-recheck";
import { unique, type Db } from "./read";
import { toJson } from "./stored";
import { readShiftReports, readTags } from "./week-reads";

export interface RecheckRow {
  id: string;
  traineeId: string;
  /** The status the row was read in; the Hold is written only while it still is. */
  status: string;
  holdReasons: HoldReason[];
}

/**
 * The ids of rows that now have a sensitive Hold their stored Holds lack.
 * Each such row is set `held` with the new reasons added (only while it is
 * still in the status it was read in). Callers must not approve or send any
 * returned id, whether or not its update landed.
 */
export async function holdLateSensitive(db: Db, weekStart: string, rows: readonly RecheckRow[]): Promise<Set<string>> {
  if (rows.length === 0) return new Set();
  const range = { from: weekStart, to: reportWeekEnd(weekStart) };
  const [reports, tags] = await Promise.all([
    readShiftReports(db, range),
    readTags(db, unique(rows.map((row) => row.traineeId)), range),
  ]);

  const flagged = new Set<string>();
  const heldAt = new Date().toISOString();
  for (const row of rows) {
    const fresh = newSensitiveHolds(
      row.holdReasons,
      sensitiveHoldsNow(reports, tags.get(row.traineeId) ?? [], row.traineeId),
    );
    if (fresh.length === 0) continue;
    flagged.add(row.id);
    const { error } = await db
      .from("weekly_reports")
      .update({ status: "held", hold_reasons: toJson([...row.holdReasons, ...fresh]), held_at: heldAt, held_by: null })
      .eq("id", row.id)
      .eq("status", row.status);
    if (error) throw new Error(`weekly_reports late hold failed: ${error.message}`);
  }
  return flagged;
}
