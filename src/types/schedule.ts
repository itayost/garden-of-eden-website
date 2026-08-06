/**
 * Daily schedule (לוח יומי) — Phase 1 of the studio training pipeline.
 *
 * A Slot is the schedule atom: (date, hour, trainer, focus, location, roster).
 * Two trainers at the same hour with different groups are two slots.
 *
 * Neither table is in the generated Supabase types, so reads go through
 * `typedFrom()` and these interfaces are the source of truth.
 */

/** PostgREST select string for a slot with its roster joined and ordered. */
export const SLOT_SELECT_WITH_TRAINEES =
  "*, trainees:daily_schedule_slot_trainees(id, slot_id, trainee_id, trainee_name, order_index)";

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
  trainees: SlotTrainee[];
  created_by: string;
  created_at: string;
  updated_at: string;
}
