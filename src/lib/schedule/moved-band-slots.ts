/**
 * What happens to a band's future days on its old weekday when it moves.
 *
 * A day nobody is on is deleted, as deleting a band deletes its future days.
 * A day someone is on is kept, detached from the band and closed to new
 * bookings: a trainee's booking never disappears silently, and staff decide
 * what to do with it.
 */
export interface MovedBandSlot {
  readonly id: string;
  /** Roster rows that still count: not cancelled, or cancelled late. */
  readonly activeTrainees: number;
}

export function partitionMovedBandSlots(slots: readonly MovedBandSlot[]): {
  deleteIds: string[];
  detachIds: string[];
} {
  return {
    deleteIds: slots.filter((s) => s.activeTrainees === 0).map((s) => s.id),
    detachIds: slots.filter((s) => s.activeTrainees > 0).map((s) => s.id),
  };
}
