/**
 * The Trainee's open Goals with their progress. Pure.
 */

import { calculateGoalProgress } from "@/features/goals/lib/utils/goal-utils";
import type { PlayerGoalWithProgress } from "@/features/goals/types";
import type { PlayerGoalRow } from "@/types/database";
import type { GoalFact } from "./types";

const STATUS_LABELS: Record<PlayerGoalWithProgress["status"], string> = {
  not_started: "עוד לא התחיל",
  in_progress: "בדרך",
  achieved: "הושג",
};

export function goalFacts(goals: readonly PlayerGoalRow[]): GoalFact[] {
  return goals
    .filter((goal) => goal.achieved_at === null)
    .map(calculateGoalProgress)
    .map((goal) => ({
      metric: goal.metric_label_he,
      baseline: goal.baseline_value,
      current: goal.current_value,
      target: goal.target_value,
      unit: goal.unit,
      progressPercent: goal.progress_percentage,
      status: STATUS_LABELS[goal.status],
    }));
}
