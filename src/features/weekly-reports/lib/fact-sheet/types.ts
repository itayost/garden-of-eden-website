/**
 * The Fact sheet (דף עובדות): everything computed about one Trainee's Report
 * week, and the only thing the model sees. Plain JSON with Hebrew labels.
 *
 * `TraineeWeekInput` is what the week loaders produce, already narrowed to the
 * week and the Trainee. `buildFactSheet()` is the one path from it to the
 * model; nothing here may carry a full name, a phone number, a medical note or
 * a sensitive Shift report category.
 */

import type { Checkin } from "@/features/checkins/lib/checkin";
import type { NutritionMeasurementRow, SleepRange } from "@/features/nutrition/types";
import type { QuickTagKey } from "@/features/quick-tags/lib/tags";
import type { GroupStats } from "@/lib/assessment-to-rating";
import type { Gender } from "@/lib/profile/gender";
import type { ShiftReportForNotes } from "@/lib/utils/trainee-notes";
import type { PlayerAssessment } from "@/types/assessment";
import type { PlayerGoalRow } from "@/types/database";

// ---------------------------------------------------------------------------
// Holds
// ---------------------------------------------------------------------------

export type HoldCode =
  // text problems: recomputed whenever the text changes
  | "number"
  | "drill"
  | "length"
  | "forbidden_word"
  | "missing_gender"
  | "writing_failed"
  // need a person
  | "sensitive"
  | "manual";

export interface HoldReason {
  code: HoldCode;
  text: string;
}

export const TEXT_PROBLEM_CODES: readonly HoldCode[] = [
  "number",
  "drill",
  "length",
  "forbidden_word",
  "missing_gender",
  "writing_failed",
];

export const MISSING_GENDER_HOLD: HoldReason = { code: "missing_gender", text: "חסר מגדר" };

// ---------------------------------------------------------------------------
// The input: one Trainee, one Report week
// ---------------------------------------------------------------------------

export interface WeekRosterRow {
  date: string;
  startTime: string;
  focus: string | null;
  slotId: string;
  /** rowCounts() of the row, worked out by the loader. */
  counts: boolean;
  lateCancel: boolean;
  trainerFirstNames: string[];
}

export interface WeekTag {
  slotId: string;
  date: string;
  tag: QuickTagKey;
}

export interface WeekNote {
  slotId: string;
  date: string;
  note: string;
}

export interface WeekExercise {
  name: string;
  category: string | null;
  /** formatExerciseTarget() of the exercise, "" when it has none. */
  target: string;
}

export interface WeekSession {
  date: string;
  exercises: WeekExercise[];
}

export interface ArboxEntrance {
  date: string;
  className: string | null;
}

/** The measurement columns the Fact sheet reads. */
export type NutritionMeasurement = Pick<
  NutritionMeasurementRow,
  "measurement_date" | "weight_kg" | "height_cm" | "bmi" | "bmi_percentile" | "height_percentile"
>;

/** A Development book drill as readers show it: the same shape as the book's `DrillLine`. */
export interface DrillCandidate {
  id: string;
  name: string;
  why: string | null;
}

/**
 * A drill offered to the model in the Fact sheet, with `goal`: the Hebrew
 * label of the open Goal it serves, the same text as that Goal's
 * `goals[].metric`, so the model can match drills to Goals.
 */
export interface SheetDrill extends DrillCandidate {
  goal: string;
}

export interface TraineeWeekInput {
  /** Used to pick this Trainee's entries; never copied into the sheet. */
  traineeId: string;
  weekStart: string;
  profile: {
    gender: Gender | null;
    birthdate: string | null;
    position: string | null;
    ageGroup: string | null;
    branchNames: string[];
  };
  roster: WeekRosterRow[];
  arbox: ArboxEntrance[];
  /** The week's Shift reports that name the Trainee. */
  shiftReports: ShiftReportForNotes[];
  sessions: WeekSession[];
  tags: WeekTag[];
  notes: WeekNote[];
  checkins: Checkin[];
  preForms: { date: string; sleepRange: SleepRange | null }[];
  postForms: { date: string; difficulty: number | null; satisfaction: number | null }[];
  assessment: {
    inWeek: PlayerAssessment | null;
    previous: PlayerAssessment | null;
    groupStats: GroupStats | null;
  };
  measurement: { inWeek: NutritionMeasurement | null; previous: NutritionMeasurement | null };
  dietitianNote: string | null;
  /** Open Goals (achieved_at is null). */
  goals: PlayerGoalRow[];
  nextGame: { date: string; opponent: string } | null;
  /** Up to 6 drills for the open Goals, chosen by `sheetDrills()`. */
  drillCandidates: SheetDrill[];
}

// ---------------------------------------------------------------------------
// The sheet
// ---------------------------------------------------------------------------

export interface AttendanceDay {
  date: string;
  weekday: string;
  focus: string | null;
  trainers: string[];
  source: "יומן" | "ארבוקס";
}

export interface WorkedOnFact {
  date: string;
  source: string;
  items: string[];
}

export interface ProgressFact {
  date: string;
  source: string;
  label: string;
  details: string | null;
  categories: string[];
}

export interface Habits {
  checkins: number;
  sleepAverage: number | null;
  sleepLowest: number | null;
  energyAverage: number | null;
  sorenessDays: number;
  /** The most common pre-workout sleep range, only when there is no Check-in. */
  preFormSleep: string | null;
  postForm: { difficultyAverage: number | null; satisfactionAverage: number | null } | null;
}

export interface AssessmentFacts {
  date: string;
  first: boolean;
  improvements: { label: string; change: string }[];
  unchanged: number;
  /** Counted, never named: the report is about progress. */
  regressions: number;
  rating: number | null;
}

export interface GoalFact {
  metric: string;
  baseline: number | null;
  current: number | null;
  target: number;
  unit: string;
  progressPercent: number;
  status: string;
}

export interface FactSheet {
  version: 1;
  week: { from: string; to: string };
  player: { gender: Gender | null; ageGroup: string | null; position: string | null; branches: string[] };
  attendance: { total: number; lateCancels: number; days: AttendanceDay[] };
  workedOn: WorkedOnFact[];
  progress: ProgressFact[];
  habits: Habits | null;
  assessment: AssessmentFacts | null;
  goals: GoalFact[];
  drills: SheetDrill[];
  nextGame: { date: string; opponent: string } | null;
  hasNewMeasurement: boolean;
  hasDietitianNote: boolean;
}

/** Shown to readers by code, never given to the model. */
export interface BodyFacts {
  date: string;
  weightKg: number | null;
  heightCm: number | null;
  bmi: number | null;
  bmiPercentile: number | null;
  heightPercentile: number | null;
  change: { weightKg: number | null; heightCm: number | null } | null;
  dietitianNote: string | null;
}

export interface BuiltSheet {
  sheet: FactSheet;
  body: BodyFacts | null;
  holds: HoldReason[];
}
