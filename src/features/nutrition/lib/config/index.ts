/** Sleep range colors for chart */
/** Status tokens from globals.css; SVG fills resolve CSS variables. */
export const SLEEP_COLORS = {
  poor: "var(--destructive)",
  moderate: "var(--warning)",
  good: "var(--success)",
} as const;

/** Sleep range labels for chart legend */
export const SLEEP_LEGEND_LABELS: Record<string, string> = {
  poor: "4-6 שעות",
  moderate: "6-8 שעות",
  good: "8-11 שעות",
};

/** Threshold for nutrition meeting alert (in days) */
export const NUTRITION_MEETING_THRESHOLD_DAYS = 30;
