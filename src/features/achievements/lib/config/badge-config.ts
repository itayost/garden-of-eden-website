/**
 * Badge Configuration
 * Defines all available badges with their display info
 */

import type { AchievementBadgeType, BadgeCategory, BadgeConfig, BadgeRarity } from "../../types";

/**
 * All badge configurations
 */
export const BADGE_CONFIGS: Record<AchievementBadgeType, BadgeConfig> = {
  // Onboarding badges
  nutrition_form_completed: {
    type: "nutrition_form_completed",
    nameHe: "תזונאי צעיר",
    descriptionHe: "מילאת שאלון תזונה",
    emoji: "🥗",
    category: "onboarding",
    rarity: "common",
    points: 10,
  },
  profile_completed: {
    type: "profile_completed",
    nameHe: "פרופיל מושלם",
    descriptionHe: "השלמת את הפרופיל שלך",
    emoji: "✨",
    category: "onboarding",
    rarity: "common",
    points: 10,
  },
  first_pre_workout: {
    type: "first_pre_workout",
    nameHe: "מוכן לאימון",
    descriptionHe: "מילאת שאלון לפני אימון ראשון",
    emoji: "🏃",
    category: "onboarding",
    rarity: "common",
    points: 10,
  },
  first_post_workout: {
    type: "first_post_workout",
    nameHe: "סיום מוצלח",
    descriptionHe: "מילאת שאלון אחרי אימון ראשון",
    emoji: "💪",
    category: "onboarding",
    rarity: "common",
    points: 10,
  },

  // Video badges
  first_video_watched: {
    type: "first_video_watched",
    nameHe: "צופה ראשון",
    descriptionHe: "צפית בסרטון ראשון",
    emoji: "🎬",
    category: "videos",
    rarity: "common",
    points: 10,
  },
  videos_day_complete: {
    type: "videos_day_complete",
    nameHe: "יום שלם",
    descriptionHe: "סיימת את כל הסרטונים של יום אחד",
    emoji: "📅",
    category: "videos",
    rarity: "uncommon",
    points: 25,
  },
  all_videos_watched: {
    type: "all_videos_watched",
    nameHe: "צופה מסור",
    descriptionHe: "צפית בכל הסרטונים!",
    emoji: "🏆",
    category: "videos",
    rarity: "rare",
    points: 100,
  },

  // Assessment badges
  first_assessment: {
    type: "first_assessment",
    nameHe: "מבדק ראשון",
    descriptionHe: "קיבלת מבדק פיזי ראשון",
    emoji: "📋",
    category: "assessments",
    rarity: "common",
    points: 15,
  },
  five_assessments: {
    type: "five_assessments",
    nameHe: "מתקדם",
    descriptionHe: "5 מבדקים פיזיים",
    emoji: "📊",
    category: "assessments",
    rarity: "uncommon",
    points: 50,
  },
  ten_assessments: {
    type: "ten_assessments",
    nameHe: "מקצוען",
    descriptionHe: "10 מבדקים פיזיים",
    emoji: "🎯",
    category: "assessments",
    rarity: "rare",
    points: 100,
  },

  // Improvement badges
  sprint_improved: {
    type: "sprint_improved",
    nameHe: "ברק!",
    descriptionHe: "שיפרת זמן ריצה",
    emoji: "⚡",
    category: "improvements",
    rarity: "uncommon",
    points: 30,
  },
  jump_improved: {
    type: "jump_improved",
    nameHe: "קפיץ",
    descriptionHe: "שיפרת קפיצה",
    emoji: "🦘",
    category: "improvements",
    rarity: "uncommon",
    points: 30,
  },
  overall_improved_5pts: {
    type: "overall_improved_5pts",
    nameHe: "מתפתח",
    descriptionHe: "הדירוג הכללי שלך עלה ב-5 נקודות",
    emoji: "📈",
    category: "improvements",
    rarity: "rare",
    points: 75,
  },
  overall_improved_10pts: {
    type: "overall_improved_10pts",
    nameHe: "כוכב עולה",
    descriptionHe: "הדירוג הכללי שלך עלה ב-10 נקודות!",
    emoji: "🌟",
    category: "improvements",
    rarity: "epic",
    points: 150,
  },

  // Streak badges
  streak_7_days: {
    type: "streak_7_days",
    nameHe: "שבוע של הצלחות",
    descriptionHe: "רצף של 7 ימי אימון",
    emoji: "🔥",
    category: "streaks",
    rarity: "uncommon",
    points: 50,
  },
  streak_30_days: {
    type: "streak_30_days",
    nameHe: "חודש מושלם",
    descriptionHe: "רצף של 30 ימי אימון",
    emoji: "🔥🔥",
    category: "streaks",
    rarity: "rare",
    points: 150,
  },
  streak_100_days: {
    type: "streak_100_days",
    nameHe: "אגדה חיה",
    descriptionHe: "רצף של 100 ימי אימון!",
    emoji: "🔥🔥🔥",
    category: "streaks",
    rarity: "legendary",
    points: 500,
  },

  // Goal badges
  first_goal_achieved: {
    type: "first_goal_achieved",
    nameHe: "מגשים יעדים",
    descriptionHe: "השגת יעד ראשון",
    emoji: "🎯",
    category: "goals",
    rarity: "uncommon",
    points: 40,
  },
  five_goals_achieved: {
    type: "five_goals_achieved",
    nameHe: "שובר שיאים",
    descriptionHe: "השגת 5 יעדים",
    emoji: "🏅",
    category: "goals",
    rarity: "rare",
    points: 125,
  },
};

/**
 * Category display info
 */
export const CATEGORY_LABELS: Record<BadgeCategory, string> = {
  onboarding: "התחלה",
  videos: "סרטונים",
  assessments: "מבדקים",
  improvements: "שיפורים",
  streaks: "רצפים",
  goals: "יעדים",
};

/**
 * Rarity colors
 */
export const RARITY_COLORS: Record<BadgeRarity, { bg: string; border: string; text: string }> = {
  common: {
    bg: "bg-gray-100",
    border: "border-gray-300",
    text: "text-gray-700",
  },
  uncommon: {
    bg: "bg-green-50",
    border: "border-green-300",
    text: "text-green-700",
  },
  rare: {
    bg: "bg-blue-50",
    border: "border-blue-400",
    text: "text-blue-700",
  },
  epic: {
    bg: "bg-purple-50",
    border: "border-purple-400",
    text: "text-purple-700",
  },
  legendary: {
    bg: "bg-amber-50",
    border: "border-amber-400",
    text: "text-amber-700",
  },
};

/**
 * Get badge config by type
 */
export function getBadgeConfig(type: AchievementBadgeType): BadgeConfig {
  return BADGE_CONFIGS[type];
}

/**
 * Get all badge types
 */
export function getAllBadgeTypes(): AchievementBadgeType[] {
  return Object.keys(BADGE_CONFIGS) as AchievementBadgeType[];
}

/**
 * Get badges by category
 */
export function getBadgesByCategory(category: BadgeCategory): BadgeConfig[] {
  return Object.values(BADGE_CONFIGS).filter((badge) => badge.category === category);
}

/**
 * Calculate total possible points
 */
export function getTotalPossiblePoints(): number {
  return Object.values(BADGE_CONFIGS).reduce((sum, badge) => sum + badge.points, 0);
}
