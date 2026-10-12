import type { ReportRange } from "./range";

const TIME = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Asia/Jerusalem",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});
const LONG_DAY = new Intl.DateTimeFormat("he-IL", {
  timeZone: "UTC",
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});
const WEEKDAY_LETTER = ["א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ש׳"];

const asDate = (day: string) => new Date(`${day}T00:00:00Z`);
const dayMonth = (day: string) => `${Number(day.slice(8, 10))}.${Number(day.slice(5, 7))}`;

/** "08:12": the Israel wall-clock time of an ISO timestamp. */
export const timeOf = (iso: string): string => TIME.format(new Date(iso));

/** "יום שני, 12 באוקטובר 2026". */
export const longDay = (day: string): string => LONG_DAY.format(asDate(day));

/** "ב׳ 12.10", for the day strip and multi-day rows. */
export const shortDay = (day: string): string =>
  `${WEEKDAY_LETTER[asDate(day).getUTCDay()]} ${dayMonth(day)}`;

/** The page subtitle: one day in full, a range as "6.10 עד 12.10.2026". */
export function rangeLabel(range: ReportRange): string {
  if (range.from === range.to) return longDay(range.from);
  return `${dayMonth(range.from)} עד ${dayMonth(range.to)}.${range.to.slice(0, 4)}`;
}
