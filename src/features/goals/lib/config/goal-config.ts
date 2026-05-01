/**
 * Goal System Configuration
 */

import type { PhysicalMetricKey, GoalCelebration } from "../../types";

/** Metrics that can have new goals set. */
export const GOAL_METRICS: PhysicalMetricKey[] = [
  "sprint_5m",
  "sprint_10m",
  "sprint_20m",
  "jump_2leg_distance",
  "jump_2leg_height",
  "jump_right_leg",
  "jump_left_leg",
  "blaze_spot_time",
  "flexibility_ankle",
  "flexibility_knee",
  "flexibility_hip",
  "kick_power_right_foot",
  "kick_power_left_foot",
];

/** Metrics where lower values are better (sprints only) */
export const LOWER_IS_BETTER_METRICS: PhysicalMetricKey[] = [
  "sprint_5m",
  "sprint_10m",
  "sprint_20m",
];

/** Storage key for tracking celebrated goals */
export const GOAL_CELEBRATION_STORAGE_KEY = "goe_goal_celebrated";

/** Default celebration configuration */
export const DEFAULT_GOAL_CELEBRATION: GoalCelebration = {
  emoji: "🎯",
  title: "Goal Achieved!",
  message: "Great job!",
  titleHe: "כל הכבוד! השגת את היעד!",
  messageHe: "המשך כך!",
  duration: 5000,
};

/** Hebrew labels for metrics */
export const METRIC_LABELS_HE: Record<PhysicalMetricKey, string> = {
  sprint_5m: "ספרינט 5 מטר",
  sprint_10m: "ספרינט 10 מטר",
  sprint_20m: "ספרינט 20 מטר",
  jump_2leg_distance: "ניתור למרחק 2 רגליים",
  jump_2leg_height: "ניתור לגובה",
  jump_right_leg: "ניתור למרחק רגל ימין",
  jump_left_leg: "ניתור למרחק רגל שמאל",
  blaze_spot_time: "בלייז ספוט",
  flexibility_ankle: "גמישות קרסול",
  flexibility_knee: "גמישות ברך",
  flexibility_hip: "גמישות אגן",
  kick_power_kaiser: "עוצמת בעיטה",
  kick_power_right_foot: "עוצמת בעיטה - רגל ימין",
  kick_power_left_foot: "עוצמת בעיטה - רגל שמאל",
};

/** Units for metrics */
export const METRIC_UNITS: Record<PhysicalMetricKey, string> = {
  sprint_5m: "שניות",
  sprint_10m: "שניות",
  sprint_20m: "שניות",
  jump_2leg_distance: 'ס"מ',
  jump_2leg_height: 'ס"מ',
  jump_right_leg: 'ס"מ',
  jump_left_leg: 'ס"מ',
  blaze_spot_time: "פגיעות",
  flexibility_ankle: 'ס"מ',
  flexibility_knee: 'ס"מ',
  flexibility_hip: 'ס"מ',
  kick_power_kaiser: 'יח׳ כוח',
  kick_power_right_foot: 'יח׳ כוח',
  kick_power_left_foot: 'יח׳ כוח',
};

/** Check if a metric is lower-is-better */
export function isLowerBetterMetric(metric: PhysicalMetricKey): boolean {
  return LOWER_IS_BETTER_METRICS.includes(metric);
}
