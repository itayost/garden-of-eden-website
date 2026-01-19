/**
 * Goal Utilities
 */

import type { PlayerGoalRow } from "@/types/database";
import type { PlayerGoalWithProgress, PhysicalMetricKey, GoalCelebration } from "../../types";
import {
  METRIC_LABELS_HE,
  METRIC_UNITS,
  isLowerBetterMetric,
  GOAL_CELEBRATION_STORAGE_KEY,
  DEFAULT_GOAL_CELEBRATION,
} from "../config/goal-config";

/**
 * Calculate goal progress from database record
 */
export function calculateGoalProgress(goal: PlayerGoalRow): PlayerGoalWithProgress {
  const metricKey = goal.metric_key as PhysicalMetricKey;
  const isLowerBetter = isLowerBetterMetric(metricKey);

  let progressPercentage = 0;
  let status: PlayerGoalWithProgress["status"] = "not_started";
  let isAchieved = goal.achieved_at !== null;

  if (isAchieved) {
    progressPercentage = 100;
    status = "achieved";
  } else if (goal.current_value !== null && goal.baseline_value !== null) {
    // Calculate progress based on improvement from baseline to target
    const totalDistance = Math.abs(goal.target_value - goal.baseline_value);

    if (totalDistance > 0) {
      if (isLowerBetter) {
        // For lower-is-better: progress = how much we've decreased
        const improvement = goal.baseline_value - goal.current_value;
        progressPercentage = Math.max(0, (improvement / totalDistance) * 100);
      } else {
        // For higher-is-better: progress = how much we've increased
        const improvement = goal.current_value - goal.baseline_value;
        progressPercentage = Math.max(0, (improvement / totalDistance) * 100);
      }
    }
    status = progressPercentage > 0 ? "in_progress" : "not_started";
  } else if (goal.current_value !== null && goal.current_value !== 0) {
    // No baseline, calculate progress from current to target
    // Guard against division by zero
    if (isLowerBetter) {
      progressPercentage = Math.min(100, (goal.target_value / goal.current_value) * 100);
    } else if (goal.target_value !== 0) {
      progressPercentage = Math.min(100, (goal.current_value / goal.target_value) * 100);
    }
    status = "in_progress";
  }

  // Cap at 100
  progressPercentage = Math.min(100, Math.round(progressPercentage));

  // Build progress text
  const unit = METRIC_UNITS[metricKey] || "";
  const currentDisplay = goal.current_value !== null ? goal.current_value : "---";
  const progressText = `${currentDisplay} / ${goal.target_value} ${unit}`;

  return {
    ...goal,
    metric_label_he: METRIC_LABELS_HE[metricKey] || metricKey,
    unit,
    progress_percentage: progressPercentage,
    is_achieved: isAchieved,
    status,
    progress_text: progressText,
  };
}

/**
 * Get celebration message for an achieved goal
 */
export function getGoalCelebrationMessage(goal: PlayerGoalRow): GoalCelebration & {
  emoji: string;
  title: string;
  message: string;
  duration: number;
} {
  const metricKey = goal.metric_key as PhysicalMetricKey;
  const metricLabel = METRIC_LABELS_HE[metricKey] || metricKey;
  const unit = METRIC_UNITS[metricKey] || "";
  const valueDisplay = goal.achieved_value !== null ? `${goal.achieved_value}${unit ? ` ${unit}` : ""}` : "";

  return {
    emoji: DEFAULT_GOAL_CELEBRATION.emoji,
    title: `כל הכבוד!`,
    message: `השגת את היעד ב${metricLabel}: ${valueDisplay}`,
    titleHe: `כל הכבוד!`,
    messageHe: `השגת את היעד ב${metricLabel}: ${valueDisplay}`,
    duration: DEFAULT_GOAL_CELEBRATION.duration,
  };
}

/**
 * Check if a goal has already been celebrated (localStorage)
 */
export function wasGoalCelebrated(userId: string, goalId: string): boolean {
  if (typeof window === "undefined") return true;

  try {
    const key = `${GOAL_CELEBRATION_STORAGE_KEY}_${userId}`;
    const data = localStorage.getItem(key);
    if (!data) return false;

    const celebrated = JSON.parse(data);
    if (!Array.isArray(celebrated)) return false;

    return celebrated.includes(goalId);
  } catch {
    return false;
  }
}

/** Maximum number of celebrated goal IDs to keep in localStorage */
const MAX_CELEBRATED_GOALS = 100;

/**
 * Mark a goal as celebrated (localStorage)
 */
export function markGoalCelebrated(userId: string, goalId: string): void {
  if (typeof window === "undefined") return;

  try {
    const key = `${GOAL_CELEBRATION_STORAGE_KEY}_${userId}`;
    const data = localStorage.getItem(key);
    let celebrated: string[] = data ? JSON.parse(data) : [];

    if (!Array.isArray(celebrated)) {
      localStorage.setItem(key, JSON.stringify([goalId]));
      return;
    }

    if (!celebrated.includes(goalId)) {
      celebrated.push(goalId);
      // Keep only the most recent entries to prevent unbounded growth
      if (celebrated.length > MAX_CELEBRATED_GOALS) {
        celebrated = celebrated.slice(-MAX_CELEBRATED_GOALS);
      }
      localStorage.setItem(key, JSON.stringify(celebrated));
    }
  } catch {
    // Silently fail
  }
}

/**
 * Format a metric value for display
 */
export function formatMetricValue(
  value: number | null,
  metricKey: PhysicalMetricKey
): string {
  if (value === null) return "---";
  const unit = METRIC_UNITS[metricKey] || "";
  return `${value}${unit ? ` ${unit}` : ""}`;
}
