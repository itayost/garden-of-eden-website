/**
 * Who gets what in a Report week. Pure: the loaders fill the inputs, and these
 * rules decide whether a Trainee gets a report, a "התגעגענו", or nothing.
 *
 * Taking part reuses the survey audience (active, not deleted, full access, a
 * member of the branch, the birth year when one is named). "Trained" on a day
 * is a counted Roster row or an Arbox entrance; one day counts once, so a
 * Trainee who trains through Arbox only is never told we missed them.
 */
import { type AudienceCandidate, inSurveyAudience } from "@/features/surveys/lib/audience";
import { reportWeekEnd, reportWeekStart, weeksBetween } from "./report-week";

export type ReportMode = "off" | "approval" | "automatic";

/** One branch's weekly report setting. No birth years means every year. */
export interface ReportSetting {
  branchId: string;
  mode: ReportMode;
  birthYears: number[] | null;
  missedYou: boolean;
}

/**
 * The branches whose setting takes this Trainee: not off, and the Trainee is in
 * that branch's audience. A Trainee in two branches gets one report all the
 * same; this list only says which staff see it and which settings apply.
 */
export function reportBranches(
  candidate: AudienceCandidate,
  settings: readonly ReportSetting[],
): string[] {
  return settings
    .filter(
      (setting) =>
        setting.mode !== "off" &&
        inSurveyAudience(candidate, {
          branchIds: [setting.branchId],
          birthYears: setting.birthYears ?? [],
        }),
    )
    .map((setting) => setting.branchId);
}

/** A Roster row as the loader reads it; `counts` is rowCounts() of the row. */
export interface TrainingRow {
  date: string;
  counts: boolean;
  /** A late cancel is charged (rowCounts) but the Trainee did not come. */
  lateCancel?: boolean;
}

/**
 * The distinct, sorted days with an attended Roster row or an Arbox entrance.
 * A late cancel is left out: a week that holds only one would otherwise get a
 * report saying nothing was trained.
 */
export function trainingDays(
  roster: readonly TrainingRow[],
  arboxDates: readonly string[],
): string[] {
  const counted = roster.filter((row) => row.counts && !row.lateCancel).map((row) => row.date);
  return [...new Set([...counted, ...arboxDates])].sort();
}

/** A Freeze; `endedOn` is the Israel day of `ended_at` when it was ended early. */
export interface FreezeSpan {
  startsOn: string;
  endsOn: string | null;
  endedOn: string | null;
}

/**
 * Whether the Freeze covers any day of the week: it starts on or before the
 * week's Thursday, and it neither ended nor was ended early before the week's
 * Friday.
 */
export function freezeTouchesWeek(freeze: FreezeSpan, weekStart: string): boolean {
  const startsInTime = freeze.startsOn <= reportWeekEnd(weekStart);
  const endedBefore = (day: string | null) => day !== null && day < weekStart;
  return startsInTime && !endedBefore(freeze.endsOn) && !endedBefore(freeze.endedOn);
}

export type WeekKind = "report" | "missed_you" | "absent" | "nothing";

/** "התגעגענו" goes to Trainees whose last training is 1 to 3 Report weeks back. */
const MISSED_YOU_MAX_WEEKS = 3;
/** Exactly 4 Report weeks back is listed for staff as "לא הגיעו 3 שבועות". */
const ABSENT_WEEKS = 4;

/**
 * What the week holds for one Trainee. A training day inside the week gives a
 * report. Otherwise the last earlier training day decides, unless "התגעגענו"
 * is off for the Trainee or a Freeze touches the week.
 */
export function classifyWeek(input: {
  weekStart: string;
  days: readonly string[];
  frozen: boolean;
  missedYouOn: boolean;
}): WeekKind {
  const { weekStart, days, frozen, missedYouOn } = input;
  const weekEnd = reportWeekEnd(weekStart);
  if (days.some((day) => day >= weekStart && day <= weekEnd)) return "report";
  const earlier = days.filter((day) => day < weekStart);
  if (!missedYouOn || frozen || earlier.length === 0) return "nothing";
  const lastDay = earlier.reduce((a, b) => (b > a ? b : a));
  const weeks = weeksBetween(reportWeekStart(lastDay), weekStart);
  if (weeks >= 1 && weeks <= MISSED_YOU_MAX_WEEKS) return "missed_you";
  if (weeks === ABSENT_WEEKS) return "absent";
  return "nothing";
}

/**
 * Whether "התגעגענו" may go to a Trainee this run (classifyWeek's
 * `missedYouOn`): never when the Arbox read failed, since an Arbox-only
 * Trainee would look absent; otherwise when any of the Trainee's report
 * branches has it on.
 */
export function missedYouAllowed(
  branchIds: readonly string[],
  settings: readonly ReportSetting[],
  arboxReadFailed: boolean,
): boolean {
  if (arboxReadFailed) return false;
  return settings.some(
    (setting) =>
      setting.missedYou && setting.mode !== "off" && branchIds.includes(setting.branchId),
  );
}
