/**
 * The rules a new Goal must pass, shared by `setGoal()` and the acceptance of
 * a Goal proposal, so both refuse the same Goals with the same words.
 */

import { isGoalMetric, isLowerBetterMetric } from "../config/goal-config";

/** Why a Goal may not be set, or null when it may. */
export function goalRefusal(input: {
  metricKey: string;
  targetValue: number;
  baselineValue: number | null;
}): string | null {
  const { metricKey, targetValue, baselineValue } = input;
  if (!isGoalMetric(metricKey)) return "מדד לא תקין";
  if (!Number.isFinite(targetValue) || targetValue <= 0) return "ערך היעד חייב להיות חיובי";
  if (baselineValue != null && baselineValue > 0) {
    const lowerIsBetter = isLowerBetterMetric(metricKey);
    if (lowerIsBetter && targetValue >= baselineValue) {
      return "עבור מדד זה, היעד צריך להיות נמוך מהערך הנוכחי";
    }
    if (!lowerIsBetter && targetValue <= baselineValue) {
      return "עבור מדד זה, היעד צריך להיות גבוה מהערך הנוכחי";
    }
  }
  return null;
}
