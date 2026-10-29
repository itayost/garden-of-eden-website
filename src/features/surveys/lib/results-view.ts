/**
 * Display helpers for the results page: names and times as the grid shows
 * them, paging, the dates under the title and the one-line summaries. Pure,
 * so the server page and the client components import the same functions.
 */
import { daysBetween, shortDate } from "@/lib/utils/iso-date";
import { israelDateStr, getIsraelTime } from "@/lib/utils/israel-time";
import { joinDot } from "./format";
import type { QuestionSummary, SurveyReport } from "./report";
import { SURVEY_PAGE_SIZE, type SurveyRecord, type SurveyState } from "./types";

/** The first letters of the first two words of a name; "?" for a blank one. */
export function initialsOf(fullName: string): string {
  const words = fullName.trim().split(/\s+/).filter((word) => word !== "");
  if (words.length === 0) return "?";
  return words
    .slice(0, 2)
    .map((word) => Array.from(word)[0])
    .join("");
}

/** The name to show: a Response keeps no name of its own, so a profile that is gone reads as nameless. */
export function displayName(fullName: string): string {
  return fullName.trim() === "" ? "חניך ללא שם" : fullName;
}

/** "17:42": the moment as a clock in Israel time. */
export function israelClock(iso: string): string {
  const { hour, minute } = getIsraelTime(new Date(iso));
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** "28.10": the Israel day of a moment, day then month, neither padded. */
export function israelDayMonth(iso: string): string {
  return shortDate(israelDateStr(iso));
}

/** "28.10 · 17:42": the sent column and the Response sheet. */
export function sentAtText(iso: string): string {
  return `${israelDayMonth(iso)} · ${israelClock(iso)}`;
}

/** The three segments' counts, from the report's totals (never from list lengths). */
export function segmentCounts(totals: SurveyReport["totals"]): {
  answered: number;
  seen: number;
  unseen: number;
} {
  return {
    answered: totals.answered,
    seen: totals.seen - totals.answered,
    unseen: totals.audience - totals.seen,
  };
}

/** The last page of `total` rows; an empty list still has page 1. */
export function lastPage(total: number): number {
  return Math.max(1, Math.ceil(total / SURVEY_PAGE_SIZE));
}

/** A 1-based page held inside 1 to the last page. */
export function clampPage(page: number, total: number): number {
  return Math.min(Math.max(1, page), lastPage(total));
}

/** The rows of one 1-based page, clamped to the last page. */
export function pageSlice<T>(items: readonly T[], page: number): T[] {
  const start = (clampPage(page, items.length) - 1) * SURVEY_PAGE_SIZE;
  return items.slice(start, start + SURVEY_PAGE_SIZE);
}

/** A share of the whole, 0 to 100 and unrounded (a bar's width); 0 for an empty whole. */
export function percentOf(part: number, whole: number): number {
  return whole === 0 ? 0 : (part / whole) * 100;
}

export function daysLeftText(days: number): string {
  if (days <= 0) return "נסגר היום";
  if (days === 1) return "נשאר יום אחד";
  return `נשארו ${days} ימים`;
}

type RunDates = Pick<SurveyRecord, "opensOn" | "closesOn" | "closedAt">;

/**
 * The line under the title: "22.10 עד 5.11 · נשארו 7 ימים". The end is the
 * day it was closed early, else its close date; the days left only while open.
 */
export function runDatesText(dates: RunDates, state: SurveyState, today: string): string {
  const { opensOn, closesOn, closedAt } = dates;
  const end = closedAt !== null ? israelDayMonth(closedAt) : closesOn !== null ? shortDate(closesOn) : null;
  if (end === null) return `${state === "scheduled" ? "ייפתח" : "נפתח"} ${shortDate(opensOn)}`;
  const range = `${shortDate(opensOn)} עד ${end}`;
  // Whole days from today to the close day, both Israel days; 0 on the close day itself.
  const showDaysLeft = state === "open" && closesOn !== null;
  return showDaysLeft ? `${range} · ${daysLeftText(daysBetween(today, closesOn))}` : range;
}

/** "חיפה · 2014": a Trainee's branches and birth year, a missing part left out. */
export function branchYearText(branchNames: readonly string[], birthYear: number | null): string {
  return joinDot([branchNames.join(", "), birthYear === null ? "" : String(birthYear)]);
}

/** The birth years the filter offers, newest first, with the chosen one kept even when nobody has it. */
export function yearOptions(birthYears: readonly number[], selected: number | null): number[] {
  const years = new Set(selected === null ? birthYears : [...birthYears, selected]);
  return [...years].sort((a, b) => b - a);
}

type ChoiceOptions = Extract<QuestionSummary, { kind: "single_choice" | "multi_choice" }>["options"];

/** The options picked most, most first (ties keep the authored order); never one nobody picked. */
export function topOptions(options: ChoiceOptions, count: number): ChoiceOptions {
  // Not toSorted: this runs in the browser, and older iOS and Chrome lack it.
  // filter() hands back a new array, so sorting it leaves `options` alone, and
  // the sort is stable, so ties keep the authored order.
  return options
    .filter((option) => option.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, count);
}

/** Bar heights in pixels: the tallest count is `maxPx`, nothing is shorter than `minPx`. */
export function scaledHeights(counts: readonly number[], maxPx: number, minPx: number): number[] {
  const tallest = Math.max(...counts);
  return counts.map((count) =>
    tallest === 0 ? minPx : Math.max(minPx, Math.round((count / tallest) * maxPx)),
  );
}

/** A rating average to one decimal ("4.0"), or a dash when nobody rated. */
export function averageText(average: number | null): string {
  return average === null ? "–" : average.toFixed(1);
}

/** What a Question got, in a few words: the phone summary list's right-hand side. */
export function summaryValueText(summary: QuestionSummary): string {
  if (summary.kind === "rating") {
    return summary.average === null ? "אין דירוגים" : `${averageText(summary.average)} מתוך 5`;
  }
  if (summary.kind === "text") return `${summary.answered} כתבו`;
  const [top] = topOptions(summary.options, 1);
  return top === undefined ? "אין תשובות" : `${top.label} · ${top.pct}%`;
}

/** The delete confirmation's body: how many Responses go with the Survey. */
export function deleteDescription(responseCount: number): string {
  if (responseCount === 0) return "הסקר והשאלות שלו יימחקו, ואי אפשר לשחזר אותם.";
  const responses =
    responseCount === 1 ? "והתשובה היחידה שנשלחה אליו" : `ו-${responseCount} התשובות שנשלחו אליו`;
  return `הסקר, השאלות שלו ${responses} יימחקו, ואי אפשר לשחזר אותם.`;
}
