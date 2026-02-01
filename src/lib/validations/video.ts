import { z } from "zod";
import { getYouTubeId } from "@/lib/utils/youtube";

/**
 * Day topic suggestions (Hebrew) for each training day
 */
const dayTopicSuggestions = [
  "גמישות ויציבות",     // Day 1
  "כוח רגליים",          // Day 2
  "זריזות וקואורדינציה",  // Day 3
  "סיבולת לב-ריאה",     // Day 4
  "שיקום והתאוששות",    // Day 5
] as const;

/**
 * Get suggested day topic for a given day number
 *
 * @param dayNumber - Day number (1-5)
 * @returns Suggested topic for the day, or empty string if invalid
 *
 * @example
 * getDayTopicSuggestion(1) // "גמישות ויציבות"
 * getDayTopicSuggestion(3) // "זריזות וקואורדינציה"
 * getDayTopicSuggestion(6) // ""
 */
export function getDayTopicSuggestion(dayNumber: number): string {
  if (dayNumber < 1 || dayNumber > 5) return "";
  return dayTopicSuggestions[dayNumber - 1];
}

/**
 * Video validation schema for create/update operations
 *
 * Fields:
 * - title: Video title (2-200 chars, Hebrew messages)
 * - youtube_url: Valid YouTube URL that can be parsed for video ID
 * - day_number: Training day (1-5)
 * - day_topic: Topic/category for the day (2+ chars)
 * - duration_minutes: Video duration (1-120 minutes)
 * - description: Optional video description (max 1000 chars)
 * - order_index: Optional order within day (auto-calculated if not provided)
 */
export const videoSchema = z.object({
  title: z
    .string()
    .min(2, "כותרת חייבת להכיל לפחות 2 תווים")
    .max(200, "כותרת ארוכה מדי (מקסימום 200 תווים)"),

  youtube_url: z
    .string()
    .url("קישור לא תקין")
    .refine((url) => getYouTubeId(url) !== null, {
      message: "קישור YouTube לא תקין (פורמטים נתמכים: youtube.com/watch, youtu.be, youtube.com/shorts)",
    }),

  day_number: z.coerce
    .number()
    .min(1, "יום חייב להיות בין 1-5")
    .max(5, "יום חייב להיות בין 1-5"),

  day_topic: z
    .string()
    .min(2, "נושא היום חייב להכיל לפחות 2 תווים"),

  duration_minutes: z.coerce
    .number()
    .min(1, "משך חייב להיות לפחות דקה אחת")
    .max(120, "משך לא יכול לעלות על 120 דקות"),

  description: z
    .string()
    .max(1000, "תיאור ארוך מדי (מקסימום 1000 תווים)")
    .optional()
    .or(z.literal("")),

  order_index: z.coerce
    .number()
    .optional(),
});

export type VideoInput = z.infer<typeof videoSchema>;

/**
 * Form schema for react-hook-form (same validation but without coerce for type safety)
 * Use this for client-side forms, use videoSchema for server action validation
 */
export const videoFormSchema = z.object({
  title: z
    .string()
    .min(2, "כותרת חייבת להכיל לפחות 2 תווים")
    .max(200, "כותרת ארוכה מדי (מקסימום 200 תווים)"),

  youtube_url: z
    .string()
    .url("קישור לא תקין")
    .refine((url) => getYouTubeId(url) !== null, {
      message: "קישור YouTube לא תקין (פורמטים נתמכים: youtube.com/watch, youtu.be, youtube.com/shorts)",
    }),

  day_number: z
    .number()
    .min(1, "יום חייב להיות בין 1-5")
    .max(5, "יום חייב להיות בין 1-5"),

  day_topic: z
    .string()
    .min(2, "נושא היום חייב להכיל לפחות 2 תווים"),

  duration_minutes: z
    .number()
    .min(1, "משך חייב להיות לפחות דקה אחת")
    .max(120, "משך לא יכול לעלות על 120 דקות"),

  description: z
    .string()
    .max(1000, "תיאור ארוך מדי (מקסימום 1000 תווים)")
    .optional()
    .or(z.literal("")),

  order_index: z
    .number()
    .optional(),
});

export type VideoFormInput = z.infer<typeof videoFormSchema>;
