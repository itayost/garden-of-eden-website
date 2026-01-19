/**
 * Goals System Feature Module
 * Trainer-managed goals for physical metrics
 */

// Types
export * from "./types";

// Config
export {
  GOAL_METRICS,
  LOWER_IS_BETTER_METRICS,
  METRIC_LABELS_HE,
  METRIC_UNITS,
  isLowerBetterMetric,
} from "./lib/config/goal-config";

// Utils
export {
  calculateGoalProgress,
  getGoalCelebrationMessage,
  wasGoalCelebrated,
  markGoalCelebrated,
  formatMetricValue,
} from "./lib/utils/goal-utils";

// Server Actions
export { getPlayerGoals, getMyActiveGoals } from "./lib/actions/get-goals";
export { setGoal } from "./lib/actions/set-goal";
export { deleteGoal } from "./lib/actions/delete-goal";

// Components
export {
  GoalCard,
  GoalsList,
  GoalCelebrationClient,
  SetGoalDialog,
  GoalManagementPanel,
} from "./components";

// Hooks
export { useGoalCelebration } from "./hooks/useGoalCelebration";
