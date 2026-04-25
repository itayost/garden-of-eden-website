// Data Transformation Functions for Progress Charts

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlayerAssessment } from "@/types/assessment";
import { getPlayerRatingHistory } from "@/lib/utils/get-player-ratings";
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
  assessments: readonly PlayerAssessment[],
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
  assessments: readonly PlayerAssessment[],
  metrics: PhysicalMetricKey[]
): PhysicalMetricChartData[] {
  return metrics.map((metric) => transformToPhysicalChartData(assessments, metric));
}

// ===========================================
// RATING TRANSFORM
// ===========================================

/**
 * Transform stored rating snapshots into chart-ready data points.
 * Reads from player_rating_snapshots — ratings are frozen at assessment
 * write time, so historical points don't shift when new trainees join
 * the cohort.
 */
export async function transformToRatingChartData(
  supabase: SupabaseClient,
  userId: string
): Promise<RatingDataPoint[]> {
  const history = await getPlayerRatingHistory(supabase, userId);
  return history.map((snapshot) => ({
    date: snapshot.date,
    dateDisplay: formatHebrewDate(snapshot.date),
    value: snapshot.overall_rating,
    pace: snapshot.pace,
    shooting: snapshot.shooting,
    passing: snapshot.passing,
    dribbling: snapshot.dribbling,
    defending: snapshot.defending,
    physical: snapshot.physical,
    overall_rating: snapshot.overall_rating,
  }));
}

// ===========================================
// PERCENTILE TRANSFORM
// ===========================================

/**
 * Calculate percentile rankings for latest assessment
 */
export function calculatePercentileRankings(
  latestAssessment: PlayerAssessment,
  allAgeGroupAssessments: readonly PlayerAssessment[]
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
