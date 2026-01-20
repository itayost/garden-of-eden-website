// Data Transformation Functions for Progress Charts

import type { PlayerAssessment } from "@/types/assessment";
import {
  calculateCardRatings,
  calculateNeutralRatings,
  type GroupStats,
} from "@/lib/assessment-to-rating";
import type {
  ChartDataPoint,
  PhysicalMetricKey,
  PhysicalMetricChartData,
  RatingDataPoint,
  PercentileRanking,
} from "../../types";
import { METRIC_DEFINITIONS } from "../config/metric-definitions";
import {
  formatHebrewDate,
  calculatePercentile,
  formatPercentile,
} from "../utils";

// ===========================================
// PHYSICAL METRICS TRANSFORM
// ===========================================

/**
 * Transform assessments to chart data for a specific physical metric
 */
export function transformToPhysicalChartData(
  assessments: PlayerAssessment[],
  metric: PhysicalMetricKey
): PhysicalMetricChartData {
  const definition = METRIC_DEFINITIONS[metric];

  // Sort by date ascending (oldest first for timeline)
  const sorted = [...assessments].sort(
    (a, b) =>
      new Date(a.assessment_date).getTime() - new Date(b.assessment_date).getTime()
  );

  const data: ChartDataPoint[] = sorted
    .filter((a) => a[metric] !== null && a[metric] !== undefined)
    .map((a) => ({
      date: a.assessment_date,
      dateDisplay: formatHebrewDate(a.assessment_date),
      value: a[metric] as number,
    }));

  return {
    metric,
    data,
    unit: definition.unit,
    labelHe: definition.labelHe,
    lowerIsBetter: definition.lowerIsBetter,
  };
}

/**
 * Transform assessments to chart data for all physical metrics in a category
 */
export function transformCategoryToChartData(
  assessments: PlayerAssessment[],
  metrics: PhysicalMetricKey[]
): PhysicalMetricChartData[] {
  return metrics.map((metric) => transformToPhysicalChartData(assessments, metric));
}

// ===========================================
// RATING TRANSFORM
// ===========================================

/**
 * Transform assessments to rating chart data
 */
export function transformToRatingChartData(
  assessments: PlayerAssessment[],
  groupStats: GroupStats | null
): RatingDataPoint[] {
  // Sort by date ascending
  const sorted = [...assessments].sort(
    (a, b) =>
      new Date(a.assessment_date).getTime() - new Date(b.assessment_date).getTime()
  );

  return sorted.map((assessment) => {
    const ratings = groupStats
      ? calculateCardRatings(assessment, groupStats)
      : calculateNeutralRatings();

    return {
      date: assessment.assessment_date,
      dateDisplay: formatHebrewDate(assessment.assessment_date),
      value: ratings.overall_rating,
      pace: ratings.pace,
      shooting: ratings.shooting,
      passing: ratings.passing,
      dribbling: ratings.dribbling,
      defending: ratings.defending,
      physical: ratings.physical,
      overall_rating: ratings.overall_rating,
    };
  });
}

// ===========================================
// PERCENTILE TRANSFORM
// ===========================================

/**
 * Calculate percentile rankings for latest assessment
 */
export function calculatePercentileRankings(
  latestAssessment: PlayerAssessment,
  allAgeGroupAssessments: PlayerAssessment[]
): PercentileRanking[] {
  // Key metrics to show percentiles for
  const metricsToShow: PhysicalMetricKey[] = [
    "sprint_5m",
    "sprint_10m",
    "jump_2leg_distance",
    "jump_2leg_height",
  ];

  return metricsToShow
    .map((metric) => {
      const value = latestAssessment[metric];
      if (value === null || value === undefined) return null;

      const definition = METRIC_DEFINITIONS[metric];

      // Get all values for this metric from age group
      const allValues = allAgeGroupAssessments
        .map((a) => a[metric])
        .filter((v): v is number => v !== null && v !== undefined);

      if (allValues.length === 0) return null;

      const percentile = calculatePercentile(
        value,
        allValues,
        definition.lowerIsBetter
      );

      return {
        metric,
        metricLabelHe: definition.labelHe,
        percentile,
        percentileDisplay: formatPercentile(percentile),
        value,
        unit: definition.unit,
      };
    })
    .filter((p): p is PercentileRanking => p !== null)
    .sort((a, b) => b.percentile - a.percentile); // Best first
}

// ===========================================
// DELTA CALCULATION
// ===========================================

/**
 * Calculate improvement delta between two assessments
 */
export function calculateDelta(
  latest: PlayerAssessment,
  previous: PlayerAssessment,
  metric: PhysicalMetricKey
): {
  delta: number | null;
  percentChange: number | null;
  isImproving: boolean | null;
} {
  const latestValue = latest[metric];
  const previousValue = previous[metric];

  if (latestValue === null || latestValue === undefined ||
      previousValue === null || previousValue === undefined) {
    return { delta: null, percentChange: null, isImproving: null };
  }

  const definition = METRIC_DEFINITIONS[metric];
  const delta = latestValue - previousValue;
  const percentChange = previousValue !== 0 ? (delta / previousValue) * 100 : 0;
  const isImproving = definition.lowerIsBetter ? delta < 0 : delta > 0;

  return { delta, percentChange, isImproving };
}

/**
 * Get all deltas between latest and previous assessment
 */
export function getAllDeltas(
  latest: PlayerAssessment,
  previous: PlayerAssessment
): Map<PhysicalMetricKey, ReturnType<typeof calculateDelta>> {
  const deltas = new Map<PhysicalMetricKey, ReturnType<typeof calculateDelta>>();

  (Object.keys(METRIC_DEFINITIONS) as PhysicalMetricKey[]).forEach((metric) => {
    deltas.set(metric, calculateDelta(latest, previous, metric));
  });

  return deltas;
}
