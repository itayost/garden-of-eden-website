"use server";

import { textsSchema, type TextsInput } from "@/lib/validations/weekly-reports";
import { revalidateWeeklyReports } from "../cache-tags";
import { combinedEditRatio } from "../edit-ratio";
import { MAX_DRILLS, replaceTextProblems, reportProblems } from "../guardrails";
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

/** The statuses a text can still be edited in. */
const EDITABLE = ["pending", "held"];

/**
 * שמור שינויים: both texts as staff edited them. The guardrails run again on
 * the new texts and their problems replace the old text problems; the row is
 * held while any reason remains. The model's original output is never
 * changed, so the edit ratio always measures against it.
 */
export async function saveReportTextsAction(input: TextsInput): Promise<ActionResult> {
  const caller = await staffCaller();
  if ("error" in caller) return caller;
  const parsed = textsSchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);

  try {
    const report = await loadReportForAction(caller.db, parsed.data.reportId, parsed.data.version);
    if ("error" in report) return report;
    if (report.kind !== "report") return { error: "אין טקסט לעריכה בשורה הזו" };
    if (!EDITABLE.includes(report.status)) return { error: "אפשר לערוך רק דוח שממתין לאישור או מעוכב" };
    // An unwritten row is still the write job's: a text saved into it would be written over.
    if (report.writtenAt === null || report.original === null) {
      return { error: "עדיין אין טקסט לעריכה. אפשר ללחוץ על כתוב מחדש" };
    }
    if (report.stored === null) return { error: "אין דף עובדות לדוח הזה" };

    const { playerText, parentText } = parsed.data;
    const drillIds = report.drillIds.slice(0, MAX_DRILLS);
    const fresh = reportProblems(report.stored.sheet, {
      player_text: playerText,
      parent_text: parentText,
      drill_ids: drillIds,
    });
    const holds = replaceTextProblems(report.holdReasons, fresh);
    const updated = await updateIfUnchanged(caller.db, report, EDITABLE, {
      player_text: playerText,
      parent_text: parentText,
      drill_ids: drillIds,
      edited_by: caller.userId,
      edited_at: new Date().toISOString(),
      edit_ratio: combinedEditRatio(report.original, playerText, parentText),
      hold_reasons: toJson(holds),
      status: holds.length > 0 ? "held" : "pending",
    });
    if (!updated) return { error: STALE_REPORT };
    revalidateWeeklyReports();
    return { success: true, held: holds.length > 0 };
  } catch (error) {
    return actionFailure("save texts", error);
  }
}
