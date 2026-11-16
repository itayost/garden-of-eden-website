"use server";

import { getBranchScopeAction } from "@/lib/actions/shared";
import { isInBranchScope } from "@/lib/branches/branch-scope";
import { loadBranchIdsByProfile } from "@/features/branches/lib/memberships";
import { chunk } from "@/lib/supabase/in-chunks";
import {
  approveAllSchema,
  reportIdSchema,
  type ApproveAllInput,
  type ReportIdInput,
} from "@/lib/validations/weekly-reports";
import { approveRefusal } from "../approval";
import { revalidateWeeklyReports } from "../cache-tags";
import { must, type Db } from "../queries/read";
import { holdLateSensitive } from "../queries/sensitive-recheck";
import { holdReasonsOf } from "../queries/stored";
import {
  actionFailure,
  firstIssue,
  loadReportForAction,
  STALE_REPORT,
  staffCaller,
  updateIfUnchanged,
  type ActionResult,
} from "./staff-report";

const LATE_SENSITIVE = "נוספו מאז הכתיבה נתונים שמחייבים בדיקה. הדוח עוכב, פתחו אותו שוב לפני אישור.";

/**
 * אשר: one report, as the screen showed it, when no text problem stands in the
 * way and nothing sensitive about the Trainee arrived after it was written.
 */
export async function approveReportAction(input: ReportIdInput): Promise<ActionResult> {
  const caller = await staffCaller();
  if ("error" in caller) return caller;
  const parsed = reportIdSchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);

  try {
    const report = await loadReportForAction(caller.db, parsed.data.reportId, parsed.data.version);
    if ("error" in report) return report;
    const refusal = approveRefusal(report);
    if (refusal) return { error: refusal };
    const late = await holdLateSensitive(caller.db, report.weekStart, [report]);
    if (late.size > 0) {
      revalidateWeeklyReports();
      return { error: LATE_SENSITIVE };
    }

    const updated = await updateIfUnchanged(caller.db, report, [report.status], {
      status: "approved",
      approved_by: caller.userId,
      approved_at: new Date().toISOString(),
    });
    if (!updated) return { error: STALE_REPORT };
    revalidateWeeklyReports();
    return { success: true };
  } catch (error) {
    return actionFailure("approve", error);
  }
}

type ApproveAllResult = { success: true; count: number; held: number } | { error: string };

const PENDING_SELECT = "id, trainee_id, kind, status, player_text, parent_text, hold_reasons";

async function readPending(db: Db, weekStart: string, scopeIds: readonly string[] | null, branchId?: string) {
  const base = db
    .from("weekly_reports")
    .select(PENDING_SELECT)
    .eq("week_start", weekStart)
    .eq("kind", "report")
    .eq("status", "pending");
  const scoped = scopeIds === null ? base : base.overlaps("branch_ids", [...scopeIds]);
  const filtered = branchId ? scoped.contains("branch_ids", [branchId]) : scoped;
  return must("weekly_reports", await filtered.order("id")) ?? [];
}

/**
 * "אשר את כל הממתינים": every pending report of the week in the caller's
 * scope (and the branch in view) that approveRefusal() lets through. Held
 * rows are never touched: a Hold always needs a person to open the report.
 */
export async function approveAllAction(input: ApproveAllInput): Promise<ApproveAllResult> {
  const caller = await staffCaller();
  if ("error" in caller) return caller;
  const parsed = approveAllSchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  const scopeResult = await getBranchScopeAction();
  if ("error" in scopeResult) return { error: scopeResult.error };
  const { scope } = scopeResult.data;

  try {
    const scopeIds = scope.kind === "all" ? null : scope.ids;
    if (scopeIds !== null && scopeIds.length === 0) return { success: true, count: 0, held: 0 };
    const rows = await readPending(caller.db, parsed.data.weekStart, scopeIds, parsed.data.filterBranchId);
    const approvable = rows.filter(
      (row) =>
        approveRefusal({
          kind: row.kind,
          status: row.status,
          playerText: row.player_text,
          parentText: row.parent_text,
          holdReasons: holdReasonsOf(row.hold_reasons),
        }) === null,
    );
    // The same rule as assertTraineeInScope(), read once for every row.
    const memberships =
      scope.kind === "all" ? null : await loadBranchIdsByProfile(caller.db, approvable.map((row) => row.trainee_id));
    const inScope = approvable.filter(
      (row) => memberships === null || isInBranchScope(scope, memberships.get(row.trainee_id) ?? []),
    );
    // A caution tag or sensitive entry filed after the writing holds the row
    // instead: it needs a person to open it.
    const late = await holdLateSensitive(
      caller.db,
      parsed.data.weekStart,
      inScope.map((row) => ({
        id: row.id,
        traineeId: row.trainee_id,
        status: row.status,
        holdReasons: holdReasonsOf(row.hold_reasons),
      })),
    );
    const ids = inScope.filter((row) => !late.has(row.id)).map((row) => row.id);

    const approvedAt = new Date().toISOString();
    let count = 0;
    for (const slice of chunk(ids)) {
      const { data, error } = await caller.db
        .from("weekly_reports")
        .update({ status: "approved", approved_by: caller.userId, approved_at: approvedAt })
        .in("id", slice)
        .eq("status", "pending")
        .select("id");
      if (error) throw new Error(error.message);
      count += data?.length ?? 0;
    }
    if (count > 0 || late.size > 0) revalidateWeeklyReports();
    return { success: true, count, held: late.size };
  } catch (error) {
    return actionFailure("approve all", error);
  }
}
