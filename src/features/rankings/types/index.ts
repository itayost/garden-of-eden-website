// Rankings Feature Type Definitions

import type { AgeGroup } from "@/types/assessment";

// ===========================================
// RANKING CATEGORIES
// ===========================================

export type RankingCategory = "sprint" | "jump" | "agility" | "flexibility" | "power";

export interface CategoryConfig {
  id: RankingCategory;
  labelHe: string;
  metrics: string[];
  primaryMetric: string;
  lowerIsBetter: boolean;
  icon: string; // lucide icon name
}

// ===========================================
// RANKING ENTRIES
// ===========================================

export interface RankingEntry {
  userId: string;
  userName: string;
  ageGroupId: string;
  metricValue: number;
  rank: number;
  percentile: number;
  assessmentDate: string;
}

export interface CategoryLeader {
  category: RankingCategory;
  categoryLabelHe: string;
  leader: RankingEntry | null;
  totalPlayers: number;
}

// ===========================================
// GROUP STATISTICS
// ===========================================

export interface GroupStatistics {
  average: number;
  median: number;
  min: number;
  max: number;
  count: number;
}

export interface DistributionBin {
  rangeStart: number;
  rangeEnd: number;
  count: number;
  label: string;
}

export interface AgeGroupOption {
  id: string;
  label: string;
}

// ===========================================
// PAGE DATA
// ===========================================

export interface RankingsPageData {
  categoryLeaders: CategoryLeader[];
  rankings: RankingEntry[];
  statistics: GroupStatistics | null;
  distribution: DistributionBin[];
  selectedCategory: RankingCategory;
  selectedAgeGroup: AgeGroup | null;
  currentUserId: string;
  ageGroupCounts: Record<string, number>;
}
