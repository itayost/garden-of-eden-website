/**
 * The Goal candidates the model chooses from. Pure: every number here is the
 * code's (the value, the group's bar, the standing, the step and the target),
 * and the model only picks among them, words a reason and chooses drills.
 * Nothing in a candidate names the Trainee or an Assessment; the only ids are
 * the drills'.
 */
import type { MetricDrill } from "@/features/development-book/lib/drill-candidates";
import type { PositionFit } from "@/features/development-book/lib/drill-candidates";
import {
  METRIC_LABELS_HE,
  METRIC_UNITS,
  isLowerBetterMetric,
  type GoalMetric,
} from "@/features/goals/lib/config/goal-config";
import type { PhysicalMetricKey } from "@/features/goals/types";
import { addDays } from "@/lib/utils/iso-date";
import { REJECTED_QUIET_DAYS } from "./due";
import type { Gap } from "./gaps";
import { TARGET_DECIMALS, roundTo, targetFor, type Target } from "./targets";

/** The model sees at most this many candidates. */
export const MAX_CANDIDATES = 6;
/** The drills offered with each candidate. */
export const OFFERED_DRILLS_PER_GOAL = 5;

/** One candidate Goal as the model sees it. */
export interface CandidateFacts {
  metric_key: GoalMetric;
  /** METRIC_LABELS_HE */
  metric: string;
  /** METRIC_UNITS */
  unit: string;
  /** "נמוך יותר טוב יותר" | "גבוה יותר טוב יותר" */
  direction: string;
  /** This Assessment's value, rounded to TARGET_DECIMALS. */
  value: number;
  /** The group's upper quartile, rounded the same way. */
  benchmark: number;
  betterThanPercent: number;
  groupSize: number;
  step: number;
  target: number;
  /** basisText() */
  basis: string;
  /** "מתאים לעמדה" | "לכל העמדות" | "אין פרמטר בספר" */
  positionFit: string;
  drills: { id: string; name: string; why: string | null; parameter: string }[];
}

const FIT_TEXT: Record<PositionFit, string> = {
  position: "מתאים לעמדה",
  all: "לכל העמדות",
  none: "אין פרמטר בספר",
};

/** How the target was set, in Hebrew. */
export function basisText(target: Target): string {
  return target.basis === "history"
    ? `השיפור של שחקני הקבוצה בין מבדקים בהפרש של 6 עד 12 שבועות (${target.pairs} זוגות)`
    : "חצי מהפער לרף הקבוצה";
}

/**
 * The facts of one gap, or null when it has no target. The target is set from
 * the stated (rounded) value, so value, step and target always add up.
 */
function candidateOf(
  gap: Gap,
  history: readonly number[],
  drills: readonly MetricDrill[],
): CandidateFacts | null {
  const decimals = TARGET_DECIMALS[gap.metric];
  const value = roundTo(gap.value, decimals);
  const target = targetFor({ metric: gap.metric, value, gap: gap.gap, history });
  if (!target) return null;
  return {
    metric_key: gap.metric,
    metric: METRIC_LABELS_HE[gap.metric],
    unit: METRIC_UNITS[gap.metric],
    direction: isLowerBetterMetric(gap.metric) ? "נמוך יותר טוב יותר" : "גבוה יותר טוב יותר",
    value,
    benchmark: roundTo(gap.benchmark, decimals),
    betterThanPercent: gap.betterThanPercent,
    groupSize: gap.groupSize,
    step: target.step,
    target: target.target,
    basis: basisText(target),
    positionFit: FIT_TEXT[gap.fit],
    drills: drills
      .slice(0, OFFERED_DRILLS_PER_GOAL)
      .map((drill) => ({ id: drill.id, name: drill.name, why: drill.why, parameter: drill.parameterName })),
  };
}

/**
 * In the gaps' order, each gap that has a target, with up to
 * OFFERED_DRILLS_PER_GOAL drills; at most MAX_CANDIDATES.
 */
export function proposalCandidates(input: {
  gaps: readonly Gap[];
  history: ReadonlyMap<PhysicalMetricKey, readonly number[]>;
  drills: (metric: string) => readonly MetricDrill[];
}): CandidateFacts[] {
  return input.gaps
    .map((gap) => candidateOf(gap, input.history.get(gap.metric) ?? [], input.drills(gap.metric)))
    .filter((candidate): candidate is CandidateFacts => candidate !== null)
    .slice(0, MAX_CANDIDATES);
}

/** The metrics not to propose: those with an open Goal, and those rejected in the last REJECTED_QUIET_DAYS. */
export function excludedMetrics(input: {
  openGoalMetrics: readonly string[];
  rejected: readonly { metricKey: string; decidedOn: string }[];
  today: string;
}): Set<string> {
  const quietFrom = addDays(input.today, -REJECTED_QUIET_DAYS);
  const recentlyRejected = input.rejected
    .filter((rejection) => rejection.decidedOn >= quietFrom)
    .map((rejection) => rejection.metricKey);
  return new Set([...input.openGoalMetrics, ...recentlyRejected]);
}
