"use server";

import { holdSchema, type HoldInput } from "@/lib/validations/weekly-reports";
import { revalidateWeeklyReports } from "../cache-tags";
import type { HoldReason } from "../fact-sheet/types";
import { toJson } from "../queries/stored";
import {
  actionFailure,
  firstIssue,
  loadReportForAction,
  STALE_REPORT,
  staffCaller,
  updateIfUnchanged,
  type ActionResult,
} from "./staff-report";

/** The statuses a row can still be held from: it has not gone out, and its week is open. */
const HOLDABLE = ["pending", "approved", "held"];

/**
 * עכב, with the reason staff typed: a report or "התגעגענו" stays out of every
 * send window until a person approves it. The reason is added to the row's
 * Holds and stays until then.
 */
export async function holdReportAction(input: HoldInput): Promise<ActionResult> {
  const caller = await staffCaller();
  if ("error" in caller) return caller;
  const parsed = holdSchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);

  try {
    const report = await loadReportForAction(caller.db, parsed.data.reportId, parsed.data.version);
    if ("error" in report) return report;
    if (report.kind === "absent") return { error: "אין מה לעכב בשורה הזו" };
    if (!HOLDABLE.includes(report.status)) {
      return { error: report.status === "sent" ? "הדוח כבר נשלח" : "השבוע של הדוח נסגר" };
    }

    const manual: HoldReason = { code: "manual", text: parsed.data.reason };
    const updated = await updateIfUnchanged(caller.db, report, HOLDABLE, {
      hold_reasons: toJson([...report.holdReasons, manual]),
      held_by: caller.userId,
      held_at: new Date().toISOString(),
      status: "held",
    });
    if (!updated) return { error: STALE_REPORT };
    revalidateWeeklyReports();
    return { success: true, held: true };
  } catch (error) {
    return actionFailure("hold", error);
  }
}
