import { z } from "zod";

// ---------------------------------------------------------------------------
// Cell schema
// ---------------------------------------------------------------------------

export const programCellSchema = z.object({
  week: z.number().int().min(1),
  sets: z.number().int().min(0).nullable(),
  reps_he: z.string(),
  load_he: z.string(),
  notes_he: z.string(),
});

// ---------------------------------------------------------------------------
// Program meta schema
// ---------------------------------------------------------------------------

export const programMetaSchema = z.object({
  name: z.string().min(1, "נדרש שם לתוכנית"),
  description: z.string().nullable().optional(),
  weeks: z.number().int().min(1, "מינימום שבוע אחד").max(52, "מקסימום 52 שבועות"),
  periodization_type: z.string().nullable().optional(),
});

export type ProgramMetaInput = z.infer<typeof programMetaSchema>;

// ---------------------------------------------------------------------------
// Row schema
// ---------------------------------------------------------------------------

export const programRowSchema = z.object({
  exercise_id: z.string().uuid("מזהה תרגיל לא תקין"),
  notes_he: z.string().nullable().optional(),
  cells: z.array(programCellSchema),
});

export type ProgramRowInput = z.infer<typeof programRowSchema>;

// ---------------------------------------------------------------------------
// Rows (array) schema
// ---------------------------------------------------------------------------

export const programRowsSchema = z.array(programRowSchema);

export type ProgramRowsInput = z.infer<typeof programRowsSchema>;
