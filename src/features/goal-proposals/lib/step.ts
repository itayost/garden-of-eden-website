/**
 * What the nightly job does with one claimed Assessment. Pure: the decisions
 * live here and are tested; the job (jobs/propose.ts) only reads and writes.
 *
 * Before the model: an Assessment that already has proposals (a run saved
 * them and failed before finishing its check) is finished as proposed and
 * never sent to the model again, so a retry never pays twice or adds a second
 * set. After the model: a failed request leaves the check unfinished for a
 * later night; the guardrails keep the picks that stand, and the Trainee's
 * sensitive Holds go in front of each pick's own problems (Decision 24), so
 * staff see them above the actions. The model never sees those Holds.
 */
import type { HoldReason } from "@/features/weekly-reports/lib/fact-sheet/types";
import type { CandidateFacts } from "./candidates";
import { checkPicks, type CheckedPick } from "./guardrails";
import type { ProposalOutcome } from "./writer/output";

export type StepBefore = { kind: "finish"; outcome: "proposed" | "no_candidates" } | { kind: "ask" };

/**
 * Proposals already saved finish the check as proposed, whatever the
 * candidates are now; else no candidate finishes it as no_candidates; else
 * the model is asked.
 */
export function stepBeforeModel(input: { savedProposals: number; candidates: number }): StepBefore {
  if (input.savedProposals > 0) return { kind: "finish", outcome: "proposed" };
  if (input.candidates === 0) return { kind: "finish", outcome: "no_candidates" };
  return { kind: "ask" };
}

export type StepAfter =
  | { kind: "retry"; reason: string }
  | { kind: "finish"; outcome: "none_picked"; dropped: string[] }
  | { kind: "save"; picks: CheckedPick[]; dropped: string[] };

/**
 * A request that failed is retried on a later night (the check stays
 * unfinished). Otherwise the picks go through checkPicks: none left finishes
 * the check as none_picked; else they are saved, each with the sensitive
 * Holds first and then its own problems. `dropped` is for the log.
 */
export function stepAfterModel(
  outcome: ProposalOutcome,
  candidates: readonly CandidateFacts[],
  sensitive: readonly HoldReason[],
): StepAfter {
  if (!outcome.ok) return { kind: "retry", reason: outcome.reason };
  const { picks, dropped } = checkPicks(candidates, outcome.output);
  if (picks.length === 0) return { kind: "finish", outcome: "none_picked", dropped };
  return {
    kind: "save",
    picks: picks.map((pick) => ({ ...pick, problems: [...sensitive, ...pick.problems] })),
    dropped,
  };
}
