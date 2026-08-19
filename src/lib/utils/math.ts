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

/**
 * Completion as a whole percent, for progress bars and rings.
 *
 * Returns 0 rather than NaN or a negative when there is nothing to complete, and
 * caps at 100 so a stale count that exceeds the total cannot overflow a bar.
 */
export function progressPercent(done: number, total: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.round((done / total) * 100));
}
