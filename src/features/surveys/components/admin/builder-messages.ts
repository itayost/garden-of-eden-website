import { PROBLEM_SEPARATOR } from "../../lib/staff-input";
import { STAFF_MESSAGES } from "../../lib/staff-messages";

/** What the person is told when a request to the server never comes back. */
export const REQUEST_FAILED = {
  save: STAFF_MESSAGES.failed,
  publish: "הפרסום נכשל. נסו שוב.",
  unpublish: "החזרה לטיוטה נכשלה. נסו שוב.",
} as const;

/** A refusal as a list: the server joins every publish problem into one text. */
export function splitProblems(message: string): string[] {
  return message.split(PROBLEM_SEPARATOR);
}
