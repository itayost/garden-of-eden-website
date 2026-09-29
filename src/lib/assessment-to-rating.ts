/**
 * Assessment to EA FC Rating Conversion
 *
 * Converts physical test results to EA FC-style 0-99 ratings.
 * Ratings are relative within age groups:
 * - Best performer in group = 99
 * - Others scaled relative to best (percentile-based)
 */

import type { PlayerAssessment, CoordinationLevel, BodyStructure, LegPowerTechnique } from "@/types/assessment";
import { DRIBBLING_TEST_KEYS } from "@/types/assessment";
import type { NumericMetricKey } from "@/lib/utils/assessment-metrics";

// ===========================================
// RATING CALCULATION FUNCTIONS
// ===========================================

/**
 * Calculate rating for "lower is better" tests (sprints, reaction time)
 * Best (lowest) value in group gets 99, worst gets 30
 */
export function calculateRatingLowerBetter(
  value: number | null,
  bestInGroup: number,
  worstInGroup: number
): number | null {
  if (value === null || value === undefined) return null;
  // Handle sentinel value (-1) indicating no group data
  if (bestInGroup < 0 || worstInGroup < 0) return null;
  if (bestInGroup === worstInGroup) return 99; // Only one player or same values

  if (value <= bestInGroup) return 99;
  if (value >= worstInGroup) return 30;

  const range = worstInGroup - bestInGroup;
  if (range === 0) return 99; // Extra safety check
  const position = (value - bestInGroup) / range;
  return Math.round(99 - position * 69); // Scale 30-99
}

/**
 * Calculate rating for "higher is better" tests (jumps, kick power)
 * Best (highest) value in group gets 99, worst gets 30
 */
export function calculateRatingHigherBetter(
  value: number | null,
  bestInGroup: number,
  worstInGroup: number
): number | null {
  if (value === null || value === undefined) return null;
  // Handle sentinel value (-1) indicating no group data
  if (bestInGroup < 0 || worstInGroup < 0) return null;
  if (bestInGroup === worstInGroup) return 99;

  if (value >= bestInGroup) return 99;
  if (value <= worstInGroup) return 30;

  const range = bestInGroup - worstInGroup;
  if (range === 0) return 99; // Extra safety check
  const position = (bestInGroup - value) / range;
  return Math.round(99 - position * 69); // Scale 30-99
}

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/**
 * Filter assessments to only the latest one per user
 * Used for calculating group stats based on current ability, not historical best
 */
export function getLatestAssessmentsPerUser(assessments: readonly PlayerAssessment[]): PlayerAssessment[] {
  const latestByUser = new Map<string, PlayerAssessment>();

  for (const assessment of assessments) {
    const existing = latestByUser.get(assessment.user_id);
    if (!existing || new Date(assessment.assessment_date) > new Date(existing.assessment_date)) {
      latestByUser.set(assessment.user_id, assessment);
    }
  }

  return Array.from(latestByUser.values());
}

// ===========================================
// GROUP STATISTICS
// ===========================================

/** Best and worst value of every numeric test within an age group. */
export type GroupStats = Record<NumericMetricKey, { best: number; worst: number }>;

// ===========================================
// CATEGORICAL BONUSES
// ===========================================

function getCoordinationBonus(coordination: CoordinationLevel | null): number {
  switch (coordination) {
    case "advanced":
      return 15;
    case "basic":
      return 0;
    case "deficient":
      return -15;
    default:
      return 0;
  }
}

function getBodyStructureBonus(bodyStructure: BodyStructure | null): number {
  switch (bodyStructure) {
    case "strong_athletic":
      return 15;
    case "good_build":
      return 5;
    case "thin_weak":
      return -10;
    default:
      return 0;
  }
}

function getLegPowerBonus(legPower: LegPowerTechnique | null): number {
  switch (legPower) {
    case "normal":
      return 5;
    case "deficient":
      return -10;
    default:
      return 0;
  }
}

// ===========================================
// EA FC CARD STAT CALCULATION
// ===========================================

export interface CalculatedRatings {
  pace: number | null;
  shooting: number | null;
  passing: number | null;
  dribbling: number | null;
  defending: number | null;
  physical: number | null;
  overall_rating: number | null;
}

type StatKey = keyof Omit<CalculatedRatings, "overall_rating">;
type NumericMetric = keyof GroupStats;
type BonusFn = (a: PlayerAssessment) => number;

interface PrimaryInput {
  metric: NumericMetric;
  lowerBetter: boolean;
}

interface StatConfig {
  primary: readonly PrimaryInput[];
  bonuses?: readonly BonusFn[];
}

/**
 * Single source of truth for which raw tests feed each card stat.
 *
 * Rule: each numeric metric appears as a `primary` input for EXACTLY ONE stat
 * so a single test never produces two card numbers. Categorical bonuses
 * (coordination / body / leg power) modify the base but cannot create a
 * rating on their own — if all `primary` inputs are null, the stat is null.
 */
export const CARD_STAT_CONFIG: Readonly<Record<StatKey, StatConfig>> = {
  pace: {
    primary: [
      { metric: "sprint_5m", lowerBetter: true },
      { metric: "sprint_10m", lowerBetter: true },
      { metric: "sprint_20m", lowerBetter: true },
    ],
  },
  physical: {
    primary: [
      { metric: "jump_2leg_distance", lowerBetter: false },
      { metric: "jump_2leg_height", lowerBetter: false },
      { metric: "jump_right_leg", lowerBetter: false },
      { metric: "jump_left_leg", lowerBetter: false },
    ],
    bonuses: [(a) => getBodyStructureBonus(a.body_structure)],
  },
  shooting: {
    primary: [
      { metric: "kick_power_right_foot", lowerBetter: false },
      { metric: "kick_power_left_foot", lowerBetter: false },
    ],
    bonuses: [(a) => getLegPowerBonus(a.leg_power_technique)],
  },
  defending: {
    primary: [
      { metric: "flexibility_ankle", lowerBetter: false },
      { metric: "flexibility_knee", lowerBetter: false },
      { metric: "flexibility_hip", lowerBetter: false },
    ],
    bonuses: [(a) => getBodyStructureBonus(a.body_structure)],
  },
  dribbling: {
    primary: [
      ...DRIBBLING_TEST_KEYS.map((metric) => ({ metric, lowerBetter: true })),
    ],
    bonuses: [(a) => getCoordinationBonus(a.coordination)],
  },
  passing: {
    primary: [{ metric: "blaze_spot_time", lowerBetter: false }],
    bonuses: [(a) => getCoordinationBonus(a.coordination)],
  },
};

const STAT_KEYS = Object.keys(CARD_STAT_CONFIG) as StatKey[];

function avgOrNull(values: readonly (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v !== null);
  if (valid.length === 0) return null;
  return Math.round(valid.reduce((sum, v) => sum + v, 0) / valid.length);
}

function clampOrNull(value: number | null): number | null {
  return value === null ? null : Math.max(1, Math.min(99, value));
}

function ratePrimary(
  assessment: PlayerAssessment,
  groupStats: GroupStats,
  input: PrimaryInput
): number | null {
  const value = assessment[input.metric] as number | null;
  const { best, worst } = groupStats[input.metric];
  return input.lowerBetter
    ? calculateRatingLowerBetter(value, best, worst)
    : calculateRatingHigherBetter(value, best, worst);
}

function computeStat(
  assessment: PlayerAssessment,
  groupStats: GroupStats,
  config: StatConfig
): number | null {
  const base = avgOrNull(config.primary.map((p) => ratePrimary(assessment, groupStats, p)));
  if (base === null) return null;
  const bonusTotal = (config.bonuses ?? []).reduce((sum, fn) => sum + fn(assessment), 0);
  return clampOrNull(base + bonusTotal);
}

/**
 * Calculate EA FC card ratings from a single assessment, using age-group
 * statistics for relative comparison. Driven by CARD_STAT_CONFIG above.
 */
export function calculateCardRatings(
  assessment: PlayerAssessment,
  groupStats: GroupStats
): CalculatedRatings {
  const stats = STAT_KEYS.reduce(
    (acc, key) => {
      acc[key] = computeStat(assessment, groupStats, CARD_STAT_CONFIG[key]);
      return acc;
    },
    {} as Record<StatKey, number | null>
  );

  return {
    ...stats,
    overall_rating: avgOrNull(STAT_KEYS.map((k) => stats[k])),
  };
}

/**
 * Return null ratings when there's insufficient comparison data.
 * Consumers should display a "not yet rated" placeholder rather than a number.
 */
export function calculateNeutralRatings(): CalculatedRatings {
  return {
    pace: null,
    shooting: null,
    passing: null,
    dribbling: null,
    defending: null,
    physical: null,
    overall_rating: null,
  };
}
