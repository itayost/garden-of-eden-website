import {
  EQUIPMENT_PROFILE_COLUMNS,
  type EquipmentProfile,
} from "@/types/equipment";

/**
 * Session templates (תבניות אימון).
 *
 * A named, reusable single-day exercise list with its targets, saved from a
 * training session and loadable into any trainee's day. Not a Program — a
 * Program is a multi-week grid whose cells cannot carry the numeric targets or
 * the equipment link. Staff-only; never assigned to a trainee.
 *
 * Tables are not in the generated Supabase types; reads go through
 * `typedFrom()` and these interfaces are the source of truth.
 */

/**
 * PostgREST select string for a template with its exercises and their library
 * rows.
 *
 * The equipment embed is the point of this table pair: without it a loaded
 * template would render the free-text load field instead of the machine's own
 * inputs, and the saved numeric targets would have nowhere to go.
 *
 * No logs embed — a template is planned, never performed.
 */
export const TEMPLATE_SELECT_WITH_EXERCISES =
  `*, exercises:session_template_exercises(id, template_id, exercise_id, order_index, target_sets, target_reps_he, target_load_he, target_reps, target_weight_kg, target_duration_seconds, target_distance_m, notes_he, exercise:workout_exercises(id, name_he, name_en, main_category, sub_category, equipment, equipment_id, cues_he, equipment_ref:equipment(${EQUIPMENT_PROFILE_COLUMNS})))`;

export interface SessionTemplateExercise {
  id: string;
  template_id: string;
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
    /** The linked machine's profile, driving which inputs render. */
    equipment_ref?: EquipmentProfile | null;
  } | null;
}

export interface SessionTemplate {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  created_by_name: string;
  exercises: SessionTemplateExercise[];
  created_at: string;
  updated_at: string;
}

/** Row shape for the templates list and the builder's import dropdown. */
export interface SessionTemplateSummary {
  id: string;
  name: string;
  description: string | null;
  createdByName: string;
  exerciseCount: number;
  updatedAt: string;
}
