/**
 * What a slot's group workout does to each roster member, as one pure
 * decision.
 *
 * A trainee cannot see or log a workout that has no training_sessions row of
 * their own, so saving a group workout writes one session per roster member.
 * Three things must never be overwritten by that: a session a trainer built
 * for this trainee individually, a session the trainee already completed, and
 * a session another slot wrote the same day (training_sessions is UNIQUE on
 * trainee and date, so there is only one to go round).
 *
 * The apply_slot_workout_to_trainee Postgres function implements exactly these
 * outcomes with these names. This module is where they are pinned down and
 * tested, and where the Hebrew summary is built.
 */

export type FanoutAction =
  | "create"
  | "refresh"
  | "skip_custom"
  | "skip_completed"
  | "skip_other_slot";

export interface FanoutCandidate {
  traineeId: string;
  traineeName: string;
}

/** The trainee's session for the slot's date, when they already have one. */
export interface ExistingSession {
  slotId: string | null;
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
 * whoever wrote it. Individual editing is checked before the slot, so a
 * session with no slot at all reads as individual work rather than as a clash
 * with some other slot.
 */
function decide(slotId: string, existing: ExistingSession | undefined): FanoutAction {
  if (!existing) return "create";
  if (existing.completedAt !== null) return "skip_completed";
  if (existing.slotWorkoutSyncedAt === null) return "skip_custom";
  if (existing.slotId !== slotId) return "skip_other_slot";
  return "refresh";
}

export function planSlotWorkoutFanout(
  slotId: string,
  candidates: readonly FanoutCandidate[],
  existing: Readonly<Record<string, ExistingSession>>,
): FanoutDecision[] {
  return candidates.map((candidate) => ({
    traineeId: candidate.traineeId,
    traineeName: candidate.traineeName,
    action: decide(slotId, existing[candidate.traineeId]),
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
  { action: "skip_other_slot", label: "עם אימון מסלוט אחר באותו יום" },
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
