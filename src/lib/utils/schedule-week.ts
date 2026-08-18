/**
 * The week the daily board is planned in, as one pure view model.
 *
 * A week here is a real, dated week — the thing the standing template is not.
 * Every rule the week view depends on lives here rather than in JSX: which
 * dates the week covers, which slot belongs to which date, whether a day counts
 * as built, and whether Saturday is shown at all. That keeps the whole layout
 * testable, which matters more than usual because this module is where an
 * off-by-one lands a group on the wrong day.
 *
 * Staffing is not recomputed here. deriveOnDuty stays the single answer to "who
 * is on this date", and this module composes it once per day.
 */

import { addDays, shortDate } from "@/lib/utils/iso-date";
import { deriveOnDuty, weekdayOf } from "@/lib/utils/weekly-schedule";
import type { ScheduleSlot } from "@/types/schedule";
import type {
  OnDuty,
  OnDutyBand,
  Weekday,
  WeeklyBand,
  WeeklyException,
} from "@/types/weekly-schedule";

/** Sunday through Friday; Saturday is handled apart. See buildWeek. */
const WEEK_LENGTH = 7;
const SATURDAY_INDEX = 6;

export interface WeekDay {
  /** ISO YYYY-MM-DD. */
  date: string;
  weekday: Weekday;
  isToday: boolean;
  /** Before today. Backfilling a past day is allowed but never the default. */
  isPast: boolean;
  /** A day with at least one slot. Not the same as "nobody works that day". */
  isBuilt: boolean;
  /** In the order the query returned: start time, then creation. */
  slots: ScheduleSlot[];
  onDuty: OnDuty;
  /** This date's one-off additions, already inside onDuty.bands. */
  extras: OnDutyBand[];
}

export interface Week {
  /** Sunday to Friday, always six. */
  days: WeekDay[];
  /** Null unless this Saturday actually has something on it. */
  saturday: WeekDay | null;
}

interface BuildWeekInput {
  /** The Sunday the week opens on. Normalise with startOfWeek first. */
  weekStart: string;
  /** Israel's today, resolved by the caller — this module never asks a clock. */
  today: string;
  slots: readonly ScheduleSlot[];
  bands: readonly WeeklyBand[];
  exceptions: readonly WeeklyException[];
}

/** The Sunday of the week containing this date. A Saturday reaches back six. */
export function startOfWeek(date: string): string {
  return addDays(date, -weekdayOf(date));
}

/**
 * The week to open on when nobody asked for one.
 *
 * Saturday is the exception: it closes the week, so startOfWeek would show the
 * six days that just ended. Someone opening the page on Saturday is planning
 * tomorrow, so the default rolls forward. Explicit navigation never does.
 */
export function defaultWeekStart(today: string): string {
  if (weekdayOf(today) === SATURDAY_INDEX) return addDays(today, 1);
  return startOfWeek(today);
}

/** The seven dates of the week, Sunday first. */
export function weekDates(weekStart: string): string[] {
  return Array.from({ length: WEEK_LENGTH }, (_, index) =>
    addDays(weekStart, index),
  );
}

/**
 * "16.8–21.8" for the working week, year-qualified when it straddles one.
 *
 * Sunday to Friday, whether or not a Saturday is on screen: the label names the
 * week the academy works, and a range that grew a day because someone wrote one
 * Saturday slot would read as a different kind of week.
 */
export function weekRangeLabel(weekStart: string): string {
  const dates = weekDates(weekStart);
  const first = dates[0];
  const last = dates[5];

  if (first.slice(0, 4) === last.slice(0, 4)) {
    return `${shortDate(first)}–${shortDate(last)}`;
  }
  return `${shortDate(first)}.${first.slice(0, 4)}–${shortDate(last)}.${last.slice(0, 4)}`;
}

function groupByDate(
  slots: readonly ScheduleSlot[],
  dates: readonly string[],
): Map<string, ScheduleSlot[]> {
  // Seeded with every date, so a column can never read undefined. Slots dated
  // outside the week are dropped rather than bucketed under a stray key.
  const groups = new Map<string, ScheduleSlot[]>(
    dates.map((date) => [date, []]),
  );
  for (const slot of slots) {
    groups.get(slot.schedule_date)?.push(slot);
  }
  return groups;
}

function toWeekDay(
  date: string,
  today: string,
  slots: ScheduleSlot[],
  bands: readonly WeeklyBand[],
  exceptions: readonly WeeklyException[],
): WeekDay {
  // deriveOnDuty filters the exceptions by date itself, so the whole week's
  // rows can be handed to it unfiltered.
  const onDuty = deriveOnDuty(date, bands, exceptions);

  return {
    date,
    weekday: weekdayOf(date),
    isToday: date === today,
    isPast: date < today,
    isBuilt: slots.length > 0,
    slots,
    onDuty,
    extras: onDuty.bands.filter((band) => band.source === "exception"),
  };
}

/**
 * The week's six working days, plus Saturday when it is not empty.
 *
 * Saturday is kept out of the grid because the academy does not staff it, and
 * a column that is blank fifty weeks a year would resize the other six for
 * nothing. But a slot written on a Saturday is still real, so the day is
 * returned whenever it holds a slot or a one-off extra, and the view renders it
 * below the grid where its appearance moves nothing.
 *
 * "Has something" is read off the derived staffing rather than the raw
 * exceptions: an absence on a Saturday nobody works derives to nothing, and
 * that is correct — it says nothing about the day.
 */
export function buildWeek({
  weekStart,
  today,
  slots,
  bands,
  exceptions,
}: BuildWeekInput): Week {
  const dates = weekDates(weekStart);
  const byDate = groupByDate(slots, dates);

  const all = dates.map((date) =>
    toWeekDay(date, today, byDate.get(date) ?? [], bands, exceptions),
  );

  const saturday = all[SATURDAY_INDEX];
  const saturdayHasSomething =
    saturday.slots.length > 0 || saturday.onDuty.bands.length > 0;

  return {
    days: all.slice(0, SATURDAY_INDEX),
    saturday: saturdayHasSomething ? saturday : null,
  };
}

/**
 * Whether the whole-week build would seed this day.
 *
 * Three conditions, and each one is a decision: a day that already has a board
 * is left alone rather than merged, a day already past is left to the per-day
 * button so backfilling stays deliberate, and a day the template staffs with
 * nobody has nothing to seed from.
 *
 * Exported so the button and the action that does the work cannot disagree
 * about which days are offered.
 */
export function isBuildableDay(day: WeekDay): boolean {
  return !day.isBuilt && !day.isPast && day.onDuty.bands.length > 0;
}
