/**
 * Display helpers for Surveys: audience wording, short dates and rating tones.
 * Pure, so the admin and Trainee client components can import them.
 */

export type RatingTone = "high" | "mid" | "soft" | "low";

/** The lowest rating in each tone; anything below the soft floor is low. */
const TONE_FLOOR = { high: 5, mid: 4, soft: 3 } as const;

export function ratingTone(rating: number): RatingTone {
  if (rating >= TONE_FLOOR.high) return "high";
  if (rating >= TONE_FLOOR.mid) return "mid";
  if (rating >= TONE_FLOOR.soft) return "soft";
  return "low";
}

/** "שאלה אחת", or "<n> שאלות". */
export function questionCountLabel(count: number): string {
  return count === 1 ? "שאלה אחת" : `${count} שאלות`;
}

/** "5.11" for "2026-11-05": day then month, neither padded. */
export function dayMonth(isoDate: string): string {
  const month = Number(isoDate.slice(5, 7));
  const day = Number(isoDate.slice(8, 10));
  return `${day}.${month}`;
}

/**
 * Years ascending, as a range only when three or more run in a row ("2013 עד 2015").
 * Two years, or years with a gap, are listed ("2013, 2015"). A repeated year is listed once.
 */
function birthYearsText(birthYears: readonly number[]): string {
  const years = [...new Set(birthYears)].sort((a, b) => a - b);
  if (years.length === 0) return "";
  const first = years[0];
  const last = years[years.length - 1];
  const inARow = years.length > 2 && last - first === years.length - 1;
  const label = inARow ? `${first} עד ${last}` : years.join(", ");
  return `ילידי ${label}`;
}

/**
 * The audience line, for example "חיפה, קריית אתא · ילידי 2013 עד 2015".
 * Branch names keep the order given; the years part is left out when empty.
 */
export function audienceText(
  branchNames: readonly string[],
  birthYears: readonly number[],
): string {
  const parts = [branchNames.join(", "), birthYearsText(birthYears)];
  return parts.filter((part) => part !== "").join(" · ");
}

export interface YearCount {
  year: number;
  count: number;
}

/**
 * How many Trainees a Survey reaches: every eligible one when no year is
 * ticked (those without a birthdate included), otherwise those born in a
 * ticked year. A ticked year nobody was born in adds nothing.
 */
export function reachCount(
  birthYears: readonly number[],
  years: readonly YearCount[],
  totalAllYears: number,
): number {
  if (birthYears.length === 0) return totalAllYears;
  return years
    .filter((entry) => birthYears.includes(entry.year))
    .reduce((sum, entry) => sum + entry.count, 0);
}

/**
 * The years to offer, newest first: the eligible ones, plus any ticked year
 * nobody in the chosen branches was born in (shown with no one), so a year
 * the audience no longer has can still be unticked.
 */
export function yearChoices(years: readonly YearCount[], selected: readonly number[]): YearCount[] {
  const offered = new Set(years.map((entry) => entry.year));
  const absent = selected
    .filter((year) => !offered.has(year))
    .map((year) => ({ year, count: 0 }));
  return [...years, ...absent].sort((a, b) => b.year - a.year);
}

/** "יישלח ל-<n> חניכים פעילים", and the singular for one. */
export function reachText(count: number): string {
  return count === 1 ? "יישלח לחניך פעיל אחד" : `יישלח ל-${count} חניכים פעילים`;
}

/** "<n> חניכים כבר ענו", and the singular for one. */
export function answeredText(count: number): string {
  return count === 1 ? "חניך אחד כבר ענה" : `${count} חניכים כבר ענו`;
}

/** "דבר אחד לתקן", or "<n> דברים לתקן". */
export function fixCountText(count: number): string {
  return count === 1 ? "דבר אחד לתקן" : `${count} דברים לתקן`;
}

/** "נפתח 22.10 · נסגר 5.11"; the close part is left out when there is no close date. */
export function datesSummary(opensOn: string, closesOn: string | null): string {
  const parts = [`נפתח ${dayMonth(opensOn)}`, closesOn === null ? "" : `נסגר ${dayMonth(closesOn)}`];
  return parts.filter((part) => part !== "").join(" · ");
}

/**
 * The audience on one line for the folded phone section: branches, years and,
 * once it is known, how many Trainees. "לא נבחר סניף" when there is nothing yet.
 */
export function audienceSummary(
  branchNames: readonly string[],
  birthYears: readonly number[],
  reach: number | null,
): string {
  const who = audienceText(branchNames, birthYears);
  if (who === "") return "לא נבחר סניף";
  if (reach === null) return who;
  return `${who} · ${reach === 1 ? "חניך אחד" : `${reach} חניכים`}`;
}
