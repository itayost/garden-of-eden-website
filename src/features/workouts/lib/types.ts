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
  /** Free-text label, display fallback. */
  equipment: string | null;
  /** Structured link to the equipment catalog; drives QR scan matching. */
  equipmentId: string | null;
  cuesHe: string | null;
  goalHe: string | null;
  orderIndex: number;
}

export interface ExerciseFilters {
  mainCategory?: string;
  subCategory?: string;
  search?: string;
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
