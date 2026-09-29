// Progress Charts Type Definitions

import type { NumericMetricKey } from "@/lib/utils/assessment-metrics";

// ===========================================
// DATE RANGE TYPES
// ===========================================

export type DateRangePreset = "3m" | "6m" | "1yr" | "all";

export interface DateRange {
  from: Date | null;
  to: Date | null;
  preset: DateRangePreset;
}

// ===========================================
// CHART DATA TYPES
// ===========================================

export interface ChartDataPoint {
  date: string; // ISO date string
  dateDisplay: string; // Hebrew formatted date
  value: number;
}

export type PhysicalMetricKey = NumericMetricKey;

export interface PhysicalMetricChartData {
  metric: PhysicalMetricKey;
  data: ChartDataPoint[];
  unit: string;
  labelHe: string;
  lowerIsBetter: boolean;
}

export interface RatingDataPoint extends Omit<ChartDataPoint, "value"> {
  value: number | null;
  pace: number | null;
  shooting: number | null;
  passing: number | null;
  dribbling: number | null;
  defending: number | null;
  physical: number | null;
  overall_rating: number | null;
}

// ===========================================
// PERCENTILE TYPES
// ===========================================

export interface PercentileRanking {
  metric: PhysicalMetricKey;
  metricLabelHe: string;
  percentile: number; // 0-100
  percentileDisplay: string; // "Top 15%"
  value: number;
  unit: string;
}

// ===========================================
// METRIC DEFINITION
// ===========================================

export type MetricCategory = "sprint" | "dribbling" | "jump" | "agility" | "flexibility" | "power";

export interface MetricDefinition {
  key: PhysicalMetricKey;
  labelHe: string;
  unit: string;
  lowerIsBetter: boolean;
  color: string;
  category: MetricCategory;
}
