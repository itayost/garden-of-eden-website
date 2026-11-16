/**
 * Goal System Configuration
 */

import type { PhysicalMetricKey, GoalCelebration } from "../../types";
import { ASSESSMENT_LABELS_HE, ASSESSMENT_UNITS, DRIBBLING_TEST_KEYS, isLowerBetter } from "@/types/assessment";

/**
 * A metric a Goal can be set on: every numeric Assessment metric but the
 * retired `kick_power_kaiser` (exactly the 18 entries of GOAL_METRICS).
 */
export type GoalMetric = Exclude<PhysicalMetricKey, "kick_power_kaiser">;

/** Metrics that can have new goals set. */
export const GOAL_METRICS: readonly GoalMetric[] = [
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
  ...DRIBBLING_TEST_KEYS,
];

/** Whether a key is one of the Goal metrics. */
export function isGoalMetric(value: string): value is GoalMetric {
  return (GOAL_METRICS as readonly string[]).includes(value);
}

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
  shuffle_10m: ASSESSMENT_LABELS_HE.shuffle_10m,
  sprint_10m_h: ASSESSMENT_LABELS_HE.sprint_10m_h,
  sprint_10m_h_ball: ASSESSMENT_LABELS_HE.sprint_10m_h_ball,
  envelope: ASSESSMENT_LABELS_HE.envelope,
  envelope_ball: ASSESSMENT_LABELS_HE.envelope_ball,
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
  shuffle_10m: ASSESSMENT_UNITS.shuffle_10m,
  sprint_10m_h: ASSESSMENT_UNITS.sprint_10m_h,
  sprint_10m_h_ball: ASSESSMENT_UNITS.sprint_10m_h_ball,
  envelope: ASSESSMENT_UNITS.envelope,
  envelope_ball: ASSESSMENT_UNITS.envelope_ball,
};

/** Check if a metric is lower-is-better */
export function isLowerBetterMetric(metric: PhysicalMetricKey): boolean {
  return isLowerBetter(metric);
}
