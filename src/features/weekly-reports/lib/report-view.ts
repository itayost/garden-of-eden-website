/**
 * The words the parent page and the player's card put around a sent Weekly
 * report: the plan box, the body block's rows and each Goal's numbers. Pure.
 * Every number here comes from code (the Plan queue, the stored Fact sheet's
 * Goals, the measurement), never from the model.
 */

import { shortDate } from "@/lib/utils/iso-date";
import type { PlanStatus } from "@/types/plans";
import type { BodyFacts, GoalFact } from "./fact-sheet/types";

export interface PlanSummary {
  /** Sessions left on the whole queue; null when it holds no Card. */
  sessionsLeft: number | null;
  /** The queue's last day. */
  endsOn: string;
  status: PlanStatus;
}

export interface BodyRow {
  label: string;
  value: string;
  /** Against the previous measurement; null when there is none. */
  change: string | null;
}

const UNIT_KG = 'ק"ג';
const UNIT_CM = 'ס"מ';
const NO_CHANGE = "ללא שינוי";

/** Up to two decimals, without trailing zeros: 42.50 reads "42.5". */
function formatNumber(value: number): string {
  return String(Number(value.toFixed(2)) || 0);
}

function sessionsLine(sessionsLeft: number): string {
  if (sessionsLeft <= 0) return "לא נשארו אימונים בכרטיסייה";
  if (sessionsLeft === 1) return "נשאר אימון אחד בכרטיסייה";
  return `נשארו ${sessionsLeft} אימונים בכרטיסייה`;
}

/**
 * The plan box: the sessions left on a Card and the queue's end date. A queue
 * that ended says so, without its sessions, which can no longer be used.
 */
export function planBoxLines(plan: PlanSummary): string[] {
  if (plan.status === "expired" || plan.status === "cancelled") {
    return [`המסלול הסתיים ב-${shortDate(plan.endsOn)}`];
  }
  const sessions = plan.sessionsLeft === null ? [] : [sessionsLine(plan.sessionsLeft)];
  return [...sessions, `המסלול בתוקף עד ${shortDate(plan.endsOn)}`];
}

/** "+1.2", "-0.5", or "ללא שינוי" for a change that rounds to nothing. */
export function signedChange(value: number): string {
  const size = formatNumber(Math.abs(value));
  if (size === "0") return NO_CHANGE;
  return `${value > 0 ? "+" : "-"}${size}`;
}

function changeOf(value: number | null | undefined): string | null {
  return value === null || value === undefined ? null : signedChange(value);
}

/**
 * The measurement's rows, in the order the nutrition screens use, leaving out
 * what was not measured. The dietitian's note is shown apart, as written.
 */
export function bodyRows(body: BodyFacts): BodyRow[] {
  const rows: (BodyRow | null)[] = [
    body.weightKg === null
      ? null
      : { label: "משקל", value: `${formatNumber(body.weightKg)} ${UNIT_KG}`, change: changeOf(body.change?.weightKg) },
    body.heightCm === null
      ? null
      : { label: "גובה", value: `${formatNumber(body.heightCm)} ${UNIT_CM}`, change: changeOf(body.change?.heightCm) },
    body.bmi === null ? null : { label: "BMI", value: formatNumber(body.bmi), change: null },
    body.bmiPercentile === null
      ? null
      : { label: "אחוזון BMI", value: `${formatNumber(body.bmiPercentile)}%`, change: null },
    body.heightPercentile === null
      ? null
      : { label: "אחוזון גובה", value: `${formatNumber(body.heightPercentile)}%`, change: null },
  ];
  return rows.filter((row): row is BodyRow => row !== null);
}

/** "התחלה 2.3 · עכשיו 2.15 · יעד 2 שניות": what is known, the unit once. */
export function goalLine(goal: GoalFact): string {
  const parts = [
    goal.baseline === null ? null : `התחלה ${formatNumber(goal.baseline)}`,
    goal.current === null ? null : `עכשיו ${formatNumber(goal.current)}`,
    `יעד ${formatNumber(goal.target)}`,
  ].filter((part): part is string => part !== null);
  const unit = goal.unit.trim();
  return unit ? `${parts.join(" · ")} ${unit}` : parts.join(" · ");
}

/** Fetchers that open a shared link to draw its preview, by a part of their agent. */
const PREVIEW_AGENT_PARTS = [
  "facebookexternalhit",
  "facebot",
  "twitterbot",
  "telegrambot",
  "slackbot",
  "discordbot",
  "linkedinbot",
  "skypeuripreview",
  "googlebot",
  "bingbot",
  "applebot",
];

/**
 * Whether a request is a link preview rather than a person: WhatsApp fetches
 * the link to draw its card ("WhatsApp/2.x"; every browser's agent starts with
 * "Mozilla/"), and so do other apps a parent may forward it to. Such a request
 * still gets the page, but is not "the parent opened it". A request with no
 * agent is not counted either.
 */
export function isLinkPreviewAgent(userAgent: string | null): boolean {
  const agent = userAgent?.trim().toLowerCase() ?? "";
  if (agent === "" || agent.startsWith("whatsapp/")) return true;
  return PREVIEW_AGENT_PARTS.some((part) => agent.includes(part));
}
