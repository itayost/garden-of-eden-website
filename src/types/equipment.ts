/**
 * Equipment (ציוד) — the studio's machines/stations, each carrying a short
 * code printed as a QR sticker that encodes /dashboard/scan/<code>.
 *
 * Not in generated Supabase types; reads go through `typedFrom()`.
 */

export interface Equipment {
  id: string;
  name_he: string;
  /** Short code embedded in the QR URL. Generated once, never edited. */
  code: string;
  is_active: boolean;
  notes_he: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExerciseLog {
  id: string;
  trainee_id: string;
  exercise_id: string;
  session_exercise_id: string | null;
  equipment_id: string | null;
  sets: number | null;
  reps: number | null;
  weight_kg: number | null;
  note_he: string | null;
  logged_at: string;
}

/** The scan URL printed on each sticker. */
export function equipmentScanUrl(baseUrl: string, code: string): string {
  return `${baseUrl.replace(/\/$/, "")}/dashboard/scan/${code}`;
}
