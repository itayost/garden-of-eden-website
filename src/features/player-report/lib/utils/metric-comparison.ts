export type MetricDirection = "lower_is_better" | "higher_is_better" | "categorical";

export type ComparisonResult = "improved" | "declined" | "unchanged" | "categorical";

const LOWER_IS_BETTER = new Set([
  "sprint_5m",
  "sprint_10m",
  "sprint_20m",
  "blaze_spot_time",
]);

const HIGHER_IS_BETTER = new Set([
  "jump_2leg_height",
  "jump_2leg_distance",
  "jump_right_leg",
  "jump_left_leg",
  "kick_power_kaiser",
  "kick_power_right_foot",
  "kick_power_left_foot",
  "flexibility_ankle",
  "flexibility_knee",
  "flexibility_hip",
]);

export function getMetricDirection(key: string): MetricDirection {
  if (LOWER_IS_BETTER.has(key)) return "lower_is_better";
  if (HIGHER_IS_BETTER.has(key)) return "higher_is_better";
  return "categorical";
}

export function compareMetric(
  key: string,
  latest: string | number | null,
  previous: string | number | null,
): ComparisonResult | null {
  const direction = getMetricDirection(key);

  if (direction === "categorical") return "categorical";
  if (latest === null || previous === null) return null;

  const latestNum = Number(latest);
  const previousNum = Number(previous);

  if (isNaN(latestNum) || isNaN(previousNum)) return null;
  if (latestNum === previousNum) return "unchanged";

  const improved =
    direction === "lower_is_better"
      ? latestNum < previousNum
      : latestNum > previousNum;

  return improved ? "improved" : "declined";
}
