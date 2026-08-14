/**
 * Derives the staffing in force on one date from the standing weekly schedule.
 *
 * The rule lives here and only here, because three surfaces consume it and they
 * must not drift: the weekly editor, the on-duty strip on the daily board, and
 * the slot form's trainer default. Same containment argument as
 * performance-profile.ts.
 *
 * Nothing here touches Supabase and nothing here is stored. On-duty staffing is
 * recomputed on every read, so it cannot fall out of step with the Bands it
 * comes from — see docs/adr/0003-weekly-schedule-derives-staffing.md.
 */

import type {
  OnDuty,
  OnDutyAbsence,
  OnDutyBand,
  Weekday,
  WeeklyBand,
  WeeklyException,
} from "@/types/weekly-schedule";

/** Postgres TIME serializes as HH:MM:SS; every surface shows HH:MM. */
function toHhMm(time: string): string {
  return time.slice(0, 5);
}

/**
 * 0 = Sunday .. 6 = Saturday.
 *
 * UTC throughout, matching weekdayName() in ScheduleDayView and addDays()
 * beside it: an ISO date is a calendar date, and parsing it in the machine's
 * local zone would shift the weekday for anyone west of Israel.
 */
export function weekdayOf(date: string): Weekday {
  return new Date(`${date}T00:00:00Z`).getUTCDay() as Weekday;
}

function bandToOnDuty(band: WeeklyBand): OnDutyBand {
  return {
    id: band.id,
    source: "band",
    startTime: toHhMm(band.start_time),
    endTime: band.end_time ? toHhMm(band.end_time) : null,
    trainerId: band.trainer_id,
    trainerName: band.trainer_name,
    locationHe: band.location_he,
    labelHe: band.label_he,
    isStandby: band.is_standby,
  };
}

function extraToOnDuty(exception: WeeklyException): OnDutyBand {
  return {
    id: exception.id,
    source: "exception",
    // The schema guarantees an 'extra' has a start time; the fallback only
    // keeps this total for a row that bypassed it through PostgREST.
    startTime: toHhMm(exception.start_time ?? "00:00:00"),
    endTime: exception.end_time ? toHhMm(exception.end_time) : null,
    trainerId: exception.trainer_id,
    trainerName: exception.trainer_name,
    locationHe: exception.location_he,
    labelHe: exception.label_he,
    // An extra is something the admin arranged for this date, so it is real
    // work. Standby is a property of the standing week, not of a one-off.
    isStandby: false,
  };
}

/** Start time first, then trainer name, so the output is deterministic. */
function byStartThenName(a: OnDutyBand, b: OnDutyBand): number {
  if (a.startTime !== b.startTime) return a.startTime.localeCompare(b.startTime);
  return a.trainerName.localeCompare(b.trainerName, "he");
}

/**
 * The staffing actually in force on `date`: that weekday's Bands, with the
 * date's Exceptions applied.
 *
 * An absence removes every Band the trainer holds that weekday — it is a
 * whole-day statement, which is why the schema forbids times on it. It does
 * *not* remove that trainer's own `extra` on the same date: writing both is how
 * an admin says "off the usual week, but in for this one hour".
 */
export function deriveOnDuty(
  date: string,
  bands: readonly WeeklyBand[],
  exceptions: readonly WeeklyException[],
): OnDuty {
  const weekday = weekdayOf(date);

  const forDate = exceptions.filter((e) => e.exception_date === date);
  const absentTrainerIds = new Set(
    forDate.filter((e) => e.kind === "absent").map((e) => e.trainer_id),
  );

  const standing = bands
    .filter((band) => band.weekday === weekday)
    .filter((band) => !absentTrainerIds.has(band.trainer_id))
    .map(bandToOnDuty);

  const extras = forDate.filter((e) => e.kind === "extra").map(extraToOnDuty);

  const working = [...standing.filter((b) => !b.isStandby), ...extras].sort(
    byStartThenName,
  );
  const standby = standing.filter((b) => b.isStandby).sort(byStartThenName);

  // Only report an absence the standing week would otherwise have shown.
  // Marking a trainer away on a day they never work is harmless data entry,
  // but rendering "גימי בחופשה" on a day גימי has no band explains nothing.
  const expectedTrainerIds = new Set(
    bands.filter((band) => band.weekday === weekday).map((b) => b.trainer_id),
  );

  const absences: OnDutyAbsence[] = forDate
    .filter((e) => e.kind === "absent" && expectedTrainerIds.has(e.trainer_id))
    .map((e) => ({
      trainerId: e.trainer_id,
      trainerName: e.trainer_name,
      noteHe: e.note_he,
    }))
    .sort((a, b) => a.trainerName.localeCompare(b.trainerName, "he"));

  return { date, weekday, bands: working, standby, absences };
}

/**
 * The trainers whose stretch covers `time`, for defaulting the slot form.
 *
 * Half-open [start, end): an 18:00 slot belongs to the 18:00 band, not to the
 * 15:00-18:00 one that just ended. An open-ended band covers every later hour.
 *
 * Standby is excluded by construction — `onDuty.bands` never holds it. A
 * trainer nobody has called in is not a sensible default.
 */
export function trainersAtTime(onDuty: OnDuty, time: string): OnDutyBand[] {
  const at = toHhMm(time);

  return onDuty.bands.filter(
    (band) => band.startTime <= at && (band.endTime === null || at < band.endTime),
  );
}
