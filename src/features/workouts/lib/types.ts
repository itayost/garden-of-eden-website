import type { EquipmentProfile } from "@/types/equipment";

export const MAIN_CATEGORIES = [
  "קואורדינציה וזריזות",
  "כוח מתפרץ ופליאומטריה",
  "כוח - פלג גוף תחתון",
  "כוח - פלג גוף עליון וליבה",
  "אירובי וסיבולת",
] as const;
export type MainCategory = (typeof MAIN_CATEGORIES)[number];

export interface WorkoutExercise {
  id: string;
  mainCategory: string;
  subCategory: string | null;
  nameHe: string | null;
  nameEn: string | null;
  /** Free-text label, display fallback. Superseded by equipmentId. */
  equipment: string | null;
  /** Structured link to the equipment catalog; drives QR scan matching. */
  equipmentId: string | null;
  /** Denormalized for the library table, so a linked row reads as linked. */
  equipmentName: string | null;
  equipmentCode: string | null;
  /** The machine's profile, so the session builder seeds without a fetch. */
  equipmentProfile: EquipmentProfile | null;
  /** Per-exercise default overrides. NULL means inherit from the equipment. */
  defaultSets: number | null;
  defaultReps: number | null;
  defaultWeightKg: number | null;
  defaultDurationSeconds: number | null;
  defaultDistanceM: number | null;
  cuesHe: string | null;
  goalHe: string | null;
  orderIndex: number;
}

/**
 * Sentinel for "exercises linked to no machine". Not a UUID, so it can never
 * collide with a real equipment id. Lives here rather than beside the query:
 * `actions/exercises.ts` is a "use server" module and may only export async
 * functions.
 */
export const UNLINKED_EQUIPMENT_FILTER = "__unlinked__";

export interface ExerciseFilters {
  mainCategory?: string;
  subCategory?: string;
  search?: string;
  /** An equipment id, or UNLINKED_EQUIPMENT_FILTER for rows with no machine. */
  equipmentId?: string;
}

export interface WorkoutProgram {
  id: string;
  name: string;
  description: string | null;
  weeks: number;
  periodizationType: string | null;
  createdBy: string | null;
  orderIndex: number;
}

export interface ProgramCell {
  week: number;
  sets: number | null;
  repsHe: string;
  loadHe: string;
  notesHe: string;
}

export interface ProgramExerciseRow {
  key: string;            // stable client key (db id for existing rows, generated for new)
  exerciseId: string;
  exerciseName: string;   // display only (from the joined exercise)
  notesHe: string;
  cells: ProgramCell[];   // length === program.weeks, indexed by week-1
}

export interface ProgramGrid {
  program: WorkoutProgram;
  rows: ProgramExerciseRow[];
}
