import { rowCounts } from "@/lib/schedule/booking-rules";

/**
 * What happens to a band's future days on its old weekday when it moves.
 *
 * A day nobody is on and nothing was prepared for is deleted, as deleting a
 * band deletes its future days. A day someone is on (a late cancel counts:
 * it already cost a session), or one with a group workout written, is kept,
 * detached from the band and closed to new bookings: nothing staff or a
 * trainee put there disappears silently.
 */
export interface MovedBandSlot {
  readonly id: string;
  readonly hasWorkout: boolean;
}

export interface MovedBandRosterRow {
  readonly slot_id: string;
  readonly cancelled_at: string | null;
  readonly late_cancel: boolean;
}

export function partitionMovedBandSlots(
  slots: readonly MovedBandSlot[],
  roster: readonly MovedBandRosterRow[],
): { deleteIds: string[]; detachIds: string[] } {
  const occupied = new Set(roster.filter(rowCounts).map((r) => r.slot_id));
  const keep = (s: MovedBandSlot) => s.hasWorkout || occupied.has(s.id);
  return {
    deleteIds: slots.filter((s) => !keep(s)).map((s) => s.id),
    detachIds: slots.filter(keep).map((s) => s.id),
  };
}
