import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlayerAssessment } from "@/types/assessment";
import { getAgeGroup, isLowerBetter } from "@/types/assessment";
import type { CalculatedRatings, GroupStats } from "@/lib/assessment-to-rating";
import {
  calculateCardRatings,
  calculateNeutralRatings,
} from "@/lib/assessment-to-rating";
import { NUMERIC_METRIC_KEYS } from "./assessment-metrics";
import { fetchGroupStats } from "./fetch-benchmarks";

export interface PlayerRatingsResult {
  readonly ratings: CalculatedRatings;
  readonly groupStats: GroupStats | null;
}

/**
 * Compute a synthetic "personal best" assessment from all of a player's assessments.
 * For each metric, picks the best value across ALL assessments:
 * - Sprints (lower is better): MIN
 * - Everything else (higher is better): MAX
 * Categorical and metadata fields come from the latest assessment.
 */
export function computePersonalBests(
  assessments: readonly PlayerAssessment[]
): PlayerAssessment {
  if (assessments.length === 0) {
    throw new Error("computePersonalBests requires at least one assessment");
  }

  // Find latest assessment for categorical/metadata fields
  const latest = assessments.reduce((best, a) =>
    new Date(a.assessment_date).getTime() > new Date(best.assessment_date).getTime() ? a : best
  );

  // Build metric overrides immutably
  const overrides: Partial<Record<string, number | null>> = {};

  for (const metric of NUMERIC_METRIC_KEYS) {
    const values = assessments
      .map((a) => a[metric])
      .filter((v): v is number => v !== null && v !== undefined);

    if (values.length === 0) {
      overrides[metric] = null;
      continue;
    }

    overrides[metric] = isLowerBetter(metric)
      ? Math.min(...values)
      : Math.max(...values);
  }

  return { ...latest, ...overrides } as PlayerAssessment;
}

/**
 * Calculate EA FC-style ratings for a player using personal bests
 * and pre-computed age group benchmarks.
 *
 * Returns both ratings and groupStats so consumers don't need to
 * fetch groupStats separately.
 *
 * Returns neutral ratings (50) if no group comparison available.
 */
export async function getPlayerRatings(
  supabase: SupabaseClient,
  assessments: readonly PlayerAssessment[],
  birthdate: string | null
): Promise<PlayerRatingsResult> {
  if (assessments.length === 0) {
    return { ratings: calculateNeutralRatings(), groupStats: null };
  }

  const personalBests = computePersonalBests(assessments);
  const ageGroup = getAgeGroup(birthdate);

  if (!ageGroup) {
    return { ratings: calculateNeutralRatings(), groupStats: null };
  }

  const groupStats = await fetchGroupStats(supabase, ageGroup.id);

  if (!groupStats) {
    return { ratings: calculateNeutralRatings(), groupStats: null };
  }

  return {
    ratings: calculateCardRatings(personalBests, groupStats),
    groupStats,
  };
}
