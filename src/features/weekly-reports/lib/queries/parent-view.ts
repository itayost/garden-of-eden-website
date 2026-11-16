/**
 * What the parent's page `/report/[token]` shows: one sent Weekly report, read
 * with the service role after the page verified the signed token. Only a row
 * that is a report and was sent is read; anything else, or a failed read,
 * gives null and the page shows its one notice.
 *
 * The Goals and the body block come from the stored Fact sheet, the drills
 * from the Development book by the report's chosen ids, and the plan box from
 * the Plan queue, read now. None of these go through the model.
 */
import "server-only";

import { readDrillsByIds } from "@/features/development-book/lib/queries/drill-pool";
import { loadPlanQueues } from "@/features/plans/lib/queries";
import { buildRenewalUrl } from "@/features/plans/lib/renewal-link";
import { onlinePaymentsOpen } from "@/lib/payments/online-payments";
import type { BodyFacts, DrillCandidate, FactSheet, GoalFact } from "../fact-sheet/types";
import { fillName, firstNameOf } from "../fill-name";
import type { PlanSummary } from "../report-view";
import type { Db } from "./read";
import { offeredDrillIds, storedSheetOf } from "./stored";

const LOG = "[weekly-reports] parent view";

export interface ParentPlan extends PlanSummary {
  /** `/join?renew=`, only when the Plan renews on the site and payments are open. */
  renewUrl: string | null;
}

export interface ParentView {
  firstName: string;
  weekStart: string;
  /** The parent text with the first name filled in. */
  parentText: string;
  goals: GoalFact[];
  body: BodyFacts | null;
  drills: DrillCandidate[];
  plan: ParentPlan | null;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** The chosen drills, in the report's order; a drill with no name is left out. */
async function readDrills(db: Db, sheet: FactSheet | null, chosen: readonly string[]): Promise<DrillCandidate[]> {
  const ids = sheet ? offeredDrillIds(sheet, chosen) : [];
  if (ids.length === 0) return [];
  try {
    return await readDrillsByIds(db, ids);
  } catch (error) {
    console.error(`${LOG}: drills read failed:`, errorText(error));
    return [];
  }
}

/**
 * Sessions left and the queue's end date, read now. The renewal link names
 * the Plan the queue shows, and is offered only when that Plan was not paid
 * in Arbox (it renews there) and payments on the site are open.
 */
async function readPlan(db: Db, traineeId: string, today: string): Promise<ParentPlan | null> {
  try {
    const view = (await loadPlanQueues(db, [traineeId], today)).get(traineeId);
    if (!view) return null;
    const renewUrl = !view.plan.paidInArbox && onlinePaymentsOpen() ? buildRenewalUrl(view.plan.id) : null;
    return { sessionsLeft: view.sessionsLeft, endsOn: view.endsOn, status: view.status, renewUrl };
  } catch (error) {
    console.error(`${LOG}: plan read failed:`, errorText(error));
    return null;
  }
}

/** The first open, once: a later open finds the stamp and changes nothing. */
async function recordParentOpen(db: Db, reportId: string): Promise<void> {
  const { error } = await db
    .from("weekly_reports")
    .update({ parent_first_opened_at: new Date().toISOString() })
    .eq("id", reportId)
    .is("parent_first_opened_at", null);
  if (error) console.error(`${LOG}: open stamp failed:`, error.message);
}

/**
 * The sent report behind a verified token, or null. `recordOpen` is false for
 * a link preview, which is not the parent reading it.
 */
export async function loadParentView(
  db: Db,
  reportId: string,
  today: string,
  { recordOpen = true }: { recordOpen?: boolean } = {},
): Promise<ParentView | null> {
  const { data: row, error } = await db
    .from("weekly_reports")
    .select(
      "id, trainee_id, week_start, parent_text, fact_sheet, drill_ids, parent_first_opened_at, trainee:profiles!weekly_reports_trainee_id_fkey(full_name)",
    )
    .eq("id", reportId)
    .eq("kind", "report")
    .eq("status", "sent")
    .maybeSingle();
  if (error) {
    console.error(`${LOG}: weekly_reports read failed:`, error.message);
    return null;
  }
  const text = row?.parent_text?.trim();
  if (!row || !text) return null;

  const stored = storedSheetOf(row.fact_sheet);
  const [drills, plan] = await Promise.all([
    readDrills(db, stored?.sheet ?? null, row.drill_ids),
    readPlan(db, row.trainee_id, today),
    recordOpen && row.parent_first_opened_at === null ? recordParentOpen(db, row.id) : Promise.resolve(),
  ]);

  const firstName = firstNameOf(row.trainee?.full_name ?? null);
  return {
    firstName,
    weekStart: row.week_start,
    parentText: fillName(text, firstName),
    goals: stored?.sheet.goals ?? [],
    body: stored?.body ?? null,
    drills,
    plan,
  };
}
