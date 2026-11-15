/**
 * Quick tags: the words a Trainer taps for a Trainee after a Slot, read later
 * by the weekly report. Positive tags feed the report; caution tags are for
 * staff only and hold the report for a person. Pure.
 */

import { addDays } from "@/lib/utils/iso-date";
import { minutesUntilSlot, type IsraelNow } from "@/lib/schedule/booking-rules";
import type { SlotTrainee } from "@/types/schedule";

export const QUICK_TAGS = [
  { key: "effort", label: "השקיע", kind: "positive" },
  { key: "progress", label: "התקדם", kind: "positive" },
  { key: "focus", label: "ריכוז טוב", kind: "positive" },
  { key: "leadership", label: "מנהיגות", kind: "positive" },
  { key: "technique", label: "טכניקה טובה", kind: "positive" },
  { key: "personal_best", label: "שיא אישי", kind: "positive" },
  { key: "pain", label: "כאב או פציעה", kind: "caution" },
  { key: "behavior", label: "התנהגות", kind: "caution" },
] as const;

export type QuickTagKey = (typeof QUICK_TAGS)[number]["key"];

export const QUICK_TAG_KEYS = QUICK_TAGS.map((tag) => tag.key) as [QuickTagKey, ...QuickTagKey[]];

/** The one short note a Trainer may add per Trainee per Slot. */
export const NOTE_MAX = 80;

export interface TraineeTags {
  tags: QuickTagKey[];
  note: string | null;
}

/** Trainee id to that Trainee's tags and note, for one Slot. */
export type SlotTags = Record<string, TraineeTags>;

export function isCautionTag(key: QuickTagKey): boolean {
  return QUICK_TAGS.some((tag) => tag.key === key && tag.kind === "caution");
}

type TagSlot = { schedule_date: string; start_time: string; called_off_at?: string | null };

/** Tags open at the Slot's start and close at the end of the next Israel day. */
export function tagWindowRefusal(slot: TagSlot, now: IsraelNow): string | null {
  if (slot.called_off_at) return "האימון סומן כבוטל, אין מה לסמן";
  if (minutesUntilSlot(slot.schedule_date, slot.start_time, now) > 0) {
    return "אפשר לסמן תגיות רק אחרי תחילת האימון";
  }
  if (now.date > addDays(slot.schedule_date, 1)) return "אפשר לסמן תגיות עד סוף היום שאחרי האימון";
  return null;
}

/**
 * Only someone who was there: a linked Roster row with no cancellation. A late
 * cancel did not train, and a recorded removal carries a cancellation too.
 */
export function tagTargetRefusal(roster: readonly SlotTrainee[], traineeId: string): string | null {
  const present = roster.some((row) => row.trainee_id === traineeId && row.cancelled_at === null);
  return present ? null : "המתאמן לא היה ברשימה של האימון הזה";
}

const ORDER: readonly string[] = QUICK_TAG_KEYS;

/** The stored rows of one Slot as one entry per Trainee, tags in chip order. */
export function groupSlotTags(
  tags: readonly { trainee_id: string; tag: string }[],
  notes: readonly { trainee_id: string; note: string }[],
): SlotTags {
  const ids = [...new Set([...tags.map((t) => t.trainee_id), ...notes.map((n) => n.trainee_id)])];
  return Object.fromEntries(
    ids.map((id) => {
      const own = tags
        .filter((t) => t.trainee_id === id && ORDER.includes(t.tag))
        .map((t) => t.tag as QuickTagKey)
        .sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
      const note = notes.find((n) => n.trainee_id === id)?.note ?? null;
      return [id, { tags: own, note }];
    }),
  );
}
