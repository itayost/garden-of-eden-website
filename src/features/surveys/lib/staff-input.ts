import { publishProblem } from "./publish";
import { STAFF_MESSAGES } from "./staff-messages";
import type { SurveyDraft } from "./types";

/** Joins every problem that stops a publish, so the builder can list them all. */
export const PROBLEM_SEPARATOR = " · ";

/**
 * A form sends an empty close date as "", which the date schema would refuse:
 * it means no close date. Anything that is not an object passes through for
 * the schema to refuse.
 */
export function withBlankClosesOn(input: unknown): unknown {
  if (typeof input !== "object" || input === null) return input;
  const { closesOn } = input as { closesOn?: unknown };
  const isBlank = typeof closesOn === "string" && closesOn.trim() === "";
  return isBlank ? { ...input, closesOn: null } : input;
}

/**
 * Why a new close date is refused, or null. It must be no earlier than today
 * or the opening day, whichever is later. Days are Israel calendar dates in
 * YYYY-MM-DD form, so string comparison orders them.
 */
export function closeDateProblem(opensOn: string, closesOn: string | null, today: string): string | null {
  if (closesOn === null) return null;
  if (closesOn < today) return STAFF_MESSAGES.closeDatePassed;
  if (closesOn < opensOn) return STAFF_MESSAGES.closeBeforeOpen;
  return null;
}

/**
 * closeDateProblem for an edit of the details: the date is only judged when it
 * differs from the stored one. A Survey that ended by date keeps its past close
 * date, and its title or intro can still be changed without touching it.
 */
export function closeDateChangeProblem(
  opensOn: string,
  storedClosesOn: string | null,
  closesOn: string | null,
  today: string,
): string | null {
  if (closesOn === storedClosesOn) return null;
  return closeDateProblem(opensOn, closesOn, today);
}

/** What a save needs to know about the Survey it would overwrite. */
export interface StoredSurveyState {
  publishedAt: string | null;
  closedAt: string | null;
  responseCount: number;
}

/**
 * Why a draft may not be saved, or null. `stored` is the Survey being
 * overwritten, or null for a new one. A closed Survey stays as it is, and one
 * with Responses keeps its Questions and Audience. A published Survey is live,
 * so a save must leave it publishable: it never loses its Questions or gains a
 * blank option. A draft is looser, except that its close date may not precede
 * its open date (the database refuses that too, without saying why).
 */
export function saveRefusal(
  draft: SurveyDraft,
  stored: StoredSurveyState | null,
  today: string,
): string | null {
  if (stored !== null && stored.closedAt !== null) return STAFF_MESSAGES.alreadyClosed;
  if (stored !== null && stored.responseCount > 0) return STAFF_MESSAGES.hasResponses;
  if (draft.closesOn !== null && draft.closesOn < draft.opensOn) {
    return STAFF_MESSAGES.closeBeforeOpen;
  }
  if (stored === null || stored.publishedAt === null) return null;
  const problems = publishProblem(draft, today);
  return problems.length === 0 ? null : problems.join(PROBLEM_SEPARATOR);
}
