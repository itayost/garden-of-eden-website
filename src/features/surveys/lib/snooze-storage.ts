/**
 * The "later" choice, kept in the browser. Every access is wrapped: storage can
 * be blocked, full or missing (private windows, cleared site data), and then the
 * popup simply returns on the next full page load, which is acceptable.
 */
import { snoozeKey } from "./offer";

export type SnoozeStorage = Pick<Storage, "getItem" | "setItem">;

/** The browser's localStorage, or null when it is missing or refuses access. */
export function browserStorage(): SnoozeStorage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** The Israel day stored for this Survey, or null when nothing is stored or storage fails. */
export function readSnooze(storage: SnoozeStorage | null, surveyId: string): string | null {
  try {
    return storage?.getItem(snoozeKey(surveyId)) ?? null;
  } catch {
    return null;
  }
}

/** Hides the Survey for the rest of `today`. A failing write is dropped. */
export function writeSnooze(storage: SnoozeStorage | null, surveyId: string, today: string): void {
  try {
    storage?.setItem(snoozeKey(surveyId), today);
  } catch {
    // Without storage the popup returns on the next full page load.
  }
}
