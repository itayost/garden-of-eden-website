/** Sleep range colors for chart */
export const SLEEP_COLORS = {
  poor: "#ef4444",
  moderate: "#f59e0b",
  good: "#10b981",
} as const;

/** Sleep range labels for chart legend */
export const SLEEP_LEGEND_LABELS: Record<string, string> = {
  poor: "4-6 שעות",
  moderate: "6-8 שעות",
  good: "8-11 שעות",
};

/** Threshold for nutrition meeting alert (in days) */
export const NUTRITION_MEETING_THRESHOLD_DAYS = 30;
