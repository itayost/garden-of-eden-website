/**
 * A Goal proposal as staff see it, in the Goals card and in the queue's
 * "הצעות יעד" tab: the lines the card prints, the stored facts read back, and
 * the grouping by Trainee. Pure: the loaders (queries/views.ts) fill it.
 */
import { z } from "zod";
import { isGoalMetric, type GoalMetric } from "@/features/goals/lib/config/goal-config";
import type { DrillCandidate, HoldReason } from "@/features/weekly-reports/lib/fact-sheet/types";
import { byFullName } from "@/lib/supabase/in-chunks";
import type { CandidateFacts } from "./candidates";

export interface ProposalView {
  id: string;
  traineeId: string;
  fullName: string;
  branchNames: string[];
  /** The Assessment the proposal was made from (YYYY-MM-DD). */
  assessmentDate: string;
  metricKey: string;
  label: string;
  unit: string;
  lowerIsBetter: boolean;
  /** 1 to 3, the model's order of importance. */
  rank: number;
  baseline: number;
  target: number;
  /** The candidate as the model saw it; null when the stored column does not read. */
  facts: CandidateFacts | null;
  /** The model's line for staff; null when the guardrails dropped it. */
  reason: string | null;
  problems: HoldReason[];
  /** The chosen drills, with the book's name and "למה" line. */
  drills: DrillCandidate[];
  /** The row's `updated_at`: every action sends it back and is refused when the row moved on. */
  version: string;
}

export interface TraineeProposals {
  traineeId: string;
  fullName: string;
  branchNames: string[];
  /** The newest Assessment among the Trainee's open proposals. */
  assessmentDate: string;
  proposals: ProposalView[];
}

const goalMetric = z.custom<GoalMetric>((value) => typeof value === "string" && isGoalMetric(value));

/** The shape `CandidateFacts` is stored in; extra fields are dropped. */
const factsSchema = z.object({
  metric_key: goalMetric,
  metric: z.string(),
  unit: z.string(),
  direction: z.string(),
  value: z.number(),
  benchmark: z.number(),
  betterThanPercent: z.number(),
  groupSize: z.number(),
  step: z.number(),
  target: z.number(),
  basis: z.string(),
  positionFit: z.string(),
  drills: z.array(
    z.object({ id: z.string(), name: z.string(), why: z.string().nullable(), parameter: z.string() }),
  ),
});

/**
 * The stored `facts`, checked before it is trusted, as `storedSheetOf` does:
 * a row this code did not write, or wrote under an older shape, reads as
 * missing instead of half a candidate.
 */
export function factsOf(value: unknown): CandidateFacts | null {
  const parsed = factsSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** A number as staff read it: at most 3 decimals, never a float tail. */
function formatNumber(value: number): string {
  return String(Number(value.toFixed(3)));
}

/** "מ-2.1 ל-2.02 שניות". */
export function targetLine(input: { baseline: number; target: number; unit: string }): string {
  return `מ-${formatNumber(input.baseline)} ל-${formatNumber(input.target)} ${input.unit}`;
}

/** "רף הקבוצה 1.92 שניות · טוב מ-30% מהקבוצה". */
export function standingLine(facts: Pick<CandidateFacts, "benchmark" | "unit" | "betterThanPercent">): string {
  return `רף הקבוצה ${formatNumber(facts.benchmark)} ${facts.unit} · טוב מ-${Math.round(facts.betterThanPercent)}% מהקבוצה`;
}

/**
 * Each `sensitive` problem as the card's warning line (Decision 24), each
 * text once: two entries of one day give the same text, and the card keys
 * its lines by it.
 */
export function sensitiveNotes(problems: readonly HoldReason[]): string[] {
  const lines = problems.filter((problem) => problem.code === "sensitive").map((problem) => `שימו לב: ${problem.text}`);
  return [...new Set(lines)];
}

/**
 * Why the reason is missing, from the first problem of the reason itself: a
 * `sensitive` warning is shown apart, and a drill problem removes a drill,
 * not the reason.
 */
export function droppedReasonLine(problems: readonly HoldReason[]): string {
  const cause = problems.find((problem) => problem.code !== "sensitive" && problem.code !== "drill");
  return cause ? `הנימוק הוסר: ${cause.text}` : "הנימוק הוסר";
}

/** The open proposals by Trainee, sorted by name (`byFullName`), each Trainee's proposals by rank. */
export function groupByTrainee(views: readonly ProposalView[]): TraineeProposals[] {
  const groups = new Map<string, ProposalView[]>();
  for (const view of views) groups.set(view.traineeId, [...(groups.get(view.traineeId) ?? []), view]);
  return [...groups.values()]
    .map((proposals): TraineeProposals => {
      const sorted = [...proposals].sort((a, b) => a.rank - b.rank);
      const [first] = sorted;
      return {
        traineeId: first.traineeId,
        fullName: first.fullName,
        branchNames: first.branchNames,
        assessmentDate: sorted.reduce((newest, view) => (view.assessmentDate > newest ? view.assessmentDate : newest), ""),
        proposals: sorted,
      };
    })
    .sort((a, b) => byFullName({ full_name: a.fullName }, { full_name: b.fullName }));
}
