/**
 * Whether a staff member may approve a report, and why not. Pure.
 *
 * A `sensitive` or `manual` Hold does not refuse: a person opening the report
 * and approving it is the review. A text problem always refuses, so a number
 * the model made up can never be approved past.
 */

import type { HoldReason } from "./fact-sheet/types";
import { isTextProblem } from "./guardrails";

export interface ReportForApproval {
  kind: string;
  status: string;
  playerText: string | null;
  parentText: string | null;
  holdReasons: HoldReason[];
}

const STATUS_REFUSALS: Readonly<Record<string, string>> = {
  sent: "הדוח כבר נשלח",
  not_sent: "השבוע של הדוח נסגר",
  approved: "הדוח כבר אושר",
};

function blank(text: string | null): boolean {
  return text === null || text.trim() === "";
}

export function approveRefusal(report: ReportForApproval): string | null {
  if (report.kind === "absent") return "אין מה לאשר בשורה הזו";
  if (Object.hasOwn(STATUS_REFUSALS, report.status)) return STATUS_REFUSALS[report.status];
  if (blank(report.playerText) || blank(report.parentText)) return "אין עדיין טקסט לאישור";
  const problems = report.holdReasons.filter(isTextProblem);
  if (problems.length > 0) return `צריך לתקן לפני אישור: ${problems.map((p) => p.text).join(" · ")}`;
  return null;
}
