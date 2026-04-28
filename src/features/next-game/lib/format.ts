/**
 * Date formatting helpers for next-game cards.
 * The input is always a YYYY-MM-DD string (DATE column), parsed in local time
 * to avoid the UTC-vs-Israel off-by-one that `new Date(iso)` causes.
 */

export function formatHebrewGameDate(iso: string, withWeekday = false): string {
  const [y, m, d] = iso.split("-").map((p) => parseInt(p, 10));
  const date = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat("he-IL", {
    weekday: withWeekday ? "long" : undefined,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function daysUntilGame(iso: string, now: Date = new Date()): number {
  const [y, m, d] = iso.split("-").map((p) => parseInt(p, 10));
  const target = new Date(y, m - 1, d);
  target.setHours(0, 0, 0, 0);
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function gameDayLabel(days: number): string {
  if (days < 0) return "תאריך עבר";
  if (days === 0) return "היום";
  if (days === 1) return "מחר";
  return `בעוד ${days} ימים`;
}
