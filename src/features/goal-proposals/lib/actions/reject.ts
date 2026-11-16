"use server";

import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { rejectProposalSchema, type RejectProposalInput } from "@/lib/validations/goal-proposals";
import {
  firstIssue,
  loadProposalForAction,
  PROPOSAL_DECIDED,
  revalidateProposals,
  STALE_PROPOSAL,
  updateProposalIfUnchanged,
  type ProposalActionResult,
} from "./proposal-action";

/**
 * דחה, with an optional reason: the proposal closes, and its metric is not
 * proposed again for the next 60 days (REJECTED_QUIET_DAYS).
 */
export async function rejectGoalProposalAction(input: RejectProposalInput): Promise<ProposalActionResult> {
  const { error, user } = await verifyAdminOrTrainer();
  if (error) return { error };
  const parsed = rejectProposalSchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);

  try {
    const db = createAdminClient();
    const proposal = await loadProposalForAction(db, parsed.data.proposalId, parsed.data.version);
    if ("error" in proposal) return proposal;
    if (proposal.status !== "proposed") return { error: PROPOSAL_DECIDED };

    const updated = await updateProposalIfUnchanged(db, proposal, {
      status: "rejected",
      decided_by: user!.id,
      decided_at: new Date().toISOString(),
      reject_reason: parsed.data.reason,
    });
    if (!updated) return { error: STALE_PROPOSAL };
    revalidateProposals(proposal.traineeId);
    return { success: true };
  } catch (failure) {
    console.error("[goal-proposals] reject failed:", failure instanceof Error ? failure.message : failure);
    return { error: "דחיית ההצעה נכשלה, נסו שוב" };
  }
}
