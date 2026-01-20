// Ranking Utility Functions

import type { PlayerAssessment } from "@/types/assessment";
import { calculatePercentile } from "@/features/progress-charts/lib/utils";
import type { RankingEntry, GroupStatistics, DistributionBin } from "../../types";

// ===========================================
// LATEST ASSESSMENT EXTRACTION
// ===========================================

/**
 * Get the latest assessment for each user
 */
export function getLatestAssessmentPerUser(
  assessments: PlayerAssessment[]
): Map<string, PlayerAssessment> {
  const latestByUser = new Map<string, PlayerAssessment>();

  for (const assessment of assessments) {
    const userId = assessment.user_id;
    const existing = latestByUser.get(userId);

    if (!existing) {
      latestByUser.set(userId, assessment);
    } else {
      // Compare dates - keep the later one
      const existingDate = new Date(existing.assessment_date);
      const currentDate = new Date(assessment.assessment_date);
      if (currentDate > existingDate) {
        latestByUser.set(userId, assessment);
      }
    }
  }

  return latestByUser;
}

// ===========================================
// RANKING CALCULATIONS
// ===========================================

/**
 * Calculate rankings for a specific metric
 */
export function calculateRankings(
  latestAssessments: Map<string, PlayerAssessment>,
  userNames: Map<string, string>,
  metric: string,
  lowerIsBetter: boolean
): RankingEntry[] {
  // Extract values with user info
  const entries: {
    userId: string;
    userName: string;
    value: number;
    assessmentDate: string;
  }[] = [];

  for (const [userId, assessment] of latestAssessments) {
    const value = assessment[metric as keyof PlayerAssessment] as number | null;
    const userName = userNames.get(userId) || "Unknown";

    if (value !== null && value !== undefined) {
      entries.push({
        userId,
        userName,
        value,
        assessmentDate: assessment.assessment_date,
      });
    }
  }

  if (entries.length === 0) {
    return [];
  }

  // Sort entries by value
  entries.sort((a, b) => {
    if (lowerIsBetter) {
      return a.value - b.value; // Lower is better, so ascending
    }
    return b.value - a.value; // Higher is better, so descending
  });

  // Get all values for percentile calculation
  const allValues = entries.map((e) => e.value);

  // Assign ranks (handle ties)
  const rankings: RankingEntry[] = [];
  let currentRank = 1;

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];

    // Check for tie with previous entry
    if (i > 0 && entries[i - 1].value === entry.value) {
      // Same rank as previous
      rankings.push({
        userId: entry.userId,
        userName: entry.userName,
        ageGroupId: "", // Will be filled by caller
        metricValue: entry.value,
        rank: rankings[i - 1].rank, // Same rank as previous
        percentile: calculatePercentile(entry.value, allValues, lowerIsBetter),
        assessmentDate: entry.assessmentDate,
      });
    } else {
      // Assign current rank (which accounts for any skipped ranks from ties)
      rankings.push({
        userId: entry.userId,
        userName: entry.userName,
        ageGroupId: "",
        metricValue: entry.value,
        rank: currentRank,
        percentile: calculatePercentile(entry.value, allValues, lowerIsBetter),
        assessmentDate: entry.assessmentDate,
      });
    }

    currentRank = i + 2; // Next position (1-indexed)
  }

  return rankings;
}

// ===========================================
// STATISTICS CALCULATIONS
// ===========================================

/**
 * Calculate median of an array of numbers
 */
export function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }

  return sorted[mid];
}

/**
 * Calculate group statistics for a set of values
 */
export function calculateGroupStatistics(values: number[]): GroupStatistics | null {
  if (values.length === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((acc, val) => acc + val, 0);
  const average = sum / values.length;

  return {
    count: values.length,
    min: sorted[0],
    max: sorted[sorted.length - 1],
    average: Math.round(average * 100) / 100,
    median: calculateMedian(values),
  };
}

// ===========================================
// DISTRIBUTION CALCULATIONS
// ===========================================

/**
 * Create distribution bins for histogram
 */
export function createDistributionBins(
  values: number[],
  binCount: number
): DistributionBin[] {
  if (values.length === 0) return [];

  const min = Math.min(...values);
  const max = Math.max(...values);

  // Handle case where all values are the same
  if (min === max) {
    return [
      {
        rangeStart: min,
        rangeEnd: max,
        count: values.length,
        label: `${min}`,
      },
    ];
  }

  const binWidth = (max - min) / binCount;
  const bins: DistributionBin[] = [];

  for (let i = 0; i < binCount; i++) {
    const rangeStart = min + i * binWidth;
    const rangeEnd = min + (i + 1) * binWidth;

    bins.push({
      rangeStart,
      rangeEnd,
      count: 0,
      label: `${rangeStart.toFixed(1)}-${rangeEnd.toFixed(1)}`,
    });
  }

  // Count values in each bin
  for (const value of values) {
    // Find which bin this value belongs to
    const binIndex = Math.min(
      Math.floor((value - min) / binWidth),
      binCount - 1
    );
    bins[binIndex].count++;
  }

  return bins;
}

// ===========================================
// HELPER FUNCTIONS
// ===========================================

/**
 * Extract metric values from assessments
 */
export function extractMetricValues(
  assessments: Map<string, PlayerAssessment>,
  metric: string
): number[] {
  const values: number[] = [];

  for (const assessment of assessments.values()) {
    const value = assessment[metric as keyof PlayerAssessment] as number | null;
    if (value !== null && value !== undefined) {
      values.push(value);
    }
  }

  return values;
}
