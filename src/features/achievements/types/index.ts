/**
 * Achievement Badges System Types
 */

import type { AchievementBadgeType, UserAchievementRow } from "@/types/database";

export type { AchievementBadgeType };

/** Badge category for grouping */
export type BadgeCategory =
  | "onboarding"
  | "videos"
  | "assessments"
  | "improvements"
  | "streaks"
  | "goals";

/** Badge rarity level */
export type BadgeRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

/**
 * Badge configuration with display info
 */
export interface BadgeConfig {
  type: AchievementBadgeType;
  /** Hebrew name */
  nameHe: string;
  /** Hebrew description */
  descriptionHe: string;
  /** Emoji icon */
  emoji: string;
  /** Category for grouping */
  category: BadgeCategory;
  /** Rarity level */
  rarity: BadgeRarity;
  /** Points value */
  points: number;
}

/**
 * Achievement with display info for UI
 */
export interface AchievementWithDisplay extends UserAchievementRow {
  /** Hebrew name */
  nameHe: string;
  /** Hebrew description */
  descriptionHe: string;
  /** Emoji icon */
  emoji: string;
  /** Category for grouping */
  category: BadgeCategory;
  /** Rarity level */
  rarity: BadgeRarity;
  /** Points value */
  points: number;
}

/**
 * Props for AchievementBadge component
 */
export interface AchievementBadgeProps {
  achievement: AchievementWithDisplay;
  size?: "sm" | "md" | "lg";
  showTooltip?: boolean;
}

/**
 * Props for AchievementsList component
 */
export interface AchievementsListProps {
  achievements: AchievementWithDisplay[];
  variant?: "grid" | "compact" | "showcase";
  showLocked?: boolean;
}

/**
 * Celebration config for newly unlocked badges
 */
export interface BadgeCelebration {
  badge: BadgeConfig;
  title: string;
  message: string;
}

/**
 * Return type for useAchievementCelebration hook
 */
export interface UseAchievementCelebrationReturn {
  /** Check for new achievements and show celebrations */
  checkAndCelebrate: () => void;
  /** List of badge types celebrated this session */
  celebratedBadges: string[];
}
