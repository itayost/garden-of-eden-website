export { aggregateSleepDataByMonth, formatMonthHebrew } from "./sleep-analytics";

import { NUTRITION_MEETING_THRESHOLD_DAYS } from "../config";

/**
 * Check if user should see nutrition meeting banner
 * (configured threshold days have passed since registration)
 */
export function shouldShowNutritionMeeting(userCreatedAt: string): boolean {
  const createdDate = new Date(userCreatedAt);
  const now = new Date();
  const daysSinceCreation = Math.floor(
    (now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24)
  );
  return daysSinceCreation >= NUTRITION_MEETING_THRESHOLD_DAYS;
}

/**
 * Format date for display in Hebrew locale
 */
export function formatDateHe(date: string): string {
  return new Date(date).toLocaleDateString("he-IL", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
