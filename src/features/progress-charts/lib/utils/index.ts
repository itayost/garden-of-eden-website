// Chart Utility Functions

import type { DateRangePreset, DateRange } from "../../types";

// ===========================================
// DATE UTILITIES
// ===========================================

/**
 * Calculate date from preset
 */
export function calculateDateFromPreset(preset: DateRangePreset): Date | null {
  if (preset === "all") return null;

  const now = new Date();
  const cutoff = new Date(now);

  switch (preset) {
    case "3m":
      cutoff.setMonth(now.getMonth() - 3);
      break;
    case "6m":
      cutoff.setMonth(now.getMonth() - 6);
      break;
    case "1yr":
      cutoff.setFullYear(now.getFullYear() - 1);
      break;
  }

  return cutoff;
}

/**
 * Filter items by date range
 */
export function filterByDateRange<T extends { date: string }>(
  items: T[],
  range: DateRange
): T[] {
  if (range.preset === "all" || !range.from) return items;

  return items.filter((item) => {
    const itemDate = new Date(item.date);
    return itemDate >= range.from!;
  });
}

/**
 * Format date for Hebrew display (short format)
 */
export function formatHebrewDate(dateStr: string, format: "short" | "long" = "short"): string {
  const date = new Date(dateStr);

  if (format === "short") {
    return date.toLocaleDateString("he-IL", {
      day: "numeric",
      month: "short",
    });
  }

  return date.toLocaleDateString("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// ===========================================
// PERCENTILE UTILITIES
// ===========================================

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
 * Format percentile for display
 */
export function formatPercentile(percentile: number): string {
  if (percentile >= 90) return `Top ${100 - percentile}%`;
  if (percentile >= 75) return "Top 25%";
  if (percentile >= 50) return "Top 50%";
  return `${percentile}%`;
}

// ===========================================
// TREND UTILITIES
// ===========================================

/**
 * Calculate trend between first and last value
 */
export function calculateTrend(
  data: { value: number }[],
  lowerIsBetter: boolean
): {
  percentChange: number;
  isImproving: boolean;
  direction: "up" | "down" | "stable";
} {
  if (data.length < 2) {
    return { percentChange: 0, isImproving: false, direction: "stable" };
  }

  const first = data[0].value;
  const last = data[data.length - 1].value;

  if (first === 0) {
    return { percentChange: 0, isImproving: false, direction: "stable" };
  }

  const percentChange = ((last - first) / first) * 100;
  const isImproving = lowerIsBetter ? percentChange < 0 : percentChange > 0;
  const direction = percentChange > 0.5 ? "up" : percentChange < -0.5 ? "down" : "stable";

  return { percentChange, isImproving, direction };
}

// ===========================================
// COLOR UTILITIES
// ===========================================

/**
 * Get color for percentile badge
 */
export function getPercentileColor(percentile: number): string {
  if (percentile >= 90) return "text-yellow-500";
  if (percentile >= 75) return "text-green-500";
  if (percentile >= 50) return "text-blue-500";
  return "text-muted-foreground";
}

/**
 * Get background color for percentile badge
 */
export function getPercentileBgColor(percentile: number): string {
  if (percentile >= 90) return "bg-yellow-500/10";
  if (percentile >= 75) return "bg-green-500/10";
  if (percentile >= 50) return "bg-blue-500/10";
  return "bg-muted";
}

/**
 * Get trend color
 */
export function getTrendColor(isImproving: boolean): string {
  return isImproving ? "text-green-500" : "text-red-500";
}
