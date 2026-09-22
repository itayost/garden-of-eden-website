/**
 * Daily schedule (לוח יומי) — Phase 1 of the studio training pipeline.
 *
 * A Slot is the schedule atom: (date, hour, trainer, focus, location, roster).
 * Two trainers at the same hour with different groups are two slots.
 *
 * Neither table is in the generated Supabase types, so reads go through
 * `typedFrom()` and these interfaces are the source of truth.
 */

import {
  EQUIPMENT_PROFILE_COLUMNS,
  type EquipmentProfile,
} from "@/types/equipment";

/**
 * PostgREST select string for a slot with its roster joined and ordered, and
 * with the ids of its group workout's exercises.
 *
 * The exercise ids are there for their count alone: the calendar and the
 * session-building list both label the slot with how many exercises its group
 * workout has, and asking for that per card would be one query per slot.
 */
export const SLOT_SELECT_WITH_TRAINEES =
  "*, trainees:daily_schedule_slot_trainees(id, slot_id, trainee_id, trainee_name, order_index, source, booked_at, cancelled_at, late_cancel, reminded_at), workout_exercises:slot_workout_exercises(id)";

export interface SlotTrainee {
  id: string;
  slot_id: string;
  /**
   * Null for roster names that are not system accounts. Phase 2 sessions can
   * only attach to rows where this is set.
   */
  trainee_id: string | null;
  trainee_name: string;
  order_index: number;
  /** staff typed the name on the board; self = the trainee booked it. */
  source: "staff" | "self";
  booked_at: string | null;
  /** A self-cancel keeps the row so a late cancel can still count as used. */
  cancelled_at: string | null;
  late_cancel: boolean;
  reminded_at: string | null;
}

export interface ScheduleSlot {
  id: string;
  /** ISO YYYY-MM-DD. */
  schedule_date: string;
  /** Postgres TIME serialized as HH:MM:SS. */
  start_time: string;
  trainer_id: string | null;
  trainer_name: string | null;
  focus_he: string | null;
  location_he: string | null;
  branch_id: string | null;
  /** The band that projected this slot, when any. */
  band_id: string | null;
  /** Seats for self-booking; null means staff-only (every חיפה slot). */
  max_trainees: number | null;
  /** The group workout's notes; null when the slot has none. */
  workout_notes_he: string | null;
  /** Who wrote the group workout. Credits the sessions it fans out. */
  workout_built_by: string | null;
  workout_built_by_name: string | null;
  /** Null means this slot has no group workout. */
  workout_updated_at: string | null;
  /** Ids only, for the count. Absent on selects that do not embed them. */
  workout_exercises?: { id: string }[];
  trainees: SlotTrainee[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

/**
 * PostgREST select for a slot's group workout, with the library row and the
 * machine profile each exercise needs to render its own target inputs. Same
 * embed as TEMPLATE_SELECT_WITH_EXERCISES, for the same reason: without it the
 * editor would show a free-text load field and the saved numeric targets would
 * have nowhere to go.
 */
export const SLOT_WORKOUT_SELECT =
  `*, exercises:slot_workout_exercises(id, slot_id, exercise_id, order_index, target_sets, target_reps_he, target_load_he, target_reps, target_weight_kg, target_duration_seconds, target_distance_m, notes_he, exercise:workout_exercises(id, name_he, name_en, main_category, sub_category, equipment, equipment_id, cues_he, equipment_ref:equipment(${EQUIPMENT_PROFILE_COLUMNS})))`;

export interface SlotWorkoutExercise {
  id: string;
  slot_id: string;
  exercise_id: string;
  order_index: number;
  target_sets: number | null;
  target_reps_he: string | null;
  target_load_he: string | null;
  /** Numeric targets, beside the free text rather than instead of it. */
  target_reps: number | null;
  target_weight_kg: number | null;
  target_duration_seconds: number | null;
  target_distance_m: number | null;
  notes_he: string | null;
  /** Joined library row, for display and for restoring the machine profile. */
  exercise?: {
    id: string;
    name_he: string | null;
    name_en: string | null;
    main_category: string;
    sub_category: string | null;
    equipment: string | null;
    equipment_id?: string | null;
    cues_he?: string | null;
    equipment_ref?: EquipmentProfile | null;
  } | null;
}

/** One slot with its group workout, as the editor screen reads it. */
export interface SlotWorkout {
  slot: ScheduleSlot;
  exercises: SlotWorkoutExercise[];
  /** Active, linked roster members: how many would receive a save. */
  rosterCount: number;
}
