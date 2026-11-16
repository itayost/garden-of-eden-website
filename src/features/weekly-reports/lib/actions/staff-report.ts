/**
 * What every staff action of the approval queue shares: the caller, the row
 * read, the scope check, and the one conditional update that refuses a stale
 * screen. Server-only helpers, not server actions.
 *
 * Order in each action: verifyAdminOrTrainer(), the schema, the row read,
 * the row's branches against the caller's scope and
 * assertTraineeInScope(row.trainee_id), then an update guarded on the status
 * it expects and on the `updated_at` it read.
 */
import "server-only";

import { getBranchScopeAction, verifyAdminOrTrainer } from "@/lib/actions/shared";
import { isInBranchScope } from "@/lib/branches/branch-scope";
import { assertTraineeInScope } from "@/lib/actions/shared/assert-trainee";
import { createAdminClient } from "@/lib/supabase/admin";
import type { TablesUpdate } from "@/types/database";
import type { HoldReason } from "../fact-sheet/types";
import { must, type Db } from "../queries/read";
import type { ReportKind } from "../queries/rows";
import { holdReasonsOf, storedSheetOf, type StoredSheet } from "../queries/stored";
import { writerOutputSchema, type WriterOutput } from "../writer/output";

export type ActionResult = { success: true; held?: boolean } | { error: string };

export const STALE_REPORT = "הדוח השתנה, רעננו את הדף";
export const REPORT_NOT_FOUND = "הדוח לא נמצא";
export const ACTION_FAILED = "הפעולה נכשלה, נסו שוב";

export interface StaffCaller {
  db: Db;
  userId: string;
  /** For activity_logs. */
  actorName: string;
}

export interface ActionReport {
  id: string;
  traineeId: string;
  weekStart: string;
  kind: ReportKind;
  status: string;
  branchIds: string[];
  holdReasons: HoldReason[];
  stored: StoredSheet | null;
  playerText: string | null;
  parentText: string | null;
  original: WriterOutput | null;
  drillIds: string[];
  writtenAt: string | null;
  updatedAt: string;
}

/** The signed-in Admin or Trainer, or the reason they may not act. */
export async function staffCaller(): Promise<StaffCaller | { error: string }> {
  const { error, user, profile } = await verifyAdminOrTrainer();
  if (error) return { error };
  const actorName = profile!.full_name?.trim() || (profile!.role === "admin" ? "מנהל" : "מאמן");
  return { db: createAdminClient(), userId: user!.id, actorName };
}

const ACTION_SELECT =
  "id, trainee_id, week_start, kind, status, branch_ids, hold_reasons, fact_sheet, original_output, player_text, parent_text, drill_ids, written_at, updated_at";

const KINDS: readonly ReportKind[] = ["report", "missed_you", "absent"];

/**
 * The row an action works on, once the caller may act on its Trainee and,
 * when the screen sent the version it showed, only while the row is that
 * version.
 */
export async function loadReportForAction(
  db: Db,
  reportId: string,
  version: string | undefined,
): Promise<ActionReport | { error: string }> {
  const row = must(
    "weekly_reports",
    await db.from("weekly_reports").select(ACTION_SELECT).eq("id", reportId).maybeSingle(),
  );
  const kind = KINDS.find((known) => known === row?.kind);
  if (!row || kind === undefined) return { error: REPORT_NOT_FOUND };

  // The rule the queue page applies: the row is in one of the caller's
  // branches and its Trainee is in their scope now. Either alone would let a
  // Trainer act on a report the queue does not show them.
  const scopeResult = await getBranchScopeAction();
  if ("error" in scopeResult) return { error: scopeResult.error };
  if (!isInBranchScope(scopeResult.data.scope, row.branch_ids)) return { error: REPORT_NOT_FOUND };
  const scopeError = await assertTraineeInScope(row.trainee_id);
  if (scopeError) return { error: scopeError };
  if (version !== undefined && Date.parse(version) !== Date.parse(row.updated_at)) return { error: STALE_REPORT };

  const original = writerOutputSchema.safeParse(row.original_output);
  return {
    id: row.id,
    traineeId: row.trainee_id,
    weekStart: row.week_start,
    kind,
    status: row.status,
    branchIds: [...row.branch_ids],
    holdReasons: holdReasonsOf(row.hold_reasons),
    stored: storedSheetOf(row.fact_sheet),
    playerText: row.player_text,
    parentText: row.parent_text,
    original: original.success ? original.data : null,
    drillIds: [...row.drill_ids],
    writtenAt: row.written_at,
    updatedAt: row.updated_at,
  };
}

/**
 * One update, only while the row is still in one of `statuses` and unchanged
 * since it was read. False when it was not: the screen is stale.
 */
export async function updateIfUnchanged(
  db: Db,
  report: Pick<ActionReport, "id" | "updatedAt">,
  statuses: readonly string[],
  values: TablesUpdate<"weekly_reports">,
): Promise<boolean> {
  const { data, error } = await db
    .from("weekly_reports")
    .update(values)
    .eq("id", report.id)
    .in("status", statuses)
    .eq("updated_at", report.updatedAt)
    .select("id");
  if (error) throw new Error(`weekly_reports update failed: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

/** Logs an unexpected failure of an action and gives the calm Hebrew error. */
export function actionFailure(action: string, error: unknown): { error: string } {
  console.error(`[weekly-reports] ${action} failed:`, error instanceof Error ? error.message : error);
  return { error: ACTION_FAILED };
}

/** A failed schema parse as its first message. */
export function firstIssue(error: { issues: readonly { message: string }[] }): { error: string } {
  return { error: error.issues[0]?.message ?? "קלט לא תקין" };
}
