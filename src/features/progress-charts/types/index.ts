// Progress Charts Type Definitions

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

export type PhysicalMetricKey =
  | "sprint_5m"
  | "sprint_10m"
  | "sprint_20m"
  | "jump_2leg_distance"
  | "jump_2leg_height"
  | "jump_right_leg"
  | "jump_left_leg"
  | "blaze_spot_time"
  | "flexibility_ankle"
  | "flexibility_knee"
  | "flexibility_hip"
  | "kick_power_kaiser";

export interface PhysicalMetricChartData {
  metric: PhysicalMetricKey;
  data: ChartDataPoint[];
  unit: string;
  labelHe: string;
  lowerIsBetter: boolean;
}

export interface RatingDataPoint extends ChartDataPoint {
  pace: number;
  shooting: number;
  passing: number;
  dribbling: number;
  defending: number;
  physical: number;
  overall_rating: number;
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

export type MetricCategory = "sprint" | "jump" | "agility" | "flexibility" | "power";

export interface MetricDefinition {
  key: PhysicalMetricKey;
  labelHe: string;
  unit: string;
  lowerIsBetter: boolean;
  color: string;
  category: MetricCategory;
}
