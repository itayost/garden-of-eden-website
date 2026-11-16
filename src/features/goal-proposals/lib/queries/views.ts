/**
 * The open Goal proposals staff see, through the service role: every open
 * proposal in the caller's scope for the queue's "הצעות יעד" tab, and one
 * Trainee's for the Goals card. Both apply the same rules, so the card never
 * shows a proposal that the tab hides and every action would refuse:
 *
 * - the row's `branch_ids` meet the caller's branches (in the query), and its
 *   Trainee is in one of them now (`inTraineeScope`), never left to RLS (the
 *   table has no policies);
 * - a proposal whose Assessment was soft-deleted is left out at once; the
 *   nightly run only expires it later, and `accept_goal_proposal` refuses it.
 */
import "server-only";

import { readDrillsByIds } from "@/features/development-book/lib/queries/drill-pool";
import { METRIC_LABELS_HE, METRIC_UNITS, isGoalMetric, isLowerBetterMetric } from "@/features/goals/lib/config/goal-config";
import type { DrillCandidate } from "@/features/weekly-reports/lib/fact-sheet/types";
import { must, unique, type Db } from "@/features/weekly-reports/lib/queries/read";
import { inTraineeScope } from "@/features/weekly-reports/lib/queries/scope";
import { holdReasonsOf } from "@/features/weekly-reports/lib/queries/stored";
import { readAllPages } from "@/lib/supabase/in-chunks";
import type { Tables } from "@/types/database";
import { factsOf, type ProposalView } from "../proposal-view";

export interface OpenProposalsQuery {
  /** The caller's branches; null for an Admin, who sees every proposal. */
  scopeBranchIds: readonly string[] | null;
  /** The branch picked in the filter, already checked against the scope. */
  filterBranchId?: string;
}

const VIEW_SELECT =
  "id, trainee_id, branch_ids, metric_key, rank, baseline_value, target_value, facts, reason, problems, drill_ids, updated_at, assessment:player_assessments!goal_proposals_assessment_id_fkey(assessment_date, deleted_at), trainee:profiles!goal_proposals_trainee_id_fkey(full_name)";

/** A row of VIEW_SELECT. */
type ViewRow = Pick<
  Tables<"goal_proposals">,
  | "id"
  | "trainee_id"
  | "branch_ids"
  | "metric_key"
  | "rank"
  | "baseline_value"
  | "target_value"
  | "facts"
  | "reason"
  | "problems"
  | "drill_ids"
  | "updated_at"
> & {
  assessment: { assessment_date: string | null; deleted_at: string | null } | null;
  trainee: { full_name: string | null } | null;
};

/** The open proposals whose rows meet the caller's branches (null: an Admin, every row). */
function openProposals(db: Db, scopeBranchIds: readonly string[] | null) {
  const base = db.from("goal_proposals").select(VIEW_SELECT).eq("status", "proposed");
  return scopeBranchIds === null ? base : base.overlaps("branch_ids", [...scopeBranchIds]);
}

/** Branch names by id, in display order; a branch that is gone is left out. */
async function readBranchNames(db: Db, ids: readonly string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const rows =
    must("branches", await db.from("branches").select("id, name_he, order_index").in("id", unique(ids))) ?? [];
  return new Map([...rows].sort((a, b) => a.order_index - b.order_index).map((row) => [row.id, row.name_he]));
}

function namesOf(branchIds: readonly string[], names: ReadonlyMap<string, string>): string[] {
  return [...names].filter(([id]) => branchIds.includes(id)).map(([, name]) => name);
}

interface ViewContext {
  names: ReadonlyMap<string, string>;
  drills: ReadonlyMap<string, DrillCandidate>;
}

/** A row as the card shows it, or null for a metric that is not a Goal metric (logged; the CHECK forbids it). */
function toView(row: ViewRow, context: ViewContext): ProposalView | null {
  const metric = row.metric_key;
  if (!isGoalMetric(metric)) {
    console.error(`[goal-proposals] proposal ${row.id} has an unknown metric: ${metric}`);
    return null;
  }
  return {
    id: row.id,
    traineeId: row.trainee_id,
    fullName: row.trainee?.full_name?.trim() || "ללא שם",
    branchNames: namesOf(row.branch_ids, context.names),
    assessmentDate: row.assessment?.assessment_date ?? "",
    metricKey: metric,
    label: METRIC_LABELS_HE[metric],
    unit: METRIC_UNITS[metric],
    lowerIsBetter: isLowerBetterMetric(metric),
    rank: row.rank,
    baseline: row.baseline_value,
    target: row.target_value,
    facts: factsOf(row.facts),
    reason: row.reason,
    problems: holdReasonsOf(row.problems),
    drills: row.drill_ids.flatMap((id) => {
      const drill = context.drills.get(id);
      return drill ? [drill] : [];
    }),
    version: row.updated_at,
  };
}

/**
 * The rows the caller may see as views: a soft-deleted Assessment's left
 * out, the Trainee in scope now, with branch names and drills joined.
 */
async function toViews(db: Db, rows: ViewRow[], scopeBranchIds: readonly string[] | null): Promise<ProposalView[]> {
  const live = rows.filter((row) => row.assessment !== null && row.assessment.deleted_at === null);
  const visible = await inTraineeScope(db, live, scopeBranchIds);
  if (visible.length === 0) return [];
  const [names, drills] = await Promise.all([
    readBranchNames(db, visible.flatMap((row) => row.branch_ids)),
    readDrillsByIds(db, visible.flatMap((row) => row.drill_ids)),
  ]);
  const context: ViewContext = { names, drills: new Map(drills.map((drill) => [drill.id, drill])) };
  return visible.flatMap((row) => {
    const view = toView(row, context);
    return view === null ? [] : [view];
  });
}

/** Every open proposal in the caller's scope, filtered by the picked branch, for the queue's tab. */
export async function loadOpenProposals(db: Db, query: OpenProposalsQuery): Promise<ProposalView[]> {
  if (query.scopeBranchIds !== null && query.scopeBranchIds.length === 0) return [];
  const rows = must(
    "goal_proposals",
    await readAllPages(() => {
      const scoped = openProposals(db, query.scopeBranchIds);
      const filtered = query.filterBranchId ? scoped.contains("branch_ids", [query.filterBranchId]) : scoped;
      return filtered.order("id");
    }),
  );
  return toViews(db, rows, query.scopeBranchIds);
}

/** One Trainee's open proposals the caller may see, for the Goals card. */
export async function loadTraineeProposals(
  db: Db,
  traineeId: string,
  scopeBranchIds: readonly string[] | null,
): Promise<ProposalView[]> {
  if (scopeBranchIds !== null && scopeBranchIds.length === 0) return [];
  const rows = must(
    "goal_proposals",
    await openProposals(db, scopeBranchIds).eq("trainee_id", traineeId).order("rank").order("id"),
  );
  return toViews(db, rows ?? [], scopeBranchIds);
}
