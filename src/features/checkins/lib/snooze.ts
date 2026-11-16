/**
 * "לא היום" on the Check-in card: the Israel date it was put away for, kept in
 * this browser only. Storage can be missing or throw (a private window), so a
 * failed read means "not put away" and a failed write is ignored.
 */

const KEY = "goe_checkin_snooze";

export function readCheckinSnooze(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function writeCheckinSnooze(date: string): void {
  try {
    window.localStorage.setItem(KEY, date);
  } catch {
    // Nothing to do: the card simply shows again on the next visit.
  }
}
