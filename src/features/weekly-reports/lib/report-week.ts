/**
 * The Report week and the hours the weekly report jobs act in. Pure.
 *
 * A Report week runs Friday to Thursday and is named by its Friday
 * (`week_start`). Dates are bare ISO strings (Israel calendar days) and the
 * arithmetic is in UTC, so the server's zone and daylight saving never move a
 * day. The clock rules take an IsraelTime (getIsraelTime()), which already
 * accounts for the offset of the day.
 */
import type { IsraelTime } from "@/lib/utils/israel-time";
import { addDays, daysBetween, shortDate } from "@/lib/utils/iso-date";

const FRIDAY = 5;
const THURSDAY = 4;
const SUNDAY = 0;
const DAYS_IN_WEEK = 7;

/** The batch request goes out at 01:00 on Friday. */
const START_HOUR = 1;
/** Whatever the batch did not write is written directly from 07:30 to 11:59. */
const FINISH_FROM_MINUTES = 7 * 60 + 30;
const FINISH_UNTIL_HOUR = 12;
/** Friday's send is at 12:00, the catch-up on Sunday to Thursday at 09:00. */
const FRIDAY_SEND_HOUR = 12;
const WEEKDAY_SEND_HOUR = 9;

/** 0 Sunday to 6 Saturday, from the date alone. */
export function weekdayOf(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** The Friday on or before `date`. */
export function reportWeekStart(date: string): string {
  const back = (weekdayOf(date) - FRIDAY + DAYS_IN_WEEK) % DAYS_IN_WEEK;
  return addDays(date, -back);
}

/** The Thursday that ends the week. */
export function reportWeekEnd(start: string): string {
  return addDays(start, DAYS_IN_WEEK - 1);
}

/** The seven dates of the week, Friday first. */
export function reportWeekDays(start: string): string[] {
  return Array.from({ length: DAYS_IN_WEEK }, (_, i) => addDays(start, i));
}

/**
 * The week that ended on the most recent Thursday before `today`: written in
 * the night to Friday and sent until the next Thursday. "The current Report
 * week" in every screen and job means this one.
 */
export function lastCompletedWeekStart(today: string): string {
  return addDays(reportWeekStart(today), -DAYS_IN_WEEK);
}

/** Whole weeks from one Friday start to a later one. */
export function weeksBetween(earlierStart: string, laterStart: string): number {
  return Math.trunc(daysBetween(earlierStart, laterStart) / DAYS_IN_WEEK);
}

/** "13.11 עד 19.11": day.month, no year. */
export function reportWeekLabel(start: string): string {
  return `${shortDate(start)} עד ${shortDate(reportWeekEnd(start))}`;
}

/**
 * Which part of the write job runs now: "start" sends the batch on Friday at
 * 01:00, "finish" writes what is missing on Friday from 07:30 to 11:59.
 */
export function writePhase(now: IsraelTime): "start" | "finish" | null {
  if (now.dayOfWeek !== FRIDAY) return null;
  if (now.hour === START_HOUR) return "start";
  const minutes = now.hour * 60 + now.minute;
  if (minutes >= FINISH_FROM_MINUTES && now.hour < FINISH_UNTIL_HOUR) {
    return "finish";
  }
  return null;
}

/**
 * Friday at 12:00, or Sunday to Thursday at 09:00. Never on Friday at any other
 * hour and never on Saturday.
 */
export function isSendWindow(now: IsraelTime): boolean {
  if (now.dayOfWeek === FRIDAY) return now.hour === FRIDAY_SEND_HOUR;
  const weekday = now.dayOfWeek >= SUNDAY && now.dayOfWeek <= THURSDAY;
  return weekday && now.hour === WEEKDAY_SEND_HOUR;
}

const SATURDAY = 6;
const pad = (hour: number) => `${String(hour).padStart(2, "0")}:00`;

/** "השליחה הבאה: היום ב-12:00": when approved reports next go out, for the queue's header. */
export function nextSendLabel(now: IsraelTime): string {
  const at = (day: string, hour: number) => `השליחה הבאה: ${day} ב-${pad(hour)}`;
  if (now.dayOfWeek === FRIDAY && now.hour < FRIDAY_SEND_HOUR) return at("היום", FRIDAY_SEND_HOUR);
  if (now.dayOfWeek === FRIDAY || now.dayOfWeek === SATURDAY) return at("ראשון", WEEKDAY_SEND_HOUR);
  if (now.hour < WEEKDAY_SEND_HOUR) return at("היום", WEEKDAY_SEND_HOUR);
  return now.dayOfWeek === THURSDAY ? at("שישי", FRIDAY_SEND_HOUR) : at("מחר", WEEKDAY_SEND_HOUR);
}
