/**
 * Canonical list of numeric metric keys used across the ratings pipeline.
 * Shared between get-player-ratings.ts and fetch-benchmarks.ts.
 */
export const NUMERIC_METRIC_KEYS = [
  "sprint_5m",
  "sprint_10m",
  "sprint_20m",
  "jump_2leg_distance",
  "jump_right_leg",
  "jump_left_leg",
  "jump_2leg_height",
  "blaze_spot_time",
  "flexibility_ankle",
  "flexibility_knee",
  "flexibility_hip",
  "kick_power_kaiser",
  "kick_power_right_foot",
  "kick_power_left_foot",
] as const;

export type NumericMetricKey = (typeof NUMERIC_METRIC_KEYS)[number];
