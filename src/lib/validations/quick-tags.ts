import { z } from "zod";
import { UUID_REGEX } from "@/lib/validations/common";
import { NOTE_MAX, QUICK_TAG_KEYS } from "@/features/quick-tags/lib/tags";

const slotAndTrainee = {
  slotId: z.string().regex(UUID_REGEX, "מזהה אימון לא תקין"),
  traineeId: z.string().regex(UUID_REGEX, "מזהה מתאמן לא תקין"),
};

/** One tap on a chip: on adds the tag, off removes it. */
export const quickTagToggleSchema = z.object({
  ...slotAndTrainee,
  tag: z.enum(QUICK_TAG_KEYS),
  on: z.boolean(),
});

/** The note; an empty one deletes it. */
export const quickTagNoteSchema = z.object({
  ...slotAndTrainee,
  note: z.string().trim().max(NOTE_MAX, `עד ${NOTE_MAX} תווים`),
});

export type QuickTagToggleInput = z.input<typeof quickTagToggleSchema>;
export type QuickTagNoteInput = z.input<typeof quickTagNoteSchema>;
