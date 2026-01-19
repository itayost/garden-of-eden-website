// Progress Charts Feature
// Re-export all public APIs

// Components
export {
  AssessmentProgressCharts,
  DateRangeFilter,
  MiniRatingChart,
  PercentileCard,
  PhysicalMetricChart,
  RatingTrendChart,
} from "./components";

// Hooks
export { useDateRangeFilter } from "./hooks/useDateRangeFilter";

// Types
export type {
  DateRange,
  DateRangePreset,
  ChartDataPoint,
  RatingDataPoint,
  PhysicalMetricChartData,
  PhysicalMetricKey,
  MetricCategory,
  MetricDefinition,
  PercentileRanking,
} from "./types";

// Utilities
export {
  calculateDateFromPreset,
  filterByDateRange,
  formatHebrewDate,
  calculatePercentile,
  formatPercentile,
  calculateTrend,
  getPercentileColor,
  getTrendColor,
} from "./lib/utils";

// Transforms
export {
  transformToPhysicalChartData,
  transformToRatingChartData,
  calculatePercentileRankings,
} from "./lib/transforms";

// Config
export {
  METRIC_DEFINITIONS,
  METRIC_CATEGORIES,
  RATING_COLORS,
  RATING_LABELS_HE,
  DATE_RANGE_PRESETS,
} from "./lib/config/metric-definitions";
