import { addDays } from "@/lib/utils/iso-date";
import type { Week, WeekDay } from "@/lib/utils/schedule-week";
import { isValidDateString } from "@/lib/validations/common";

/**
 * A season in each direction covers every real use. The bound keeps a
 * hand-typed ?date= from reaching dates the ISO arithmetic cannot express
 * (addDays("9999-12-31", 1) is "+010000-01"), same as the weekly page.
 */
export const MAX_CALENDAR_OFFSET_DAYS = 364;

/** ISO strings compare lexicographically, so bounds are checked as strings. */
export function resolveCalendarDate(raw: string | undefined, today: string): string {
  if (!raw || !isValidDateString(raw)) return today;
  if (raw < addDays(today, -MAX_CALENDAR_OFFSET_DAYS)) return today;
  if (raw > addDays(today, MAX_CALENDAR_OFFSET_DAYS)) return today;
  return raw;
}

/** The days the calendar shows: Sunday to Friday, and Saturday only when it holds something. */
export function visibleDays(week: Week): WeekDay[] {
  return week.saturday ? [...week.days, week.saturday] : week.days;
}

/** Null for a Saturday with nothing on it, which the calendar renders as an empty day. */
export function findDay(week: Week, date: string): WeekDay | null {
  return visibleDays(week).find((candidate) => candidate.date === date) ?? null;
}
