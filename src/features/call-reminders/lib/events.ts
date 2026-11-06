/**
 * Window events that tell the reminder watcher to look again right away:
 * a call link just recorded an attempt, or a call was just documented.
 */
export const CALL_EVENTS = {
  started: "call-attempt-started",
  documented: "call-documented",
} as const;

export type CallEventName = (typeof CALL_EVENTS)[keyof typeof CALL_EVENTS];

export function emitCallEvent(name: CallEventName): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(name));
}
