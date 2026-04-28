import { z } from "zod";
import { getIsraelTime } from "@/lib/utils/israel-time";
import { MAX_SHORT_TEXT } from "@/lib/validations/forms";

export function todayInIsrael(now: Date = new Date()): string {
  return getIsraelTime(now).dateStr;
}

export const nextGameSchema = z.object({
  game_date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "נא לבחור תאריך תקין")
    .refine((val) => val >= todayInIsrael(), {
      message: "נא לבחור תאריך משחק עתידי",
    }),
  opponent: z
    .string()
    .trim()
    .min(1, "נא להזין שם יריב")
    .max(MAX_SHORT_TEXT, `שם היריב מוגבל ל-${MAX_SHORT_TEXT} תווים`),
});

export type NextGameInput = z.infer<typeof nextGameSchema>;
