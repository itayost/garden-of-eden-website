import { z } from "zod";
import { isValidDateString, isValidUUID } from "./common";

export const NOTE_COLORS = ["none", "yellow", "red", "green"] as const;
export type NoteColor = (typeof NOTE_COLORS)[number];

export const NOTE_COLOR_BG: Record<NoteColor, string> = {
  none: "",
  yellow: "bg-yellow-100",
  red: "bg-red-100",
  green: "bg-green-100",
};

const nameSchema = z
  .string()
  .transform((v) => v.trim())
  .refine((v) => v.length > 0, { message: "חובה להזין שם" })
  .refine((v) => v.length <= 200, { message: "השם ארוך מדי" });

const dateSchema = z
  .string()
  .refine(isValidDateString, { message: "תאריך לא תקין" });

const noteSchema = z
  .string()
  .max(2000, { message: "הערה ארוכה מדי" })
  .optional()
  .default("");

const noteColorSchema = z.enum(NOTE_COLORS).optional().default("none");

export const createChurnedCustomerSchema = z.object({
  name: nameSchema,
  endDate: dateSchema,
  note: noteSchema,
  noteColor: noteColorSchema,
});

export type CreateChurnedCustomerInput = z.infer<
  typeof createChurnedCustomerSchema
>;

export const updateChurnedCustomerSchema = z.object({
  name: nameSchema.optional(),
  endDate: dateSchema.optional(),
  note: z.string().max(2000).optional(),
  noteColor: z.enum(NOTE_COLORS).optional(),
});

export type UpdateChurnedCustomerInput = z.infer<
  typeof updateChurnedCustomerSchema
>;

export const bulkRowSchema = z.object({
  name: nameSchema,
  endDate: dateSchema,
});

export type BulkChurnedRow = z.infer<typeof bulkRowSchema>;

export const churnedIdSchema = z
  .string()
  .refine(isValidUUID, { message: "מזהה לא תקין" });
