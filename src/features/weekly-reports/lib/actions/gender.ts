"use server";

import { revalidatePath } from "next/cache";
import { parseGender, type Gender } from "@/lib/profile/gender";
import { israelToday } from "@/lib/utils/tasks";
import { genderSchema, type GenderInput } from "@/lib/validations/weekly-reports";
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
  type StaffCaller,
} from "./staff-report";
import { rebuildSheet, writeTextValues } from "./write-report";

const WRITABLE = ["pending", "held"];

const WRITING_FAILED: HoldReason = { code: "writing_failed", text: "הכתיבה נכשלה" };

/**
 * Writes the gender only where the profile has none, so a value staff set
 * elsewhere is never overwritten, and logs it. Returns the profile's gender
 * as it now stands.
 */
async function saveGender(caller: StaffCaller, traineeId: string, gender: Gender): Promise<Gender | null> {
  const { data, error } = await caller.db
    .from("profiles")
    .update({ gender })
    .eq("id", traineeId)
    .is("gender", null)
    .select("id");
  if (error) throw new Error(`profiles gender update failed: ${error.message}`);
  if ((data?.length ?? 0) > 0) {
    const { error: logError } = await caller.db.from("activity_logs").insert({
      user_id: traineeId,
      action: "user_updated",
      actor_id: caller.userId,
      actor_name: caller.actorName,
      changes: [{ field: "gender", old_value: null, new_value: gender }],
    });
    if (logError) console.error("[weekly-reports] gender activity log failed:", logError.message);
  }
  const { data: profile, error: readError } = await caller.db
    .from("profiles")
    .select("gender")
    .eq("id", traineeId)
    .maybeSingle();
  if (readError) throw new Error(`profiles read failed: ${readError.message}`);
  return parseGender(profile?.gender);
}

/**
 * בן / בת from the queue, for a report held for missing gender: the gender
 * goes on the profile, the Fact sheet is built again with it, the
 * "חסר מגדר" Hold goes, and the texts are written as in כתוב מחדש. When the
 * writing fails the new sheet is still saved, held with "הכתיבה נכשלה".
 */
export async function setReportGenderAction(input: GenderInput): Promise<ActionResult> {
  const caller = await staffCaller();
  if ("error" in caller) return caller;
  const parsed = genderSchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);

  try {
    const report = await loadReportForAction(caller.db, parsed.data.reportId, parsed.data.version);
    if ("error" in report) return report;
    if (report.kind !== "report" || !WRITABLE.includes(report.status)) return { error: "אי אפשר לעדכן את הדוח הזה" };
    if (!report.holdReasons.some((reason) => reason.code === "missing_gender")) return { error: "המגדר כבר ידוע" };

    const gender = await saveGender(caller, report.traineeId, parsed.data.gender);
    revalidatePath(`/admin/users/${report.traineeId}`);
    if (gender === null) return { error: "שמירת המגדר נכשלה, נסו שוב" };

    const built = await rebuildSheet(caller.db, report, israelToday());
    if (built === null) return { error: "פרופיל החניך לא נמצא" };
    const holds = [...report.holdReasons.filter((reason) => reason.code === "manual"), ...built.holds];
    const factSheet = toJson({ sheet: built.sheet, body: built.body });
    const written = await writeTextValues(built.sheet, holds);
    const values = written.ok
      ? { ...written.values, fact_sheet: factSheet }
      : { fact_sheet: factSheet, hold_reasons: toJson([...holds, WRITING_FAILED]), status: "held" };

    const updated = await updateIfUnchanged(caller.db, report, WRITABLE, values);
    if (!updated) return { error: STALE_REPORT };
    revalidateWeeklyReports();
    if (!written.ok) return { error: `המגדר נשמר. ${written.error}` };
    return { success: true, held: written.held };
  } catch (error) {
    return actionFailure("set gender", error);
  }
}
