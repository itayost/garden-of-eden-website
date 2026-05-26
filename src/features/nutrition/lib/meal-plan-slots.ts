import type { MealPlanType, TraineeMealPlanRow } from "../types";

/** Ordered list of plan types — used for iteration in UI and validation */
export const MEAL_PLAN_TYPES: readonly MealPlanType[] = [
  "workout_day",
  "rest_day",
];

/** DB column names for each plan-type slot on trainee_meal_plans */
export const MEAL_PLAN_SLOT_COLUMNS = {
  workout_day: {
    url: "workout_day_pdf_url",
    path: "workout_day_pdf_path",
  },
  rest_day: {
    url: "rest_day_pdf_url",
    path: "rest_day_pdf_path",
  },
} as const;

/** Read the PDF URL for the given plan type, or null if no plan */
export function pdfUrlFor(
  plan: TraineeMealPlanRow | null,
  planType: MealPlanType
): string | null {
  if (!plan) return null;
  return plan[MEAL_PLAN_SLOT_COLUMNS[planType].url];
}

/** Read the storage path for the given plan type, or null if no plan */
export function pdfPathFor(
  plan: TraineeMealPlanRow | null,
  planType: MealPlanType
): string | null {
  if (!plan) return null;
  return plan[MEAL_PLAN_SLOT_COLUMNS[planType].path];
}
