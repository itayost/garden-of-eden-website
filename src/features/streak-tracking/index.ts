/**
 * Streak Tracking Feature
 *
 * Tracks consecutive weekday activities (Mon-Fri) for form submissions
 * and video watches. Uses database triggers for automatic tracking.
 *
 * @example
 * ```tsx
 * import { StreakCard, StreakCelebrationClient, getUserStreak } from "@/features/streak-tracking";
 *
 * // In server component:
 * const streak = await getUserStreak(userId);
 *
 * return (
 *   <>
 *     <StreakCard streak={streak} />
 *     <StreakCelebrationClient streak={streak} />
 *   </>
 * );
 * ```
 */

// Components
export { StreakCard, StreakCelebrationClient } from "./components";

// Actions
export { getUserStreak } from "./lib/actions/get-streak";

// Hooks
export { useStreakCelebration } from "./hooks/useStreakCelebration";

// Types
export type { UserStreak, StreakMilestone, UseStreakCelebrationReturn } from "./types";

// Config
export { STREAK_MILESTONES, CELEBRATION_STORAGE_KEY } from "./lib/config/milestones";

// Utils
export {
  findMilestoneReached,
  wasMilestoneCelebrated,
  markMilestoneCelebrated,
  formatStreakDisplay,
} from "./lib/utils/streak-utils";
