import type { StreakMilestone } from "../../types";

/**
 * Streak milestones for celebrations
 * Ordered by value for easy milestone detection
 */
export const STREAK_MILESTONES: StreakMilestone[] = [
  {
    value: 7,
    label: "שבוע שלם של רצף! כל הכבוד!",
    emoji: "🔥",
    duration: 5000,
  },
  {
    value: 30,
    label: "חודש מדהים! אתה אגדה!",
    emoji: "💪",
    duration: 6000,
  },
  {
    value: 100,
    label: "100 ימים! אתה מכונת אימונים!",
    emoji: "👑",
    duration: 8000,
  },
];

/**
 * LocalStorage key prefix for tracking celebrated milestones
 */
export const CELEBRATION_STORAGE_KEY = "goe_streak_celebrated";
