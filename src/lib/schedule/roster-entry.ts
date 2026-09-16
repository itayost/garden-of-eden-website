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
