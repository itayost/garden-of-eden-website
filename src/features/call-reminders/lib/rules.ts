import { normalizePhoneIL } from "@/lib/validations/common";

/** A reminder is due this long after the tap (Eden: 10 minutes). */
export const CALL_REMINDER_DELAY_MS = 10 * 60 * 1000;

/** Attempts older than this never remind: a week-old nag helps nobody. */
export const CALL_REMINDER_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** How often an open admin page asks for due reminders. */
export const CALL_REMINDER_POLL_MS = 60 * 1000;

/** Whom the trainer called: a lead, or a retention customer by phone (E.164). */
export type CallTarget =
  | { readonly kind: "lead"; readonly leadId: string }
  | { readonly kind: "retention"; readonly reportMonth: string; readonly phone: string };

export interface AttemptRow {
  readonly id: string;
  readonly target: CallTarget;
  readonly contactName: string;
  readonly startedAt: string;
  readonly dismissedAt: string | null;
}

/** A log entry by the calling trainer, keyed like its attempt. */
export interface DocumentationRow {
  readonly targetKey: string;
  readonly createdAt: string;
}

export interface DueReminder {
  readonly attemptId: string;
  readonly target: CallTarget;
  readonly contactName: string;
  readonly startedAt: string;
}

export interface ReminderState {
  readonly due: readonly DueReminder[];
  readonly nextDueAt: string | null;
}

/** One key per person. A retention customer is the same person in every month. */
export function targetKey(target: CallTarget): string {
  return target.kind === "lead" ? `lead:${target.leadId}` : `retention:${target.phone}`;
}

/** `tel:` link for the trainer's dialer, or null when the phone cannot be read. */
export function telHref(phone: string | null | undefined): string | null {
  const e164 = normalizePhoneIL(phone);
  return e164 ? `tel:${e164}` : null;
}

function isDocumented(attempt: AttemptRow, docs: readonly DocumentationRow[]): boolean {
  const key = targetKey(attempt.target);
  const startedMs = Date.parse(attempt.startedAt);
  return docs.some((d) => d.targetKey === key && Date.parse(d.createdAt) >= startedMs);
}

/** Open attempts (inside the window, not dismissed, not documented), earliest per person. */
function earliestOpenPerPerson(
  attempts: readonly AttemptRow[],
  docs: readonly DocumentationRow[],
  nowMs: number,
): readonly AttemptRow[] {
  const open = attempts.filter(
    (a) =>
      a.dismissedAt === null &&
      nowMs - Date.parse(a.startedAt) <= CALL_REMINDER_WINDOW_MS &&
      !isDocumented(a, docs),
  );
  const byPerson = open.reduce<ReadonlyMap<string, AttemptRow>>((acc, a) => {
    const key = targetKey(a.target);
    const current = acc.get(key);
    if (current && Date.parse(current.startedAt) <= Date.parse(a.startedAt)) return acc;
    return new Map(acc).set(key, a);
  }, new Map());
  return [...byPerson.values()].sort(
    (x, y) => Date.parse(x.startedAt) - Date.parse(y.startedAt),
  );
}

/** What the calling trainer should be reminded of now, and when the next one falls due. */
export function reminderState(
  attempts: readonly AttemptRow[],
  docs: readonly DocumentationRow[],
  nowMs: number,
): ReminderState {
  const open = earliestOpenPerPerson(attempts, docs, nowMs);
  const dueAt = (a: AttemptRow) => Date.parse(a.startedAt) + CALL_REMINDER_DELAY_MS;
  const due = open
    .filter((a) => dueAt(a) <= nowMs)
    .map((a) => ({
      attemptId: a.id,
      target: a.target,
      contactName: a.contactName,
      startedAt: a.startedAt,
    }));
  const upcoming = open.map(dueAt).filter((ms) => ms > nowMs);
  const nextDueAt = upcoming.length > 0 ? new Date(Math.min(...upcoming)).toISOString() : null;
  return { due, nextDueAt };
}

/** The attempt a repeat tap should reuse, so tapping again cannot postpone the reminder. */
export function openAttemptFor(
  attempts: readonly AttemptRow[],
  docs: readonly DocumentationRow[],
  target: CallTarget,
  nowMs: number,
): AttemptRow | null {
  const key = targetKey(target);
  return earliestOpenPerPerson(attempts, docs, nowMs).find((a) => targetKey(a.target) === key) ?? null;
}
