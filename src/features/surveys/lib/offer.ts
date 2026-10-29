/**
 * Which Survey the Trainee popup offers, and where it may appear. Pure: the
 * client components import this, so it must not pull in anything server-only.
 */

export const SNOOZE_KEY_PREFIX = "goe_survey_snooze_";

/** A rough pace for a Trainee on a phone, used for the "how long" chip. */
const QUESTIONS_PER_MINUTE = 4;

/**
 * Mid-activity paths, by the first segment after /dashboard. `segments` is the
 * fewest path segments, counting "dashboard", that put a path in the activity or
 * below it. The /dashboard/forms index has two segments, so it stays free.
 */
const MID_ACTIVITY_PATHS: readonly { readonly section: string; readonly segments: number }[] = [
  { section: "workout", segments: 2 },
  { section: "scan", segments: 3 },
  { section: "forms", segments: 3 },
  { section: "course", segments: 4 },
  { section: "tactical-course", segments: 4 },
];

interface OfferDates {
  closesOn: string | null;
  publishedAt: string;
}

/** Days are YYYY-MM-DD, so string order is day order. A missing close date sorts last. */
function compareCloseDates(a: string | null, b: string | null): number {
  if (a === b) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return a < b ? -1 : 1;
}

function compareForOffer(a: OfferDates, b: OfferDates): number {
  const byClose = compareCloseDates(a.closesOn, b.closesOn);
  if (byClose !== 0) return byClose;
  return Date.parse(a.publishedAt) - Date.parse(b.publishedAt);
}

/**
 * The Survey to offer next: the earliest close date first, a survey with no
 * close date last, and the earliest publish date breaking a tie. Never reorders
 * the input.
 */
export function pickSurveyToOffer<T extends OfferDates>(surveys: readonly T[]): T | null {
  const sorted = [...surveys].sort(compareForOffer);
  return sorted[0] ?? null;
}

/**
 * Whether the popup may show on this page. A trailing slash counts as none, and
 * whole segments are compared, so /dashboard/workouts is not the workout.
 */
export function surveyPromptAllowedOn(pathname: string): boolean {
  const segments = pathname.split("/").filter((segment) => segment !== "");
  const [root, section] = segments;
  if (root !== "dashboard" || section === undefined) return true;
  const rule = MID_ACTIVITY_PATHS.find((path) => path.section === section);
  return rule === undefined || segments.length < rule.segments;
}

/** The Israel day the Trainee chose "later", stored under the Survey's key. */
export function snoozeKey(surveyId: string): string {
  return `${SNOOZE_KEY_PREFIX}${surveyId}`;
}

/** Snoozed only for the day it was snoozed; the next Israel day it shows again. */
export function isSnoozed(stored: string | null, today: string): boolean {
  return stored === today;
}

/** "דקה אחת", or "<m> דקות" with at least one minute. */
export function durationLabel(questionCount: number): string {
  const minutes = Math.max(1, Math.round(questionCount / QUESTIONS_PER_MINUTE));
  return minutes === 1 ? "דקה אחת" : `${minutes} דקות`;
}
