import { minutesUntilSlot, type IsraelNow } from "@/lib/schedule/booking-rules";
import type { SlotTrainee } from "@/types/schedule";

/**
 * What adding one name to a slot's roster should do.
 *
 * Staff may over-fill a slot (ADR-0007); the flag only drives a warning. A
 * trainee who cancelled keeps their row, and the unique (slot, trainee) index
 * would refuse a second one, so re-adding them reinstates that row.
 */
export type RosterAddPlan =
  | { kind: "reject"; error: string }
  | { kind: "insert"; orderIndex: number; overCapacity: boolean }
  | { kind: "reinstate"; rowId: string; overCapacity: boolean };

export function planRosterAdd(
  roster: SlotTrainee[],
  entry: { traineeId: string | null; name: string },
  maxTrainees: number | null,
): RosterAddPlan {
  const active = roster.filter((row) => row.cancelled_at === null);
  const overCapacity = maxTrainees !== null && active.length + 1 > maxTrainees;

  if (entry.traineeId !== null) {
    const existing = roster.find((row) => row.trainee_id === entry.traineeId);
    if (existing && existing.cancelled_at === null) {
      return { kind: "reject", error: "המתאמן כבר רשום לסלוט" };
    }
    if (existing) return { kind: "reinstate", rowId: existing.id, overCapacity };
  } else if (active.some((row) => row.trainee_name === entry.name)) {
    return { kind: "reject", error: "השם כבר ברשימה" };
  }

  const orderIndex = roster.reduce((next, row) => Math.max(next, row.order_index + 1), 0);
  return { kind: "insert", orderIndex, overCapacity };
}

/** A cancellation is usage history (a late cancel counts as a used session), so staff cannot erase it. */
export function planRosterRemove(row: SlotTrainee): string | null {
  if (row.cancelled_at !== null) return "ביטול שכבר נרשם נשמר בהיסטוריה ואינו ניתן להסרה";
  return null;
}

type SlotTiming = { schedule_date: string; start_time: string };

const hasStarted = (slot: SlotTiming, now: IsraelNow) => minutesUntilSlot(slot.schedule_date, slot.start_time, now) <= 0;

/**
 * Removing a name from a Slot that has not started deletes it, as always.
 * From a Slot that already started it is a recorded removal: the entry stays
 * on record (who, when, why) and stops counting as a used session.
 */
export function rosterRemovalMode(slot: SlotTiming, now: IsraelNow): "delete" | "record" {
  return hasStarted(slot, now) ? "record" : "delete";
}

/**
 * Who may correct the Roster of a Slot that already happened: the Trainers
 * who ran it, and Admins and Branch managers of its branch.
 */
export function mayCorrectPastSlot(
  actor: { role: string; userId: string; managesBranch: boolean },
  slot: { trainerIds: readonly string[] },
): boolean {
  if (actor.role === "admin" || actor.managesBranch) return true;
  return actor.role === "trainer" && slot.trainerIds.includes(actor.userId);
}

/** A Slot is Called off after the fact: only one that already started. */
export function callOffRefusal(slot: SlotTiming, now: IsraelNow): string | null {
  return hasStarted(slot, now) ? null : "אפשר לסמן כבוטל רק אימון שמועד תחילתו עבר";
}

/**
 * What the Slot form may not change once an hour has happened: its roster
 * (corrected from the roster sheet, where a removal is recorded, never
 * deleted), its move into the future (which would turn a recorded removal
 * back into a delete), and the time of a Called off Slot (which would make a
 * future hour free). Null when the edit is fine.
 */
export function pastSlotEditRefusal(
  existing: SlotTiming & { called_off_at: string | null },
  next: { scheduleDate: string; startTime: string },
  rosterSent: boolean,
  now: IsraelNow,
): string | null {
  const moved =
    next.scheduleDate !== existing.schedule_date || next.startTime.slice(0, 5) !== existing.start_time.slice(0, 5);
  if (existing.called_off_at && moved) return "אי אפשר להזיז אימון שסומן כבוטל. בטלו קודם את הסימון.";
  if (!hasStarted(existing, now)) return null;
  if (rosterSent) return "את רשימת המתאמנים של אימון שכבר התקיים מתקנים מחלון הרשימה";
  const nextSlot = { schedule_date: next.scheduleDate, start_time: next.startTime };
  return hasStarted(nextSlot, now) ? null : "אי אפשר להזיז אימון שכבר התקיים למועד עתידי";
}
