import {
  MORNING_SHIFT_END_HOUR,
  MORNING_SHIFT_START_HOUR,
  type ShiftPeriod,
} from "@/lib/constants/shifts";

const ISRAEL_TZ = "Asia/Jerusalem";

export interface IsraelTime {
  /** 0 = Sunday, 6 = Saturday */
  dayOfWeek: number;
  /** 0-23 */
  hour: number;
  /** 0-59 */
  minute: number;
  /** ISO date string YYYY-MM-DD in Israel time */
  dateStr: string;
}

export function getIsraelTime(date: Date = new Date()): IsraelTime {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: ISRAEL_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";

  const weekdayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };

  const weekday = get("weekday");
  const dayOfWeek = weekdayMap[weekday];
  if (dayOfWeek === undefined) {
    console.error(`[israel-time] Unexpected weekday value: "${weekday}"`);
  }

  return {
    dayOfWeek: dayOfWeek ?? 0,
    hour: parseInt(get("hour"), 10) % 24,
    minute: parseInt(get("minute"), 10),
    dateStr: `${get("year")}-${get("month")}-${get("day")}`,
  };
}

/**
 * Returns true if the given date falls on Saturday in Israel time.
 */
export function isSaturdayInIsrael(date: Date = new Date()): boolean {
  return getIsraelTime(date).dayOfWeek === 6;
}

const ISRAEL_DAY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: ISRAEL_TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/**
 * Returns the calendar date in Israel time as an ISO YYYY-MM-DD string.
 * Hoisted formatter — safe to call inside hot loops.
 */
export function israelDateStr(value: string | Date): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return ISRAEL_DAY_FORMATTER.format(d);
}

/**
 * Minutes elapsed since midnight in Israel time. 08:30 -> 510.
 */
export function israelMinutesOfDay(date: Date): number {
  const { hour, minute } = getIsraelTime(date);
  return hour * 60 + minute;
}

const MORNING_START_MINUTES = MORNING_SHIFT_START_HOUR * 60;
const MORNING_END_MINUTES = MORNING_SHIFT_END_HOUR * 60;

const FRIDAY = 5;

/**
 * Morning shifts do not exist on Friday: the day runs a single ~09:00-15:00
 * shift with no morning/regular split, ended by the 15:00 auto-clockout.
 * Treating a 09:00 Friday clock-in as "morning" would let the 11:00 morning
 * sweep force-end a full Friday work day hours early.
 */
export function isMorningShiftAllowed(date: Date = new Date()): boolean {
  return getIsraelTime(date).dayOfWeek !== FRIDAY;
}

/**
 * Classifies a clock-in moment as a morning or regular shift.
 * Morning is the half-open window [08:00, 11:00) Israel time — a clock-in at
 * exactly 11:00 is a regular shift, since no morning shift could remain.
 * Friday is always regular; see isMorningShiftAllowed.
 */
export function inferShiftPeriod(date: Date = new Date()): ShiftPeriod {
  if (!isMorningShiftAllowed(date)) return "regular";
  const minutes = israelMinutesOfDay(date);
  return minutes >= MORNING_START_MINUTES && minutes < MORNING_END_MINUTES
    ? "morning"
    : "regular";
}

/**
 * Returns true if the span falls entirely inside the morning window
 * (08:00-11:00 Israel time) on a single Israel calendar day.
 */
export function isWithinMorningWindow(start: Date, end: Date): boolean {
  if (israelDateStr(start) !== israelDateStr(end)) return false;
  return (
    israelMinutesOfDay(start) >= MORNING_START_MINUTES &&
    israelMinutesOfDay(end) <= MORNING_END_MINUTES
  );
}

/**
 * Returns the auto-clockout target hour for the given day, or null if no auto-clockout.
 * - Saturday: null (no auto-clockout)
 * - Friday: 15 (15:00 Israel time)
 * - Sunday-Thursday: 20 (20:00 Israel time)
 */
export function getAutoClockoutHour(israelTime: IsraelTime): number | null {
  const { dayOfWeek } = israelTime;
  if (dayOfWeek === 6) return null; // Saturday
  if (dayOfWeek === 5) return 15; // Friday
  return 20; // Sun-Thu
}
