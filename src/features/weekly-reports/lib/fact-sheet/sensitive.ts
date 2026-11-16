/**
 * How each Shift report category is treated by the Fact sheet. Pure.
 *
 * - Written: copied into the sheet for the model.
 * - Sensitive: never copied; naming the Trainee holds the report for a person.
 * - Ignored: staff matters, neither written nor a reason to hold.
 *
 * Together the three lists hold exactly the 14 NoteCategoryType values (pinned
 * by a test), so a new Shift report category cannot slip through unclassified;
 * one that somehow does is treated as sensitive.
 */

import type { NoteCategoryType } from "@/lib/utils/trainee-notes";

export const WRITTEN_NOTE_TYPES = [
  "worked_on",
  "achievements",
  "praise",
  "homework",
  "video_feedback",
] as const satisfies readonly NoteCategoryType[];

export const SENSITIVE_NOTE_TYPES = [
  "injuries",
  "limitations",
  "mental_state",
  "discipline",
  "complaints",
  "insufficient_attention",
] as const satisfies readonly NoteCategoryType[];

export const IGNORED_NOTE_TYPES = [
  "new_trainee",
  "pro_candidates",
  "social_skills",
] as const satisfies readonly NoteCategoryType[];

export type NoteHandling = "written" | "sensitive" | "ignored";

export function noteHandling(type: NoteCategoryType): NoteHandling {
  if ((WRITTEN_NOTE_TYPES as readonly NoteCategoryType[]).includes(type)) return "written";
  if ((IGNORED_NOTE_TYPES as readonly NoteCategoryType[]).includes(type)) return "ignored";
  return "sensitive";
}
