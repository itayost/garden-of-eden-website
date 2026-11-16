/**
 * The week's training records for many Trainees, through the service role:
 * Shift reports, Training sessions, Quick tags and their notes, Check-ins and
 * the workout forms. Each read selects only the columns the Fact sheet uses,
 * so a medical answer or a free-text comment is never loaded at all. Reads
 * keyed by Trainee ids go through readInChunks; a failed read throws.
 */
import "server-only";

import { ENERGY_LEVELS, type Checkin, type EnergyLevel } from "@/features/checkins/lib/checkin";
import type { SleepRange } from "@/features/nutrition/types";
import { QUICK_TAG_KEYS, type QuickTagKey } from "@/features/quick-tags/lib/tags";
import { formatExerciseTarget } from "@/lib/schedule/roster-exercise";
import { readAllPages, readInChunks } from "@/lib/supabase/in-chunks";
import { addDays } from "@/lib/utils/iso-date";
import { israelDateStr } from "@/lib/utils/israel-time";
import type { ShiftReportForNotes } from "@/lib/utils/trainee-notes";
import type { TraineeWeekInput, WeekNote, WeekSession, WeekTag } from "../fact-sheet/types";
import { groupBy, must, type Db } from "./read";

/** An Israel date range, both ends included. */
export interface DayRange {
  from: string;
  to: string;
}

/** Rows by Trainee, each row stripped of the key it was grouped on. */
function byTrainee<T>(rows: readonly { traineeId: string; value: T }[]): Map<string, T[]> {
  return new Map([...groupBy(rows, (r) => r.traineeId)].map(([id, items]) => [id, items.map((i) => i.value)]));
}

// ---------------------------------------------------------------------------
// Shift reports
// ---------------------------------------------------------------------------

const SHIFT_REPORT_SELECT =
  "id, trainer_id, report_date, trainer_name, new_trainees_ids, new_trainees_details, new_trainees_per_trainee, discipline_trainee_ids, discipline_details, discipline_per_trainee, injuries_trainee_ids, injuries_details, injuries_per_trainee, limitations_trainee_ids, limitations_details, limitations_per_trainee, worked_on_trainee_ids, worked_on_details, worked_on_per_trainee, achievements_trainee_ids, achievements_details, achievements_per_trainee, mental_state_trainee_ids, mental_state_details, mental_state_per_trainee, complaints_trainee_ids, complaints_details, complaints_per_trainee, insufficient_attention_trainee_ids, insufficient_attention_details, insufficient_attention_per_trainee, pro_candidates_trainee_ids, pro_candidates_details, pro_candidates_per_trainee, has_social_skills, social_skills_trainee_ids, social_skills_details, social_skills_per_trainee, homework_trainee_ids, homework_details, homework_per_trainee, video_feedback_trainee_ids, video_feedback_details, video_feedback_per_trainee, praise_trainee_ids, praise_details, praise_per_trainee";

/** Every Shift report dated in the range: one small read for everyone. */
export async function readShiftReports(db: Db, range: DayRange): Promise<ShiftReportForNotes[]> {
  return must(
    "trainer_shift_reports",
    await readAllPages(() =>
      db
        .from("trainer_shift_reports")
        .select(SHIFT_REPORT_SELECT)
        .gte("report_date", range.from)
        .lte("report_date", range.to)
        .order("id"),
    ),
  );
}

// ---------------------------------------------------------------------------
// Training sessions
// ---------------------------------------------------------------------------

const SESSION_SELECT =
  "id, trainee_id, slot_id, session_date, exercises:training_session_exercises(order_index, target_sets, target_reps_he, target_reps, target_load_he, target_weight_kg, target_duration_seconds, target_distance_m, exercise:workout_exercises(name_he, name_en, main_category))";

/** A Training session and the Slot it was built for (null for a personal one). */
export interface SessionRead {
  slotId: string | null;
  session: WeekSession;
}

export async function readSessions(
  db: Db,
  traineeIds: readonly string[],
  range: DayRange,
): Promise<Map<string, SessionRead[]>> {
  const rows = must(
    "training_sessions",
    await readInChunks(traineeIds, "trainee_id", () =>
      db
        .from("training_sessions")
        .select(SESSION_SELECT)
        .gte("session_date", range.from)
        .lte("session_date", range.to)
        .order("id"),
    ),
  );
  return byTrainee(
    rows.map((row) => ({
      traineeId: row.trainee_id,
      value: {
        slotId: row.slot_id,
        session: {
          date: row.session_date,
          exercises: [...row.exercises]
            .sort((a, b) => a.order_index - b.order_index)
            .map((exercise) => ({
              name: exercise.exercise?.name_he ?? exercise.exercise?.name_en ?? "",
              category: exercise.exercise?.main_category ?? null,
              target: formatExerciseTarget(exercise),
            })),
        },
      },
    })),
  );
}

// ---------------------------------------------------------------------------
// Quick tags and notes
// ---------------------------------------------------------------------------

function isQuickTagKey(value: string): value is QuickTagKey {
  return (QUICK_TAG_KEYS as readonly string[]).includes(value);
}

/** The week's Quick tags of these Trainees; a tag the app no longer knows is left out. */
export async function readTags(
  db: Db,
  traineeIds: readonly string[],
  range: DayRange,
): Promise<Map<string, WeekTag[]>> {
  const rows = must(
    "slot_trainee_tags",
    await readInChunks(traineeIds, "trainee_id", () =>
      db
        .from("slot_trainee_tags")
        .select("id, slot_id, trainee_id, tag, slot:daily_schedule_slots!inner(schedule_date)")
        .gte("slot.schedule_date", range.from)
        .lte("slot.schedule_date", range.to)
        .order("id"),
    ),
  );
  return byTrainee(
    rows.flatMap((row) => {
      const tag = row.tag;
      return isQuickTagKey(tag)
        ? [{ traineeId: row.trainee_id, value: { slotId: row.slot_id, date: row.slot.schedule_date, tag } }]
        : [];
    }),
  );
}

export async function readNotes(
  db: Db,
  traineeIds: readonly string[],
  range: DayRange,
): Promise<Map<string, WeekNote[]>> {
  const rows = must(
    "slot_trainee_notes",
    await readInChunks(traineeIds, "trainee_id", () =>
      db
        .from("slot_trainee_notes")
        .select("slot_id, trainee_id, note, slot:daily_schedule_slots!inner(schedule_date)")
        .gte("slot.schedule_date", range.from)
        .lte("slot.schedule_date", range.to)
        .order("slot_id")
        .order("trainee_id"),
    ),
  );
  return byTrainee(
    rows.map((row) => ({
      traineeId: row.trainee_id,
      value: { slotId: row.slot_id, date: row.slot.schedule_date, note: row.note },
    })),
  );
}

// ---------------------------------------------------------------------------
// Check-ins and workout forms
// ---------------------------------------------------------------------------

function energyOf(value: number): EnergyLevel | null {
  return ENERGY_LEVELS.find((level) => level === value) ?? null;
}

export async function readCheckins(
  db: Db,
  traineeIds: readonly string[],
  range: DayRange,
): Promise<Map<string, Checkin[]>> {
  const rows = must(
    "trainee_checkins",
    await readInChunks(traineeIds, "trainee_id", () =>
      db
        .from("trainee_checkins")
        .select("id, trainee_id, checkin_date, sleep_hours, energy, soreness")
        .gte("checkin_date", range.from)
        .lte("checkin_date", range.to)
        .order("id"),
    ),
  );
  return byTrainee(
    rows.flatMap((row) => {
      const energy = energyOf(row.energy);
      if (energy === null) return [];
      const checkin: Checkin = {
        date: row.checkin_date,
        sleepHours: Number(row.sleep_hours),
        energy,
        soreness: row.soreness,
      };
      return [{ traineeId: row.trainee_id, value: checkin }];
    }),
  );
}

const SLEEP_RANGES: readonly SleepRange[] = ["4-6", "6-8", "8-11"];

function sleepRangeOf(value: string | null): SleepRange | null {
  return SLEEP_RANGES.find((range) => range === value) ?? null;
}

/**
 * Pre-workout forms by the Israel day they were sent. Only the sleep range is
 * read: the form's injury and nutrition answers never leave the table.
 */
export async function readPreForms(
  db: Db,
  traineeIds: readonly string[],
  range: DayRange,
): Promise<Map<string, TraineeWeekInput["preForms"]>> {
  // Israel runs ahead of UTC, so an Israel day lies inside these UTC bounds.
  const rows = must(
    "pre_workout_forms",
    await readInChunks(traineeIds, "user_id", () =>
      db
        .from("pre_workout_forms")
        .select("id, user_id, submitted_at, sleep_hours")
        .gte("submitted_at", `${addDays(range.from, -1)}T00:00:00Z`)
        .lt("submitted_at", `${addDays(range.to, 1)}T00:00:00Z`)
        .order("id"),
    ),
  );
  return byTrainee(
    rows.flatMap((row) => {
      if (row.submitted_at === null) return [];
      const date = israelDateStr(row.submitted_at);
      if (date < range.from || date > range.to) return [];
      return [{ traineeId: row.user_id, value: { date, sleepRange: sleepRangeOf(row.sleep_hours) } }];
    }),
  );
}

/** Post-workout forms by training date. The free-text comments are never read. */
export async function readPostForms(
  db: Db,
  traineeIds: readonly string[],
  range: DayRange,
): Promise<Map<string, TraineeWeekInput["postForms"]>> {
  const rows = must(
    "post_workout_forms",
    await readInChunks(traineeIds, "user_id", () =>
      db
        .from("post_workout_forms")
        .select("id, user_id, training_date, difficulty_level, satisfaction_level")
        .gte("training_date", range.from)
        .lte("training_date", range.to)
        .order("id"),
    ),
  );
  return byTrainee(
    rows.map((row) => ({
      traineeId: row.user_id,
      value: { date: row.training_date, difficulty: row.difficulty_level, satisfaction: row.satisfaction_level },
    })),
  );
}
