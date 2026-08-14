/**
 * Weekly schedule (לוח שבועי) — the standing staffing layer above the board.
 *
 * A Band is the atom: one stretch of one weekday a trainer covers. Bands carry
 * no date. The staffing in force on an actual date is derived from them plus
 * that date's Exceptions — see src/lib/utils/weekly-schedule.ts, which owns the
 * derivation rule, and docs/adr/0003-weekly-schedule-derives-staffing.md.
 *
 * Neither table is in the generated Supabase types, so reads go through
 * `typedFrom()` and these interfaces are the source of truth.
 */

/** 0 = Sunday .. 6 = Saturday, matching getIsraelTime().dayOfWeek. */
export const WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;
export type Weekday = (typeof WEEKDAYS)[number];

/** The days the academy actually staffs. Saturday is legal but always empty. */
export const SCHEDULED_WEEKDAYS: readonly Weekday[] = [0, 1, 2, 3, 4, 5];

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  0: "ראשון",
  1: "שני",
  2: "שלישי",
  3: "רביעי",
  4: "חמישי",
  5: "שישי",
  6: "שבת",
};

export const EXCEPTION_KINDS = ["absent", "extra"] as const;
export type ExceptionKind = (typeof EXCEPTION_KINDS)[number];

export const EXCEPTION_KIND_LABELS: Record<ExceptionKind, string> = {
  absent: "היעדרות",
  extra: "תוספת חד-פעמית",
};

export interface WeeklyBand {
  id: string;
  weekday: Weekday;
  /** Postgres TIME serialized as HH:MM:SS. */
  start_time: string;
  /** Null = open-ended ("18:00 והלאה") — runs to the end of the day. */
  end_time: string | null;
  trainer_id: string;
  trainer_name: string;
  location_he: string | null;
  label_he: string | null;
  is_standby: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface WeeklyException {
  id: string;
  /** ISO YYYY-MM-DD. */
  exception_date: string;
  trainer_id: string;
  trainer_name: string;
  kind: ExceptionKind;
  /** Set for 'extra' only; an absence covers the trainer's whole day. */
  start_time: string | null;
  end_time: string | null;
  location_he: string | null;
  label_he: string | null;
  note_he: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
}

/**
 * One stretch of staffing in force on a specific date.
 *
 * `source` records where it came from, because the two read differently on the
 * board: a standing band is the normal week, a one-off is something the admin
 * arranged for this date and wants to see called out.
 */
export interface OnDutyBand {
  /** Band id, or exception id when source is "exception". */
  id: string;
  source: "band" | "exception";
  /** HH:MM, already trimmed from the DB's HH:MM:SS. */
  startTime: string;
  /** HH:MM, or null for an open-ended stretch. */
  endTime: string | null;
  trainerId: string;
  trainerName: string;
  locationHe: string | null;
  labelHe: string | null;
  isStandby: boolean;
}

/** A trainer the standing week expected, removed by an absence Exception. */
export interface OnDutyAbsence {
  trainerId: string;
  trainerName: string;
  noteHe: string | null;
}

/** The staffing actually in force on one date. Derived, never stored. */
export interface OnDuty {
  /** ISO YYYY-MM-DD the staffing was derived for. */
  date: string;
  weekday: Weekday;
  /** Working stretches, ordered by start time then trainer name. */
  bands: OnDutyBand[];
  /** Standby trainers, shown but never used to seed a slot. */
  standby: OnDutyBand[];
  /** Who the standing week expected but is away, so the day explains itself. */
  absences: OnDutyAbsence[];
}
