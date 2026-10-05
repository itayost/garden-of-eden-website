import type { PlanStart } from "./plan-queue";

/** dd/mm/yyyy, how the WhatsApp templates write a date. */
export function ddmmyyyy(iso: string): string {
  return iso.split("-").reverse().join("/");
}

/**
 * The {{4}} parameter of the plan-confirmed template, after "המסלול בתוקף
 * עד": the end date, and for a Plan waiting in the queue its start in
 * brackets, so the approved template needs no new version.
 */
export function validityText(start: PlanStart | null, endsOn: string): string {
  const end = ddmmyyyy(endsOn);
  if (start?.kind === "on") return `${end} (מתחיל ב-${ddmmyyyy(start.date)})`;
  if (start?.kind === "after_card") return `${end} (מתחיל בסיום הכרטיסייה הנוכחית)`;
  return end;
}

/** The success page's line about when the Plan starts. */
export function startSentence(start: PlanStart): string {
  switch (start.kind) {
    case "today":
      return "המסלול מתחיל היום.";
    case "on":
      return `המסלול מתחיל ב-${ddmmyyyy(start.date)}, אחרי המסלול הנוכחי.`;
    case "after_card":
      return `המסלול יתחיל בסיום הכרטיסייה הנוכחית, לכל המאוחר ב-${ddmmyyyy(start.latest)}.`;
  }
}
