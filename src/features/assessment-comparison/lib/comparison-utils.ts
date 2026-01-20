import type { PlayerAssessment, CoordinationLevel, LegPowerTechnique, BodyStructure } from "@/types/assessment";
import { isLowerBetter, ASSESSMENT_UNITS } from "@/types/assessment";

// ===========================================
// TYPES
// ===========================================

export interface AssessmentDelta {
  delta: number | null;
  isImprovement: boolean | null;
  formatted: string;
}

export interface CategoricalChange {
  oldValue: string | null;
  newValue: string | null;
  changed: boolean;
}

export interface ComparisonSummary {
  improvements: number;
  regressions: number;
  unchanged: number;
}

export interface ComparisonResult {
  olderAssessment: PlayerAssessment;
  newerAssessment: PlayerAssessment;
  deltas: Record<string, AssessmentDelta>;
  categoricalChanges: Record<string, CategoricalChange>;
  summary: ComparisonSummary;
}

// Numeric fields that can be compared
const NUMERIC_FIELDS = [
  "sprint_5m",
  "sprint_10m",
  "sprint_20m",
  "jump_2leg_distance",
  "jump_right_leg",
  "jump_left_leg",
  "jump_2leg_height",
  "blaze_spot_time",
  "flexibility_ankle",
  "flexibility_knee",
  "flexibility_hip",
  "kick_power_kaiser",
] as const;

// Categorical fields that can be compared
const CATEGORICAL_FIELDS = [
  "coordination",
  "leg_power_technique",
  "body_structure",
] as const;

// ===========================================
// UTILITY FUNCTIONS
// ===========================================

/**
 * Calculates the delta (difference) between two numeric values.
 * Returns null if either value is null.
 */
export function calculateDelta(
  oldValue: number | null,
  newValue: number | null
): number | null {
  if (oldValue === null || newValue === null) {
    return null;
  }
  return newValue - oldValue;
}

/**
 * Determines if a delta represents an improvement.
 * For some metrics (like sprint times), lower is better.
 * Returns null if delta is 0 or null.
 */
export function isImprovement(
  fieldName: string,
  delta: number | null
): boolean | null {
  if (delta === null || delta === 0) {
    return null;
  }

  const lowerIsBetter = isLowerBetter(fieldName);

  if (lowerIsBetter) {
    // For sprint times and blaze_spot_time, a negative delta (decrease) is improvement
    return delta < 0;
  } else {
    // For jumps, flexibility, power - a positive delta (increase) is improvement
    return delta > 0;
  }
}

/**
 * Formats a delta value for display with appropriate units.
 * Returns "ללא שינוי" for zero delta, empty string for null.
 */
export function formatDelta(
  delta: number | null,
  fieldName: string
): string {
  if (delta === null) {
    return "";
  }

  if (delta === 0) {
    return "ללא שינוי";
  }

  // Round to 2 decimal places
  const rounded = Math.round(delta * 100) / 100;
  const sign = rounded > 0 ? "+" : "";
  const unit = ASSESSMENT_UNITS[fieldName] || "";

  // Format the number (remove trailing zeros for whole numbers)
  const formattedNumber = Number.isInteger(rounded)
    ? rounded.toString()
    : rounded.toFixed(2).replace(/\.?0+$/, "");

  return `${sign}${formattedNumber}${unit ? ` ${unit}` : ""}`.replace(` %`, "%");
}

/**
 * Returns the color to use for displaying a comparison result.
 * Green for improvements, red for regressions, neutral for unchanged.
 */
export function getComparisonColor(
  improvement: boolean | null
): "green" | "red" | "neutral" {
  if (improvement === null) {
    return "neutral";
  }
  return improvement ? "green" : "red";
}

/**
 * Compares two assessments and returns detailed comparison results.
 * The older assessment should be passed first, but this function will
 * automatically swap them if they're in the wrong chronological order.
 */
export function compareAssessments(
  olderAssessment: PlayerAssessment,
  newerAssessment: PlayerAssessment
): ComparisonResult {
  // Ensure assessments are in correct chronological order
  const olderDate = new Date(olderAssessment.assessment_date).getTime();
  const newerDate = new Date(newerAssessment.assessment_date).getTime();

  // If dates are reversed, swap the assessments
  if (olderDate > newerDate) {
    [olderAssessment, newerAssessment] = [newerAssessment, olderAssessment];
  }

  const deltas: Record<string, AssessmentDelta> = {};
  const categoricalChanges: Record<string, CategoricalChange> = {};
  let improvements = 0;
  let regressions = 0;
  let unchanged = 0;

  // Compare numeric fields
  for (const field of NUMERIC_FIELDS) {
    const oldVal = olderAssessment[field] as number | null;
    const newVal = newerAssessment[field] as number | null;
    const delta = calculateDelta(oldVal, newVal);
    const improvement = isImprovement(field, delta);
    const formatted = formatDelta(delta, field);

    deltas[field] = {
      delta,
      isImprovement: improvement,
      formatted,
    };

    // Count improvements/regressions (only if delta is not null)
    if (delta !== null) {
      if (improvement === true) {
        improvements++;
      } else if (improvement === false) {
        regressions++;
      } else {
        unchanged++;
      }
    }
  }

  // Compare categorical fields
  for (const field of CATEGORICAL_FIELDS) {
    const oldVal = olderAssessment[field] as string | null;
    const newVal = newerAssessment[field] as string | null;

    categoricalChanges[field] = {
      oldValue: oldVal,
      newValue: newVal,
      changed: oldVal !== newVal && oldVal !== null && newVal !== null,
    };
  }

  return {
    olderAssessment,
    newerAssessment,
    deltas,
    categoricalChanges,
    summary: {
      improvements,
      regressions,
      unchanged,
    },
  };
}
