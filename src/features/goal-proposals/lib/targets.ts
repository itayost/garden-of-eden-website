/**
 * A realistic target from the academy's own history. Pure.
 *
 * A history pair is one Assessment and the earliest later Assessment of the
 * same Trainee 42 to 84 days after it, both with the metric, grouped by the
 * age group at the first one's date. With enough pairs in the Trainee's group,
 * the step is half the gap to the group's bar held inside the 60th to 75th
 * percentile of those improvements; with fewer, it is half the gap. A metric
 * whose 75th percentile improvement is not positive gets no target: the
 * academy's history says it does not move in 6 to 12 weeks. Only the stored
 * current age group override is known, so a past pair of an overridden Trainee
 * is grouped by today's override while it lasts.
 */
import { GOAL_METRICS, isLowerBetterMetric, type GoalMetric } from "@/features/goals/lib/config/goal-config";
import type { PhysicalMetricKey } from "@/features/goals/types";
import { resolveAgeGroup } from "@/lib/age-group-override";
import { addDays, daysBetween } from "@/lib/utils/iso-date";
import { quantile, type MetricRow, type ProfileAges } from "./gaps";

export const PAIR_MIN_DAYS = 42;
export const PAIR_MAX_DAYS = 84;
/** Fewer pairs than this in the group fall back to half the gap. */
export const MIN_PAIRS = 20;
export const HISTORY_LOW = 0.6;
export const HISTORY_HIGH = 0.75;
/** History is read for this many days back. */
export const HISTORY_DAYS = 730;
/** A pair whose two values differ by more than this factor mixes units and is dropped. */
export const PAIR_MAX_FACTOR = 2;

/** How a metric's step and target are rounded. */
export const TARGET_DECIMALS: Record<GoalMetric, number> = {
  sprint_5m: 2,
  sprint_10m: 2,
  sprint_20m: 2,
  jump_2leg_distance: 0,
  jump_2leg_height: 0,
  jump_right_leg: 0,
  jump_left_leg: 0,
  blaze_spot_time: 0,
  flexibility_ankle: 1,
  flexibility_knee: 1,
  flexibility_hip: 1,
  kick_power_right_foot: 0,
  kick_power_left_foot: 0,
  shuffle_10m: 2,
  sprint_10m_h: 2,
  sprint_10m_h_ball: 2,
  envelope: 2,
  envelope_ball: 2,
};

export interface Target {
  step: number;
  target: number;
  basis: "history" | "half_gap";
  /** The history pairs the step was read from. */
  pairs: number;
}

export function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

interface Measured {
  date: string;
  createdAt: string;
  value: number;
}

/** Each Trainee's rows that have the metric, oldest first. */
function measuredByTrainee(rows: readonly MetricRow[], metric: PhysicalMetricKey): Map<string, Measured[]> {
  const byTrainee = new Map<string, Measured[]>();
  for (const row of rows) {
    const value = row.values[metric];
    if (typeof value !== "number" || !Number.isFinite(value)) continue;
    const measured = { date: row.date, createdAt: row.createdAt, value };
    byTrainee.set(row.userId, [...(byTrainee.get(row.userId) ?? []), measured]);
  }
  const oldestFirst = (a: Measured, b: Measured) =>
    a.date === b.date ? a.createdAt.localeCompare(b.createdAt) : a.date < b.date ? -1 : 1;
  return new Map([...byTrainee].map(([id, list]) => [id, [...list].sort(oldestFirst)]));
}

function inPairWindow(from: string, to: string): boolean {
  const days = daysBetween(from, to);
  return days >= PAIR_MIN_DAYS && days <= PAIR_MAX_DAYS;
}

function plausiblePair(a: number, b: number): boolean {
  if (a <= 0 || b <= 0) return false;
  return Math.max(a, b) <= PAIR_MAX_FACTOR * Math.min(a, b);
}

/**
 * Every age group id to the improvements of its history pairs on one metric,
 * direction-adjusted (positive is better), grouped by the age group at the
 * first Assessment's date. A Trainee with no profile or no group adds nothing.
 */
export function improvementPairs(
  profiles: readonly ProfileAges[],
  rows: readonly MetricRow[],
  metric: PhysicalMetricKey,
): Map<string, number[]> {
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const lowerIsBetter = isLowerBetterMetric(metric);
  const result = new Map<string, number[]>();
  for (const [traineeId, list] of measuredByTrainee(rows, metric)) {
    const profile = profileById.get(traineeId);
    if (!profile) continue;
    list.forEach((earlier, index) => {
      const later = list.slice(index + 1).find((next) => inPairWindow(earlier.date, next.date));
      if (!later || !plausiblePair(earlier.value, later.value)) return;
      const group = resolveAgeGroup(profile, new Date(`${earlier.date}T12:00:00Z`));
      if (!group) return;
      const improvement = lowerIsBetter ? earlier.value - later.value : later.value - earlier.value;
      result.set(group.id, [...(result.get(group.id) ?? []), improvement]);
    });
  }
  return result;
}

/** Per age group id, per Goal metric, the improvements of the last HISTORY_DAYS. */
export function historyByGroup(
  profiles: readonly ProfileAges[],
  rows: readonly MetricRow[],
  today: string,
): Map<string, Map<PhysicalMetricKey, number[]>> {
  const from = addDays(today, -HISTORY_DAYS);
  const recent = rows.filter((row) => row.date >= from && row.date <= today);
  const result = new Map<string, Map<PhysicalMetricKey, number[]>>();
  for (const metric of GOAL_METRICS) {
    for (const [groupId, improvements] of improvementPairs(profiles, recent, metric)) {
      const metrics = new Map(result.get(groupId) ?? []);
      result.set(groupId, metrics.set(metric, improvements));
    }
  }
  return result;
}

/**
 * Half the gap held inside the 60th to 75th percentile of the improvements
 * (never below one rounding unit), or null when the 75th is not positive.
 */
function historyStep(gap: number, history: readonly number[], unit: number): number | null {
  const sorted = [...history].sort((a, b) => a - b);
  const low = quantile(sorted, HISTORY_LOW);
  const high = quantile(sorted, HISTORY_HIGH);
  if (high <= 0) return null;
  return Math.min(Math.max(gap / 2, Math.max(low, unit)), high);
}

/**
 * The step and target for a gap, or null when the history says the metric
 * does not move, or the step rounds to nothing, or the target is not positive.
 */
export function targetFor(input: {
  metric: GoalMetric;
  value: number;
  gap: number;
  history: readonly number[];
}): Target | null {
  const decimals = TARGET_DECIMALS[input.metric];
  const unit = 10 ** -decimals;
  const fromHistory = input.history.length >= MIN_PAIRS;
  const rawStep = fromHistory ? historyStep(input.gap, input.history, unit) : input.gap / 2;
  if (rawStep === null) return null;
  const step = roundTo(rawStep, decimals);
  if (step < unit) return null;
  const lowerIsBetter = isLowerBetterMetric(input.metric);
  const target = roundTo(lowerIsBetter ? input.value - step : input.value + step, decimals);
  if (target <= 0) return null;
  return { step, target, basis: fromHistory ? "history" : "half_gap", pairs: input.history.length };
}
