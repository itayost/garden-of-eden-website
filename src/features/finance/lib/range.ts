import { addDays, daysBetween } from "@/lib/utils/iso-date";
import { isValidDateString } from "@/lib/validations/common";

/** The longest range a report reads; a longer ask keeps its last days. */
export const MAX_RANGE_DAYS = 93;
/** Tiles in the day strip when the range is shorter than this. */
export const STRIP_DAYS = 7;
/** Days shown after a selected day, so the strip can move forward as well as back. */
const STRIP_AFTER = 3;

export type RangePreset = "day" | "week" | "month" | "custom";

export interface ReportRange {
  /** First Israel day, ISO YYYY-MM-DD, inclusive. */
  from: string;
  /** Last Israel day, inclusive; never after today. */
  to: string;
  preset: RangePreset;
  /** The asked range was longer than MAX_RANGE_DAYS and was cut. */
  clipped: boolean;
}

export interface RangeParams {
  range?: string;
  from?: string;
  to?: string;
}

/** A real calendar date: 2026-02-30 and month 13 are rejected. */
const isIsoDate = (value: string | undefined): value is string =>
  value !== undefined && isValidDateString(value);

/** The report range from the URL; anything unusable falls back to today. */
export function parseRange(params: RangeParams, today: string): ReportRange {
  const day: ReportRange = { from: today, to: today, preset: "day", clipped: false };
  if (params.range === "week") return { from: addDays(today, -6), to: today, preset: "week", clipped: false };
  if (params.range === "month") return { from: `${today.slice(0, 8)}01`, to: today, preset: "month", clipped: false };
  if (params.range !== "custom" || !isIsoDate(params.from) || !isIsoDate(params.to)) return day;

  const to = params.to > today ? today : params.to;
  if (params.from > to) return day;
  if (daysBetween(params.from, to) + 1 > MAX_RANGE_DAYS) {
    return { from: addDays(to, -(MAX_RANGE_DAYS - 1)), to, preset: "custom", clipped: true };
  }
  return { from: params.from, to, preset: "custom", clipped: false };
}

/**
 * The days the strip shows. A range of STRIP_DAYS or more is its own strip;
 * a shorter one is centred on its last day (STRIP_AFTER days after it, never
 * past today), so a picked day can move forward as well as back.
 */
export function stripWindow(range: Pick<ReportRange, "from" | "to">, today: string): { from: string; to: string } {
  if (daysBetween(range.from, range.to) + 1 >= STRIP_DAYS) return { from: range.from, to: range.to };
  const ahead = addDays(range.to, STRIP_AFTER);
  const to = ahead > today ? today : ahead;
  const back = addDays(to, -(STRIP_DAYS - 1));
  return { from: range.from < back ? range.from : back, to };
}

/** A ?branch= value the report may filter by, or null for every selling branch. */
export function parseBranchParam(value: string | undefined, allowed: readonly string[]): string | null {
  return value !== undefined && allowed.includes(value) ? value : null;
}
