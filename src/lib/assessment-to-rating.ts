/**
 * Assessment to EA FC Rating Conversion
 *
 * Converts physical test results to EA FC-style 0-99 ratings.
 * Ratings are relative within age groups:
 * - Best performer in group = 99
 * - Others scaled relative to best (percentile-based)
 */

import type { PlayerAssessment, CoordinationLevel, BodyStructure, LegPowerTechnique } from "@/types/assessment";

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
export function getLatestAssessmentsPerUser(assessments: PlayerAssessment[]): PlayerAssessment[] {
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

export interface GroupStats {
  sprint_5m: { best: number; worst: number };
  sprint_10m: { best: number; worst: number };
  sprint_20m: { best: number; worst: number };
  jump_2leg_distance: { best: number; worst: number };
  jump_right_leg: { best: number; worst: number };
  jump_left_leg: { best: number; worst: number };
  jump_2leg_height: { best: number; worst: number };
  blaze_spot_time: { best: number; worst: number };
  flexibility_ankle: { best: number; worst: number };
  flexibility_knee: { best: number; worst: number };
  flexibility_hip: { best: number; worst: number };
  kick_power_kaiser: { best: number; worst: number };
}

/**
 * Calculate best/worst values for each test from a group of assessments
 */
export function calculateGroupStats(assessments: PlayerAssessment[]): GroupStats {
  const getMinMax = (values: (number | null)[], lowerIsBetter: boolean) => {
    const validValues = values.filter((v): v is number => v !== null && v !== undefined && !isNaN(v));
    if (validValues.length === 0) {
      // Return sentinel values that will be handled by rating functions
      // Using -1 for best indicates "no data available"
      return { best: -1, worst: -1 };
    }

    const min = Math.min(...validValues);
    const max = Math.max(...validValues);

    return lowerIsBetter
      ? { best: min, worst: max }
      : { best: max, worst: min };
  };

  return {
    // Lower is better (sprints)
    sprint_5m: getMinMax(assessments.map((a) => a.sprint_5m), true),
    sprint_10m: getMinMax(assessments.map((a) => a.sprint_10m), true),
    sprint_20m: getMinMax(assessments.map((a) => a.sprint_20m), true),

    // Higher is better (blaze spot count, jumps, flexibility, power)
    blaze_spot_time: getMinMax(assessments.map((a) => a.blaze_spot_time), false),
    jump_2leg_distance: getMinMax(assessments.map((a) => a.jump_2leg_distance), false),
    jump_right_leg: getMinMax(assessments.map((a) => a.jump_right_leg), false),
    jump_left_leg: getMinMax(assessments.map((a) => a.jump_left_leg), false),
    jump_2leg_height: getMinMax(assessments.map((a) => a.jump_2leg_height), false),
    flexibility_ankle: getMinMax(assessments.map((a) => a.flexibility_ankle), false),
    flexibility_knee: getMinMax(assessments.map((a) => a.flexibility_knee), false),
    flexibility_hip: getMinMax(assessments.map((a) => a.flexibility_hip), false),
    kick_power_kaiser: getMinMax(assessments.map((a) => a.kick_power_kaiser), false),
  };
}

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
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
  overall_rating: number;
}

/**
 * Calculate EA FC card ratings from a single assessment
 * Using group statistics for relative comparison
 */
export function calculateCardRatings(
  assessment: PlayerAssessment,
  groupStats: GroupStats
): CalculatedRatings {
  // Calculate individual test ratings
  const sprint5Rating = calculateRatingLowerBetter(
    assessment.sprint_5m,
    groupStats.sprint_5m.best,
    groupStats.sprint_5m.worst
  );
  const sprint10Rating = calculateRatingLowerBetter(
    assessment.sprint_10m,
    groupStats.sprint_10m.best,
    groupStats.sprint_10m.worst
  );
  const sprint20Rating = calculateRatingLowerBetter(
    assessment.sprint_20m,
    groupStats.sprint_20m.best,
    groupStats.sprint_20m.worst
  );

  const jump2legDistRating = calculateRatingHigherBetter(
    assessment.jump_2leg_distance,
    groupStats.jump_2leg_distance.best,
    groupStats.jump_2leg_distance.worst
  );
  const jumpRightRating = calculateRatingHigherBetter(
    assessment.jump_right_leg,
    groupStats.jump_right_leg.best,
    groupStats.jump_right_leg.worst
  );
  const jumpLeftRating = calculateRatingHigherBetter(
    assessment.jump_left_leg,
    groupStats.jump_left_leg.best,
    groupStats.jump_left_leg.worst
  );
  const jumpHeightRating = calculateRatingHigherBetter(
    assessment.jump_2leg_height,
    groupStats.jump_2leg_height.best,
    groupStats.jump_2leg_height.worst
  );

  const blazeSpotRating = calculateRatingHigherBetter(
    assessment.blaze_spot_time,
    groupStats.blaze_spot_time.best,
    groupStats.blaze_spot_time.worst
  );

  const flexAnkleRating = calculateRatingHigherBetter(
    assessment.flexibility_ankle,
    groupStats.flexibility_ankle.best,
    groupStats.flexibility_ankle.worst
  );
  const flexKneeRating = calculateRatingHigherBetter(
    assessment.flexibility_knee,
    groupStats.flexibility_knee.best,
    groupStats.flexibility_knee.worst
  );
  const flexHipRating = calculateRatingHigherBetter(
    assessment.flexibility_hip,
    groupStats.flexibility_hip.best,
    groupStats.flexibility_hip.worst
  );

  const kickPowerRating = calculateRatingHigherBetter(
    assessment.kick_power_kaiser,
    groupStats.kick_power_kaiser.best,
    groupStats.kick_power_kaiser.worst
  );

  // Get categorical bonuses
  const coordBonus = getCoordinationBonus(assessment.coordination);
  const bodyBonus = getBodyStructureBonus(assessment.body_structure);
  const legPowerBonus = getLegPowerBonus(assessment.leg_power_technique);

  // Helper to average available ratings
  const avgRatings = (ratings: (number | null)[]): number => {
    const valid = ratings.filter((r): r is number => r !== null);
    if (valid.length === 0) return 50; // Default to 50 if no data
    return Math.round(valid.reduce((sum, v) => sum + v, 0) / valid.length);
  };

  // Clamp rating to 1-99 range
  const clamp = (value: number): number => Math.max(1, Math.min(99, value));

  // Calculate EA FC stats
  // PACE: Sprint times weighted average (5m: 40%, 10m: 35%, 20m: 25%)
  const paceBase = sprint5Rating !== null || sprint10Rating !== null || sprint20Rating !== null
    ? avgRatings([sprint5Rating, sprint10Rating, sprint20Rating])
    : 50;
  const pace = clamp(paceBase);

  // PHYSICAL: Jump tests + body structure bonus
  const physicalBase = avgRatings([jump2legDistRating, jumpRightRating, jumpLeftRating, jumpHeightRating]);
  const physical = clamp(physicalBase + bodyBonus);

  // DRIBBLING: Blaze Spot (agility/reaction) + coordination bonus
  const dribblingBase = blazeSpotRating ?? 50;
  const dribbling = clamp(dribblingBase + coordBonus);

  // DEFENDING: Flexibility + leg power technique
  const defendingBase = avgRatings([flexAnkleRating, flexKneeRating, flexHipRating]);
  const defending = clamp(defendingBase + legPowerBonus);

  // SHOOTING: Kick power
  const shooting = clamp(kickPowerRating ?? 50);

  // PASSING: Coordination + decision speed (Blaze Spot)
  const passingBase = avgRatings([blazeSpotRating]);
  const passing = clamp(passingBase + coordBonus);

  // OVERALL: Average of all 6 main stats
  const overall_rating = Math.round((pace + shooting + passing + dribbling + defending + physical) / 6);

  return {
    pace,
    shooting,
    passing,
    dribbling,
    defending,
    physical,
    overall_rating,
  };
}

/**
 * Calculate ratings with default group stats (for single player or no comparison data)
 * Uses absolute benchmarks instead of relative comparison
 */
export function calculateCardRatingsAbsolute(assessment: PlayerAssessment): CalculatedRatings {
  // Default benchmarks based on typical youth soccer values
  const defaultStats: GroupStats = {
    sprint_5m: { best: 0.9, worst: 1.5 },
    sprint_10m: { best: 1.6, worst: 2.5 },
    sprint_20m: { best: 2.8, worst: 4.0 },
    jump_2leg_distance: { best: 250, worst: 150 },
    jump_right_leg: { best: 200, worst: 120 },
    jump_left_leg: { best: 200, worst: 120 },
    jump_2leg_height: { best: 50, worst: 25 },
    blaze_spot_time: { best: 80, worst: 20 },
    flexibility_ankle: { best: 15, worst: 5 },
    flexibility_knee: { best: 20, worst: 8 },
    flexibility_hip: { best: 25, worst: 10 },
    kick_power_kaiser: { best: 500, worst: 50 },
  };

  return calculateCardRatings(assessment, defaultStats);
}

/**
 * Return neutral ratings (50) when there's insufficient comparison data
 * Used when only 1 player in age group has assessments
 * 50 represents "unknown/unranked" - middle of the 1-99 scale
 */
export function calculateNeutralRatings(): CalculatedRatings {
  return {
    pace: 50,
    shooting: 50,
    passing: 50,
    dribbling: 50,
    defending: 50,
    physical: 50,
    overall_rating: 50,
  };
}
