/**
 * What a slot's group workout does to each roster member, as one pure
 * decision.
 *
 * A trainee cannot see or log a workout that has no training_sessions row of
 * their own, so saving a group workout writes one session per roster member.
 * Two things must never be overwritten by that: a session a trainer built for
 * this trainee individually, and a session the trainee already completed. A
 * session belongs to one slot, so a trainee booked into two hours holds two
 * and neither hour can take the other's.
 *
 * The apply_slot_workout_to_trainee Postgres function implements exactly these
 * outcomes with these names. This module is where they are pinned down and
 * tested, and where the Hebrew summary is built.
 */

export type FanoutAction = "create" | "refresh" | "skip_custom" | "skip_completed";

export interface FanoutCandidate {
  traineeId: string;
  traineeName: string;
}

/** The trainee's session for THIS slot, when they already have one. */
export interface ExistingSession {
  /** Null means a trainer edited this session individually. */
  slotWorkoutSyncedAt: string | null;
  completedAt: string | null;
}

export interface FanoutDecision {
  traineeId: string;
  traineeName: string;
  action: FanoutAction;
}

export type FanoutCounts = Partial<Record<FanoutAction, number>>;

/**
 * Completion is checked before authorship: a finished session is history
 * whoever wrote it.
 *
 * There is no "belongs to another slot" case any more. A session belongs to
 * one slot, so the caller looks up this slot's session and a trainee's other
 * hour is simply not in the map.
 */
function decide(existing: ExistingSession | undefined): FanoutAction {
  if (!existing) return "create";
  if (existing.completedAt !== null) return "skip_completed";
  if (existing.slotWorkoutSyncedAt === null) return "skip_custom";
  return "refresh";
}

export function planSlotWorkoutFanout(
  candidates: readonly FanoutCandidate[],
  existing: Readonly<Record<string, ExistingSession>>,
): FanoutDecision[] {
  return candidates.map((candidate) => ({
    traineeId: candidate.traineeId,
    traineeName: candidate.traineeName,
    action: decide(existing[candidate.traineeId]),
  }));
}

export function countFanout(decisions: readonly FanoutDecision[]): FanoutCounts {
  return decisions.reduce<FanoutCounts>(
    (counts, decision) => ({
      ...counts,
      [decision.action]: (counts[decision.action] ?? 0) + 1,
    }),
    {},
  );
}

const SKIP_LABELS: { action: FanoutAction; label: string }[] = [
  { action: "skip_custom", label: "עם אימון אישי" },
  { action: "skip_completed", label: "שכבר הושלם" },
];

/** "האימון נשלח ל-3 מתאמנים. דילוג: 1 עם אימון אישי" */
export function describeFanout(counts: FanoutCounts): string {
  const received = (counts.create ?? 0) + (counts.refresh ?? 0);
  const skipped = SKIP_LABELS.flatMap(({ action, label }) => {
    const count = counts[action] ?? 0;
    return count > 0 ? [`${count} ${label}`] : [];
  });

  if (received === 0 && skipped.length === 0) {
    return "אין רשומים לסלוט, האימון נשמר בלבד";
  }

  const head =
    received === 0
      ? "איש לא קיבל את האימון"
      : received === 1
        ? "האימון נשלח למתאמן אחד"
        : `האימון נשלח ל-${received} מתאמנים`;

  return skipped.length === 0 ? head : `${head}. דילוג: ${skipped.join(", ")}`;
}
