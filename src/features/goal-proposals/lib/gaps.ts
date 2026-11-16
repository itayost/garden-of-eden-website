/**
 * Where a Trainee is behind the age group. Pure: the loaders read the
 * Assessments, these rules compute the group's bar per metric and the gaps.
 *
 * The bar (benchmark) is the upper quartile of the group's current values:
 * each Trainee's latest value of the last year, grouped by the age group they
 * are in today, the 75th percentile when higher is better and the 25th for the
 * timed tests. `age_group_benchmarks` is not used: it holds the best and worst
 * of all-time personal bests, so half the gap to it would aim at the academy
 * record. History keeps values in other units on purpose (jumps of 10 to 80,
 * kick values of 3, 5 and 7), so a value outside half to twice the group
 * median is left out of the bar, and a Trainee's own value outside that band
 * gives no gap.
 */
import type { PositionFit } from "@/features/development-book/lib/drill-candidates";
import { GOAL_METRICS, isLowerBetterMetric, type GoalMetric } from "@/features/goals/lib/config/goal-config";
import type { PhysicalMetricKey } from "@/features/goals/types";
import { resolveAgeGroup } from "@/lib/age-group-override";
import { addDays } from "@/lib/utils/iso-date";
import { calculatePercentile } from "@/lib/utils/math";

/** Fewer plausible values than this give a metric no bar in a group. */
export const MIN_GROUP_VALUES = 8;
/** The bar's quantile when higher is better (one minus it for the timed tests). */
export const BENCHMARK_QUANTILE = 0.75;
/** A Trainee's current value is their latest of this many days. */
export const CURRENT_VALUE_DAYS = 365;

/** A Trainee's profile as the age group rules read it. */
export interface ProfileAges {
  id: string;
  birthdate: string | null;
  age_group_override: string | null;
  age_group_override_until: string | null;
}

/**
 * One Assessment's metric values. The loaders leave out a row with no date and
 * pass a missing `createdAt` as "", so such a row loses a same-date tie.
 */
export interface MetricRow {
  id: string;
  userId: string;
  date: string;
  createdAt: string;
  values: Partial<Record<PhysicalMetricKey, number | null>>;
}

/** A metric of one age group: its bar, its plausible values ascending, its band. */
export interface GroupMetric {
  benchmark: number;
  values: number[];
  band: { low: number; high: number };
}

/** A metric where the Trainee is worse than the group's bar. */
export interface Gap {
  metric: GoalMetric;
  value: number;
  benchmark: number;
  /** The positive distance from the value to the bar. */
  gap: number;
  /** The share of the group the Trainee is better than, 0 to 100. */
  betterThanPercent: number;
  groupSize: number;
  fit: PositionFit;
}

/** Linear interpolation between the closest ranks of a non-empty ascending list. */
export function quantile(sorted: readonly number[], p: number): number {
  const position = (sorted.length - 1) * p;
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (position - lower);
}

const ascending = (a: number, b: number) => a - b;

/** Half to twice the median; null for an empty list. */
export function plausibleBand(values: readonly number[]): { low: number; high: number } | null {
  if (values.length === 0) return null;
  const median = quantile([...values].sort(ascending), 0.5);
  return { low: median / 2, high: median * 2 };
}

/** The group's bar on a metric, or null with fewer than MIN_GROUP_VALUES plausible values. */
export function groupMetric(metric: PhysicalMetricKey, values: readonly number[]): GroupMetric | null {
  const finite = values.filter((value) => Number.isFinite(value));
  const band = plausibleBand(finite);
  if (!band) return null;
  const plausible = finite.filter((value) => value >= band.low && value <= band.high).sort(ascending);
  if (plausible.length < MIN_GROUP_VALUES) return null;
  const p = isLowerBetterMetric(metric) ? 1 - BENCHMARK_QUANTILE : BENCHMARK_QUANTILE;
  return { benchmark: quantile(plausible, p), values: plausible, band };
}

/** Newest first: the later date, then the later `createdAt` ("" loses a tie). */
function newerFirst(a: MetricRow, b: MetricRow): number {
  if (a.date !== b.date) return a.date < b.date ? 1 : -1;
  if (a.createdAt === b.createdAt) return 0;
  return a.createdAt < b.createdAt ? 1 : -1;
}

/** Each Trainee's rows of the last CURRENT_VALUE_DAYS, newest first. */
function recentRowsByTrainee(rows: readonly MetricRow[], today: string): Map<string, MetricRow[]> {
  const from = addDays(today, -CURRENT_VALUE_DAYS);
  const byTrainee = new Map<string, MetricRow[]>();
  for (const row of rows) {
    if (row.date < from || row.date > today) continue;
    byTrainee.set(row.userId, [...(byTrainee.get(row.userId) ?? []), row]);
  }
  return new Map([...byTrainee].map(([id, list]) => [id, [...list].sort(newerFirst)]));
}

function finiteValue(row: MetricRow, metric: PhysicalMetricKey): number | null {
  const value = row.values[metric];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Per age group id, per Goal metric, the bar of the group: each Trainee's
 * latest value of the last year, the Trainee in the group they are in today.
 */
export function groupMetrics(
  profiles: readonly ProfileAges[],
  rows: readonly MetricRow[],
  today: string,
): Map<string, Map<PhysicalMetricKey, GroupMetric>> {
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const valuesByGroup = new Map<string, Map<GoalMetric, number[]>>();
  for (const [traineeId, list] of recentRowsByTrainee(rows, today)) {
    const profile = profileById.get(traineeId);
    const group = profile ? resolveAgeGroup(profile, today) : null;
    if (!group) continue;
    const metrics = valuesByGroup.get(group.id) ?? new Map<GoalMetric, number[]>();
    for (const metric of GOAL_METRICS) {
      const value = list.map((row) => finiteValue(row, metric)).find((v) => v !== null);
      if (value == null) continue;
      metrics.set(metric, [...(metrics.get(metric) ?? []), value]);
    }
    valuesByGroup.set(group.id, metrics);
  }
  const result = new Map<string, Map<PhysicalMetricKey, GroupMetric>>();
  for (const [groupId, metrics] of valuesByGroup) {
    const computed = [...metrics]
      .map(([metric, values]) => [metric, groupMetric(metric, values)] as const)
      .filter((entry): entry is readonly [GoalMetric, GroupMetric] => entry[1] !== null);
    if (computed.length > 0) result.set(groupId, new Map(computed));
  }
  return result;
}

const FIT_ORDER: Record<PositionFit, number> = { position: 0, all: 1, none: 2 };

/** One Goal metric's gap, or null when there is none to propose on. */
function gapOn(
  metric: GoalMetric,
  value: number | null | undefined,
  group: ReadonlyMap<PhysicalMetricKey, GroupMetric>,
  fit: PositionFit,
): Gap | null {
  const bar = group.get(metric);
  if (typeof value !== "number" || !Number.isFinite(value) || !bar) return null;
  if (value < bar.band.low || value > bar.band.high) return null;
  const lowerIsBetter = isLowerBetterMetric(metric);
  const worse = lowerIsBetter ? value > bar.benchmark : value < bar.benchmark;
  if (!worse) return null;
  return {
    metric,
    value,
    benchmark: bar.benchmark,
    gap: Math.abs(value - bar.benchmark),
    betterThanPercent: calculatePercentile(value, bar.values, lowerIsBetter),
    groupSize: bar.values.length,
    fit,
  };
}

/**
 * The Goal metrics where this Assessment is worse than the group's bar,
 * leaving out the excluded ones: metrics that fit the Trainee's position first
 * (then those for every position, then those with no book parameter), then the
 * lowest standing in the group, then the Goal metrics' own order.
 */
export function findGaps(input: {
  values: Partial<Record<PhysicalMetricKey, number | null>>;
  group: ReadonlyMap<PhysicalMetricKey, GroupMetric>;
  fits: ReadonlyMap<string, PositionFit>;
  exclude: ReadonlySet<string>;
}): Gap[] {
  const gaps = GOAL_METRICS.filter((metric) => !input.exclude.has(metric))
    .map((metric) => gapOn(metric, input.values[metric], input.group, input.fits.get(metric) ?? "none"))
    .filter((gap): gap is Gap => gap !== null);
  return [...gaps].sort(
    (a, b) =>
      FIT_ORDER[a.fit] - FIT_ORDER[b.fit] ||
      a.betterThanPercent - b.betterThanPercent ||
      GOAL_METRICS.indexOf(a.metric) - GOAL_METRICS.indexOf(b.metric),
  );
}
