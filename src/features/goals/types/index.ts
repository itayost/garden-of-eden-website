/**
 * Goals System Types
 */

import type { PlayerGoalRow } from "@/types/database";

/** Physical metric keys that can have goals */
export type PhysicalMetricKey =
  | "sprint_5m"
  | "sprint_10m"
  | "sprint_20m"
  | "jump_2leg_distance"
  | "jump_2leg_height"
  | "jump_right_leg"
  | "jump_left_leg"
  | "blaze_spot_time"
  | "flexibility_ankle"
  | "flexibility_knee"
  | "flexibility_hip"
  | "kick_power_kaiser";

/**
 * Goal with calculated progress for UI display
 */
export interface PlayerGoalWithProgress extends PlayerGoalRow {
  /** Hebrew label for the metric */
  metric_label_he: string;
  /** Unit of measurement */
  unit: string;
  /** Progress percentage (0-100, can exceed 100 if overachieved) */
  progress_percentage: number;
  /** Whether the goal has been achieved */
  is_achieved: boolean;
  /** Goal status */
  status: "not_started" | "in_progress" | "achieved";
  /** Progress text for display e.g., "1.25 / 1.20 שניות" */
  progress_text: string;
}

/**
 * Form data for creating/editing a goal
 */
export interface SetGoalFormData {
  metric_key: PhysicalMetricKey;
  target_value: number;
}

/**
 * Return type for useGoalCelebration hook
 */
export interface UseGoalCelebrationReturn {
  /** Check for newly achieved goals and show celebrations */
  checkAndCelebrate: () => void;
  /** List of goal IDs that were celebrated this session */
  celebratedGoals: string[];
}

/**
 * Celebration config for achieved goals
 */
export interface GoalCelebration {
  emoji: string;
  title: string;
  message: string;
  titleHe: string;
  messageHe: string;
  duration: number;
}

/**
 * Props for GoalCard component
 */
export interface GoalCardProps {
  goal: PlayerGoalWithProgress;
  compact?: boolean;
}

/**
 * Props for GoalsList component
 */
export interface GoalsListProps {
  goals: PlayerGoalWithProgress[];
  userId: string;
  variant?: "dashboard" | "full";
}

/**
 * Props for GoalManagementPanel component
 */
export interface GoalManagementPanelProps {
  userId: string;
  playerName: string;
  currentMetrics: Partial<Record<PhysicalMetricKey, number | null>>;
  existingGoals: PlayerGoalRow[];
}

/**
 * Props for SetGoalDialog component
 */
export interface SetGoalDialogProps {
  userId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editGoal?: PlayerGoalRow | null;
  currentMetrics: Partial<Record<PhysicalMetricKey, number | null>>;
  existingGoals: PlayerGoalRow[];
}
