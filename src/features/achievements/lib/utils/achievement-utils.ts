/**
 * Achievement Utility Functions
 */

import type { UserAchievementRow, AchievementBadgeType } from "@/types/database";
import type { AchievementWithDisplay, BadgeCelebration } from "../../types";
import { BADGE_CONFIGS, getBadgeConfig } from "../config/badge-config";

const CELEBRATED_STORAGE_KEY = "celebrated_badges";

/**
 * Enrich raw achievement with display info
 */
export function enrichAchievement(achievement: UserAchievementRow): AchievementWithDisplay {
  const config = getBadgeConfig(achievement.badge_type as AchievementBadgeType);

  return {
    ...achievement,
    nameHe: config.nameHe,
    descriptionHe: config.descriptionHe,
    emoji: config.emoji,
    category: config.category,
    rarity: config.rarity,
    points: config.points,
  };
}

/**
 * Calculate total earned points
 */
export function calculateTotalPoints(achievements: AchievementWithDisplay[]): number {
  return achievements.reduce((sum, achievement) => sum + achievement.points, 0);
}

/**
 * Get celebration message for a badge
 */
export function getBadgeCelebration(badgeType: AchievementBadgeType): BadgeCelebration {
  const config = getBadgeConfig(badgeType);

  return {
    badge: config,
    title: `${config.emoji} ${config.nameHe}`,
    message: config.descriptionHe,
  };
}

/**
 * Check if badge was already celebrated (localStorage)
 */
export function wasBadgeCelebrated(badgeId: string): boolean {
  if (typeof window === "undefined") return true;

  try {
    const celebrated = localStorage.getItem(CELEBRATED_STORAGE_KEY);
    if (!celebrated) return false;
    const parsed = JSON.parse(celebrated) as string[];
    return parsed.includes(badgeId);
  } catch {
    return false;
  }
}

/**
 * Mark badge as celebrated (localStorage)
 */
export function markBadgeCelebrated(badgeId: string): void {
  if (typeof window === "undefined") return;

  try {
    const celebrated = localStorage.getItem(CELEBRATED_STORAGE_KEY);
    const parsed = celebrated ? (JSON.parse(celebrated) as string[]) : [];
    if (!parsed.includes(badgeId)) {
      parsed.push(badgeId);
      localStorage.setItem(CELEBRATED_STORAGE_KEY, JSON.stringify(parsed));
    }
  } catch {
    // Ignore localStorage errors
  }
}

/**
 * Group achievements by category
 */
export function groupAchievementsByCategory(
  achievements: AchievementWithDisplay[]
): Record<string, AchievementWithDisplay[]> {
  return achievements.reduce(
    (acc, achievement) => {
      const category = achievement.category;
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(achievement);
      return acc;
    },
    {} as Record<string, AchievementWithDisplay[]>
  );
}

/**
 * Get all locked badges (not yet earned)
 */
export function getLockedBadges(
  earnedBadgeTypes: string[]
): AchievementBadgeType[] {
  const allTypes = Object.keys(BADGE_CONFIGS) as AchievementBadgeType[];
  return allTypes.filter((type) => !earnedBadgeTypes.includes(type));
}

/**
 * Format unlocked date
 */
export function formatUnlockedDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("he-IL", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
