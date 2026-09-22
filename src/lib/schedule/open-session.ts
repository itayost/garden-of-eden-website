/**
 * Which of a trainee's workouts is the one they are looking at.
 *
 * A trainee booked into two hours on one day has two sessions. The screen
 * opens one and collapses the rest, and getting that wrong means someone
 * standing at a machine at 19:00 reads the morning's targets.
 *
 * Pure, and takes the clock as a number, because "which hour is now" is
 * exactly the part that must be testable without a real clock.
 */

export interface OpenSessionCandidate {
  id: string;
  /** HH:MM of the slot this session belongs to; null when it has no slot. */
  slotStartTime: string | null;
  /** Session-exercise ids, for resolving a QR scan. */
  exerciseIds: readonly string[];
}

/** Minutes since midnight, or null for a session with no slot. */
function minutesOf(slotStartTime: string | null): number | null {
  if (!slotStartTime) return null;
  const [hours, minutes] = slotStartTime.split(":");
  return Number(hours) * 60 + Number(minutes);
}

/**
 * Chronological, with a session that belongs to no slot last: it has no hour
 * to sort by, and it is the rare shape (one row in the whole table today).
 */
export function sortTodaySessions<T extends { slotStartTime: string | null }>(
  sessions: readonly T[],
): T[] {
  return [...sessions].sort((a, b) => {
    const left = minutesOf(a.slotStartTime);
    const right = minutesOf(b.slotStartTime);
    if (left === null) return right === null ? 0 : 1;
    if (right === null) return -1;
    return left - right;
  });
}

/**
 * The session to open, by id.
 *
 * A scanned exercise decides it outright: the trainee is standing at that
 * machine, and the hour it belongs to is the hour they are in, whatever the
 * clock says about the rest of the day. Otherwise the last hour that has
 * already started wins, and before the first one starts, the earliest.
 */
export function pickOpenSession(
  sessions: readonly OpenSessionCandidate[],
  nowMinutes: number,
  focusId: string | null,
): string | null {
  if (sessions.length === 0) return null;

  if (focusId) {
    const scanned = sessions.find((session) => session.exerciseIds.includes(focusId));
    if (scanned) return scanned.id;
  }

  const ordered = sortTodaySessions(sessions);
  const started = ordered.filter((session) => {
    const minutes = minutesOf(session.slotStartTime);
    return minutes !== null && minutes <= nowMinutes;
  });

  if (started.length > 0) return started[started.length - 1].id;

  const upcoming = ordered.find((session) => session.slotStartTime !== null);
  return (upcoming ?? ordered[0]).id;
}
