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
