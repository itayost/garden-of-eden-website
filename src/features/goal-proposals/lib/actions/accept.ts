"use server";

import { isGoalMetric, isLowerBetterMetric } from "@/features/goals/lib/config/goal-config";
import { goalRefusal } from "@/features/goals/lib/utils/goal-rules";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { acceptProposalSchema, type AcceptProposalInput } from "@/lib/validations/goal-proposals";
import { ACCEPT_FAILED, acceptErrorMessage } from "../accept-errors";
import {
  firstIssue,
  loadProposalForAction,
  PROPOSAL_DECIDED,
  revalidateProposals,
  type ProposalActionResult,
} from "./proposal-action";

/**
 * קבל, or שנה יעד with the target staff typed: the Goal is written and the
 * proposal closed together by `accept_goal_proposal`, which checks again that
 * the proposal is open at the version the screen showed and that its
 * Assessment was not deleted. The target passes the rules `setGoal()` uses
 * (`goalRefusal`) first; the baseline is always the proposal's.
 */
export async function acceptGoalProposalAction(input: AcceptProposalInput): Promise<ProposalActionResult> {
  const { error, user } = await verifyAdminOrTrainer();
  if (error) return { error };
  const parsed = acceptProposalSchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);

  try {
    const db = createAdminClient();
    const proposal = await loadProposalForAction(db, parsed.data.proposalId, parsed.data.version);
    if ("error" in proposal) return proposal;
    if (proposal.status !== "proposed") return { error: PROPOSAL_DECIDED };

    const metric = proposal.metricKey;
    const target = parsed.data.target ?? proposal.target;
    const refusal = goalRefusal({ metricKey: metric, targetValue: target, baselineValue: proposal.baseline });
    if (refusal || !isGoalMetric(metric)) return { error: refusal ?? "מדד לא תקין" };

    const { error: acceptError } = await db.rpc("accept_goal_proposal", {
      p_proposal_id: proposal.id,
      p_expected_updated_at: proposal.updatedAt,
      p_target: target,
      p_is_lower_better: isLowerBetterMetric(metric),
      p_actor: user!.id,
    });
    if (acceptError) {
      console.error("[goal-proposals] accept failed:", acceptError.message);
      return { error: acceptErrorMessage(acceptError) };
    }
    revalidateProposals(proposal.traineeId);
    return { success: true };
  } catch (failure) {
    console.error("[goal-proposals] accept failed:", failure instanceof Error ? failure.message : failure);
    return { error: ACCEPT_FAILED };
  }
}
