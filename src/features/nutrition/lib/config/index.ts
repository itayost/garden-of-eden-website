import type { DayOfWeek, MealCategory, DayMealPlan, WeeklyMealPlan } from "../../types";

/** Hebrew labels for days of week */
export const DAY_LABELS_HE: Record<DayOfWeek, string> = {
  sunday: "ראשון",
  monday: "שני",
  tuesday: "שלישי",
  wednesday: "רביעי",
  thursday: "חמישי",
  friday: "שישי",
  saturday: "שבת",
};

/** Ordered days for display */
export const ORDERED_DAYS: DayOfWeek[] = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

/** Hebrew labels for meal categories */
export const MEAL_LABELS_HE: Record<MealCategory, string> = {
  breakfast: "ארוחת בוקר",
  lunch: "ארוחת צהריים",
  dinner: "ארוחת ערב",
  snacks: "חטיפים",
};

/** Ordered meal categories for display */
export const ORDERED_MEALS: MealCategory[] = [
  "breakfast",
  "lunch",
  "dinner",
  "snacks",
];

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

/** Empty day meal plan template */
export const EMPTY_DAY_MEAL_PLAN: DayMealPlan = {
  breakfast: [],
  lunch: [],
  dinner: [],
  snacks: [],
};

/** Create a fresh empty weekly meal plan (new array instances per day) */
export const EMPTY_WEEKLY_MEAL_PLAN: WeeklyMealPlan = {
  sunday: { breakfast: [], lunch: [], dinner: [], snacks: [] },
  monday: { breakfast: [], lunch: [], dinner: [], snacks: [] },
  tuesday: { breakfast: [], lunch: [], dinner: [], snacks: [] },
  wednesday: { breakfast: [], lunch: [], dinner: [], snacks: [] },
  thursday: { breakfast: [], lunch: [], dinner: [], snacks: [] },
  friday: { breakfast: [], lunch: [], dinner: [], snacks: [] },
  saturday: { breakfast: [], lunch: [], dinner: [], snacks: [] },
};

/** Threshold for nutrition meeting alert (in days) */
export const NUTRITION_MEETING_THRESHOLD_DAYS = 30;
