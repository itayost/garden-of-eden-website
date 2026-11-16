"use server";

import { waitUntil } from "@vercel/functions";
import { checkRateLimit } from "@/lib/rate-limit";
import { reportIdSchema, type ReportIdInput } from "@/lib/validations/weekly-reports";
import { revalidateWeeklyReports } from "../cache-tags";
import {
  actionFailure,
  firstIssue,
  loadReportForAction,
  STALE_REPORT,
  staffCaller,
  updateIfUnchanged,
  type ActionResult,
} from "./staff-report";
import { writeTextValues } from "./write-report";

/** The statuses a report can still be written again in. */
const WRITABLE = ["pending", "held"];

/**
 * כתוב מחדש: writes this one report again from its stored Fact sheet with a
 * direct request, and replaces its texts, its original output and its text
 * problems. A staff edit is dropped with the old text. 20 an hour per staff
 * member.
 */
export async function rewriteReportAction(input: ReportIdInput): Promise<ActionResult> {
  const caller = await staffCaller();
  if ("error" in caller) return caller;
  const parsed = reportIdSchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);

  const limit = await checkRateLimit(`weekly-rewrite:${caller.userId}`, "weekly_rewrite");
  waitUntil(limit.pending);
  if (limit.rateLimited) return { error: "יותר מדי כתיבות מחדש בשעה האחרונה. נסו שוב מאוחר יותר" };

  try {
    const report = await loadReportForAction(caller.db, parsed.data.reportId, parsed.data.version);
    if ("error" in report) return report;
    if (report.kind !== "report") return { error: "אין מה לכתוב בשורה הזו" };
    if (!WRITABLE.includes(report.status)) return { error: "אפשר לכתוב מחדש רק דוח שממתין לאישור או מעוכב" };
    if (report.stored === null) return { error: "אין דף עובדות לדוח הזה" };
    if (report.stored.sheet.player.gender === null) return { error: "חסר מגדר: בחרו בן או בת" };

    const written = await writeTextValues(report.stored.sheet, report.holdReasons);
    if (!written.ok) return { error: written.error };
    const updated = await updateIfUnchanged(caller.db, report, WRITABLE, written.values);
    if (!updated) return { error: STALE_REPORT };
    revalidateWeeklyReports();
    return { success: true, held: written.held };
  } catch (error) {
    return actionFailure("rewrite", error);
  }
}
