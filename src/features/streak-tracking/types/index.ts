/**
 * Streak Tracking Types
 */

/**
 * User streak data from database
 */
export interface UserStreak {
  user_id: string;
  current_streak: number;
  longest_streak: number;
  last_activity_date: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Milestone definition for celebrations
 */
export interface StreakMilestone {
  /** Number of days for this milestone */
  value: number;
  /** Hebrew label for the milestone */
  label: string;
  /** Emoji to display */
  emoji: string;
  /** Toast duration in milliseconds */
  duration: number;
}

/**
 * Props for StreakDisplay component
 */
export interface StreakDisplayProps {
  userId: string;
}

/**
 * Return type for useStreakCelebration hook
 */
export interface UseStreakCelebrationReturn {
  /** Check if milestone was reached and show celebration */
  checkAndCelebrate: () => void;
  /** Whether a celebration was triggered */
  celebrated: boolean;
}
