/**
 * Achievement Badges Feature Module
 * Gamification system for player accomplishments
 */

// Types
export * from "./types";

// Config
export {
  BADGE_CONFIGS,
  CATEGORY_LABELS,
  RARITY_COLORS,
  getBadgeConfig,
  getAllBadgeTypes,
  getBadgesByCategory,
  getTotalPossiblePoints,
} from "./lib/config/badge-config";

// Utils
export {
  enrichAchievement,
  calculateTotalPoints,
  getBadgeCelebration,
  wasBadgeCelebrated,
  markBadgeCelebrated,
  groupAchievementsByCategory,
  getLockedBadges,
  formatUnlockedDate,
} from "./lib/utils/achievement-utils";

// Server Actions
export {
  getUserAchievements,
  getMyAchievements,
  getUncelebratedAchievements,
  markAchievementCelebrated,
  markAchievementsCelebrated,
} from "./lib/actions/get-achievements";

// Components
export {
  AchievementBadge,
  LockedBadge,
  AchievementsList,
  AchievementsCard,
  AchievementCelebrationClient,
} from "./components";

// Hooks
export { useAchievementCelebration } from "./hooks/useAchievementCelebration";
