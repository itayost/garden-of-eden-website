"use server";

import { createClient } from "@/lib/supabase/server";
import type { PlayerAssessment } from "@/types/assessment";
import { getAgeGroup } from "@/types/assessment";
import type {
  RankingEntry,
  CategoryLeader,
  GroupStatistics,
  DistributionBin,
  RankingCategory,
  AgeGroupOption,
} from "../../types";
import { RANKING_CATEGORIES } from "../config/categories";
import {
  getLatestAssessmentPerUser,
  calculateRankings,
  calculateGroupStatistics,
  createDistributionBins,
  extractMetricValues,
} from "../utils/ranking-utils";

// ===========================================
// TYPES
// ===========================================

export interface RankingsData {
  categoryLeaders: CategoryLeader[];
  leaderboard: RankingEntry[];
  statistics: GroupStatistics | null;
  distribution: DistributionBin[];
  totalPlayers: number;
  currentUserRank: RankingEntry | null;
  selectedCategory: RankingCategory;
  selectedAgeGroup: string;
  availableAgeGroups: AgeGroupOption[];
}

// ===========================================
// SERVER ACTIONS
// ===========================================

/**
 * Get rankings data for a specific age group and category
 */
export async function getRankingsData(
  ageGroupId: string = "all",
  category: RankingCategory = "sprint"
): Promise<RankingsData> {
  const supabase = await createClient();

  // Get current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Fetch all trainee profiles with birthdates
  const { data: profiles, error: profilesError } = (await supabase
    .from("profiles")
    .select("id, full_name, birthdate")
    .eq("role", "trainee")) as unknown as {
    data: { id: string; full_name: string | null; birthdate: string | null }[] | null;
    error: Error | null;
  };

  if (profilesError) {
    console.error("Error fetching profiles:", profilesError);
    return createEmptyRankingsData(category, ageGroupId);
  }

  if (!profiles || profiles.length === 0) {
    return createEmptyRankingsData(category, ageGroupId);
  }

  // Build user names map and filter by age group
  const userNames = new Map<string, string>();
  const userAgeGroups = new Map<string, string>();
  const ageGroupCounts = new Map<string, number>();

  for (const profile of profiles) {
    userNames.set(profile.id, profile.full_name || "Unknown");
    const ageGroup = getAgeGroup(profile.birthdate);
    const ageGroupKey = ageGroup?.id || "unknown";
    userAgeGroups.set(profile.id, ageGroupKey);

    // Count profiles per age group
    ageGroupCounts.set(ageGroupKey, (ageGroupCounts.get(ageGroupKey) || 0) + 1);
  }

  // Get filtered user IDs based on age group selection
  const filteredUserIds =
    ageGroupId === "all"
      ? profiles.map((p) => p.id)
      : profiles.filter((p) => userAgeGroups.get(p.id) === ageGroupId).map((p) => p.id);

  if (filteredUserIds.length === 0) {
    return createEmptyRankingsData(category, ageGroupId);
  }

  // Fetch all assessments for filtered users
  const { data: assessments, error: assessmentsError } = (await supabase
    .from("player_assessments")
    .select("*")
    .in("user_id", filteredUserIds)) as unknown as {
    data: PlayerAssessment[] | null;
    error: Error | null;
  };

  if (assessmentsError) {
    console.error("Error fetching assessments:", assessmentsError);
    return createEmptyRankingsData(category, ageGroupId);
  }

  if (!assessments || assessments.length === 0) {
    return createEmptyRankingsData(category, ageGroupId);
  }

  // Get latest assessment per user
  const latestAssessments = getLatestAssessmentPerUser(assessments);

  // Get category config
  const categoryConfig = RANKING_CATEGORIES[category];
  const metric = categoryConfig.primaryMetric;
  const lowerIsBetter = categoryConfig.lowerIsBetter;

  // Calculate rankings for selected category
  const leaderboard = calculateRankings(latestAssessments, userNames, metric, lowerIsBetter);

  // Add age group to each entry
  for (const entry of leaderboard) {
    entry.ageGroupId = userAgeGroups.get(entry.userId) || "unknown";
  }

  // Calculate category leaders for all 5 categories
  const categoryLeaders: CategoryLeader[] = [];

  for (const [catId, catConfig] of Object.entries(RANKING_CATEGORIES)) {
    const catRankings = calculateRankings(
      latestAssessments,
      userNames,
      catConfig.primaryMetric,
      catConfig.lowerIsBetter
    );

    categoryLeaders.push({
      category: catId as RankingCategory,
      categoryLabelHe: catConfig.labelHe,
      leader: catRankings.length > 0 ? catRankings[0] : null,
      totalPlayers: catRankings.length,
    });
  }

  // Calculate statistics and distribution for selected category
  const metricValues = extractMetricValues(latestAssessments, metric);
  const statistics = calculateGroupStatistics(metricValues);
  const distribution = createDistributionBins(metricValues, 8);

  // Find current user's rank
  let currentUserRank: RankingEntry | null = null;
  if (user) {
    currentUserRank = leaderboard.find((entry) => entry.userId === user.id) || null;
  }

  // Build available age groups
  const availableAgeGroups: AgeGroupOption[] = [{ id: "all", label: "כל הגילאים" }];

  // Add age groups that have players
  const ageGroupLabels: Record<string, string> = {
    U10: "עד גיל 10",
    U12: "עד גיל 12",
    U15: "עד גיל 15",
    U18: "עד גיל 18",
    Senior: "בוגרים",
  };

  for (const [groupId, count] of ageGroupCounts) {
    if (groupId !== "unknown" && count > 0) {
      availableAgeGroups.push({
        id: groupId,
        label: ageGroupLabels[groupId] || groupId,
      });
    }
  }

  return {
    categoryLeaders,
    leaderboard,
    statistics,
    distribution,
    totalPlayers: latestAssessments.size,
    currentUserRank,
    selectedCategory: category,
    selectedAgeGroup: ageGroupId,
    availableAgeGroups,
  };
}

/**
 * Create empty rankings data structure
 */
function createEmptyRankingsData(
  category: RankingCategory,
  ageGroupId: string
): RankingsData {
  return {
    categoryLeaders: Object.entries(RANKING_CATEGORIES).map(([catId, config]) => ({
      category: catId as RankingCategory,
      categoryLabelHe: config.labelHe,
      leader: null,
      totalPlayers: 0,
    })),
    leaderboard: [],
    statistics: null,
    distribution: [],
    totalPlayers: 0,
    currentUserRank: null,
    selectedCategory: category,
    selectedAgeGroup: ageGroupId,
    availableAgeGroups: [{ id: "all", label: "כל הגילאים" }],
  };
}
