import { z } from "zod";

// Free-text communication note. 2000 chars matches the long-text limit
// used elsewhere (see forms.ts MAX_LONG_TEXT).
export const MAX_NOTE_LENGTH = 2000;

export const addCommunicationNoteSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "נא להזין הערה")
    .max(MAX_NOTE_LENGTH, "ההערה ארוכה מדי"),
});

export type AddCommunicationNoteInput = z.infer<typeof addCommunicationNoteSchema>;
