/**
 * What the two Goal proposal actions share: the row read, the scope check,
 * the one conditional update that refuses a stale screen, and the pages to
 * refresh. Server-only helpers, not server actions.
 *
 * Order in each action: verifyAdminOrTrainer(), the schema (the id and the
 * required version), the row read, the row's `branch_ids` against the
 * caller's scope (`isInBranchScope`) and `assertTraineeInScope(trainee_id)`,
 * the version against `updated_at`, then a change guarded on the status
 * `proposed` and on the `updated_at` it read. The rule the loaders apply, so
 * a Trainer never acts on a proposal the tab and the card do not show them.
 */
import "server-only";

import { revalidatePath } from "next/cache";
import { getBranchScopeAction } from "@/lib/actions/shared";
import { assertTraineeInScope } from "@/lib/actions/shared/assert-trainee";
import { isInBranchScope } from "@/lib/branches/branch-scope";
import type { TablesUpdate } from "@/types/database";
import { must, type Db } from "@/features/weekly-reports/lib/queries/read";

export type ProposalActionResult = { success: true } | { error: string };

export const PROPOSAL_NOT_FOUND = "ההצעה לא נמצאה";
export const STALE_PROPOSAL = "ההצעה השתנתה, רעננו את הדף";
export const PROPOSAL_DECIDED = "ההצעה כבר טופלה";

export interface ActionProposal {
  id: string;
  traineeId: string;
  branchIds: string[];
  metricKey: string;
  status: string;
  baseline: number;
  target: number;
  /** As read; the change is made only while the row still has it. */
  updatedAt: string;
}

const ACTION_SELECT = "id, trainee_id, branch_ids, metric_key, status, baseline_value, target_value, updated_at";

/**
 * The proposal an action works on, once the caller may act on it and only
 * while it is the version the screen showed.
 */
export async function loadProposalForAction(
  db: Db,
  proposalId: string,
  version: string,
): Promise<ActionProposal | { error: string }> {
  const row = must(
    "goal_proposals",
    await db.from("goal_proposals").select(ACTION_SELECT).eq("id", proposalId).maybeSingle(),
  );
  if (!row) return { error: PROPOSAL_NOT_FOUND };

  // The row is in one of the caller's branches and its Trainee is in their
  // scope now: either alone would let a Trainer act on a proposal the lists
  // do not show them.
  const scopeResult = await getBranchScopeAction();
  if ("error" in scopeResult) return { error: scopeResult.error };
  if (!isInBranchScope(scopeResult.data.scope, row.branch_ids)) return { error: PROPOSAL_NOT_FOUND };
  const scopeError = await assertTraineeInScope(row.trainee_id);
  if (scopeError) return { error: scopeError };
  if (Date.parse(version) !== Date.parse(row.updated_at)) return { error: STALE_PROPOSAL };

  return {
    id: row.id,
    traineeId: row.trainee_id,
    branchIds: [...row.branch_ids],
    metricKey: row.metric_key,
    status: row.status,
    baseline: row.baseline_value,
    target: row.target_value,
    updatedAt: row.updated_at,
  };
}

/**
 * One update, only while the proposal is still open and unchanged since it
 * was read. False when it was not: the screen is stale.
 */
export async function updateProposalIfUnchanged(
  db: Db,
  proposal: Pick<ActionProposal, "id" | "updatedAt">,
  values: TablesUpdate<"goal_proposals">,
): Promise<boolean> {
  const { data, error } = await db
    .from("goal_proposals")
    .update(values)
    .eq("id", proposal.id)
    .eq("status", "proposed")
    .eq("updated_at", proposal.updatedAt)
    .select("id");
  if (error) throw new Error(`goal_proposals update failed: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

/** The pages that show the Trainee's proposals or Goals. */
export function revalidateProposals(traineeId: string): void {
  revalidatePath("/admin/weekly-reports");
  revalidatePath(`/admin/assessments/${traineeId}`);
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/assessments");
}

/** A failed schema parse as its first message. */
export function firstIssue(error: { issues: readonly { message: string }[] }): { error: string } {
  return { error: error.issues[0]?.message ?? "קלט לא תקין" };
}
