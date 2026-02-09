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
