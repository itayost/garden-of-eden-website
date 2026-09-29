// Ranking Categories Configuration

import { DRIBBLING_TEST_KEYS } from "@/types/assessment";
import type { RankingCategory, CategoryConfig } from "../../types";

export const RANKING_CATEGORIES: Record<RankingCategory, CategoryConfig> = {
  sprint: {
    id: "sprint",
    labelHe: "ספרינט",
    metrics: ["sprint_5m", "sprint_10m", "sprint_20m"],
    primaryMetric: "sprint_10m",
    lowerIsBetter: true,
    icon: "Zap",
  },
  jump: {
    id: "jump",
    labelHe: "ניתור",
    metrics: ["jump_2leg_distance", "jump_2leg_height", "jump_right_leg", "jump_left_leg"],
    primaryMetric: "jump_2leg_distance",
    lowerIsBetter: false,
    icon: "ArrowUp",
  },
  agility: {
    id: "agility",
    labelHe: "זריזות",
    metrics: ["blaze_spot_time"],
    primaryMetric: "blaze_spot_time",
    lowerIsBetter: false,
    icon: "Shuffle",
  },
  flexibility: {
    id: "flexibility",
    labelHe: "גמישות",
    metrics: ["flexibility_ankle", "flexibility_knee", "flexibility_hip"],
    primaryMetric: "flexibility_hip",
    lowerIsBetter: false,
    icon: "Move",
  },
  power: {
    id: "power",
    labelHe: "כוח",
    metrics: ["kick_power_right_foot", "kick_power_left_foot"],
    primaryMetric: "kick_power_right_foot",
    lowerIsBetter: false,
    icon: "Target",
  },
  dribbling: {
    id: "dribbling",
    labelHe: "כדרור",
    metrics: [...DRIBBLING_TEST_KEYS],
    primaryMetric: "sprint_10m_h_ball",
    lowerIsBetter: true,
    icon: "Footprints",
  },
};

export const CATEGORY_ORDER: RankingCategory[] = [
  "sprint",
  "jump",
  "agility",
  "flexibility",
  "power",
  "dribbling",
];

export function getCategoryConfig(category: RankingCategory): CategoryConfig {
  return RANKING_CATEGORIES[category];
}

export function getAllCategories(): CategoryConfig[] {
  return CATEGORY_ORDER.map((id) => RANKING_CATEGORIES[id]);
}
