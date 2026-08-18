/**
 * Calendar arithmetic on bare ISO date strings (YYYY-MM-DD).
 *
 * Everything here treats the string as a calendar date with no time and no
 * zone, and does the arithmetic in UTC. That is deliberate: the academy runs on
 * Israel time, so the anchor always comes from israelToday(), but once a date
 * is a string, parsing it in the machine's local zone would shift it for anyone
 * west of Israel and would let a DST transition swallow or repeat a day.
 *
 * Kept apart from lib/utils/date.ts, which formats for a human in the viewer's
 * locale and timezone. Mixing the two is where date bugs come from.
 */

/** Days forward (or back, for a negative delta). */
export function addDays(date: string, delta: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** Signed day count from one date to another: negative when `to` is earlier. */
export function daysBetween(from: string, to: string): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000;
  const start = new Date(`${from}T00:00:00Z`).getTime();
  const end = new Date(`${to}T00:00:00Z`).getTime();
  return Math.round((end - start) / MS_PER_DAY);
}

/** "2026-08-06" becomes "6.8" — how the date reads in Hebrew shorthand. */
export function shortDate(date: string): string {
  const [, month, day] = date.split("-");
  return `${Number(day)}.${Number(month)}`;
}
