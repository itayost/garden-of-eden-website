// Shared Math Utility Functions

/**
 * Calculate percentile for a value in a group
 * Returns 0-100 where higher = better (top of group)
 */
export function calculatePercentile(
  value: number,
  allValues: number[],
  lowerIsBetter: boolean
): number {
  if (allValues.length === 0) return 50;

  // Count how many are worse than this value
  const worseCount = allValues.filter((v) =>
    lowerIsBetter ? v > value : v < value
  ).length;

  // Percentile = (number of worse values / total) * 100
  return Math.round((worseCount / allValues.length) * 100);
}
