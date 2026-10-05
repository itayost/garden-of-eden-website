import { getIsraelTime } from "@/lib/utils/israel-time";

/** Plan reminders go out at 09:00 Israel time, summer and winter (owner, 2026-10-06). */
export const REMINDER_HOUR = 9;

/**
 * Vercel crons run on UTC and Israel moves between UTC+3 and UTC+2, so the
 * cron fires at 06:00 and 07:00 UTC and only the run in Israel's 09:00 hour
 * does the work.
 */
export function isReminderHour(now: Date): boolean {
  return getIsraelTime(now).hour === REMINDER_HOUR;
}
