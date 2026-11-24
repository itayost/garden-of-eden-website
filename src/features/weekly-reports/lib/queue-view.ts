/**
 * The approval queue's words and choices: which tab a row is in, the counts
 * line, the status chips, the parent outcome, "נוספו נתונים", and the week and
 * tab the URL asks for. Pure: the loaders and the page put them together.
 */
import { isValidDateString } from "@/lib/validations/common";
import { skipLabel } from "./delivery";
import { reportWeekStart } from "./report-week";

/**
 * "proposals" is the Goal proposals (הצעות יעד): open proposals of every
 * Assessment, not of the week, and never a report's tab (`tabOf`).
 */
export type QueueTab = "held" | "pending" | "approved" | "sent" | "missed_you" | "absent" | "proposals";

export type TabCounts = Record<QueueTab, number>;

/** The tabs in the order the page shows them: what needs a person first, the Goal proposals last. */
export const QUEUE_TABS: readonly { tab: QueueTab; label: string }[] = [
  { tab: "held", label: "מעוכבים" },
  { tab: "pending", label: "ממתינים לאישור" },
  { tab: "approved", label: "אושרו" },
  { tab: "sent", label: "נשלחו" },
  { tab: "missed_you", label: "התגעגענו" },
  { tab: "absent", label: "לא הגיעו 3 שבועות" },
  { tab: "proposals", label: "הצעות יעד" },
];

const REPORT_TABS: Readonly<Record<string, QueueTab>> = {
  held: "held",
  pending: "pending",
  approved: "approved",
  sent: "sent",
  not_sent: "sent",
};

/**
 * A report is in the tab of its status ("נשלחו" holds the sent and the not
 * sent); "התגעגענו" and the absent list have their own tabs whatever their
 * status. Null for a kind or status the queue does not know.
 */
export function tabOf(kind: string, status: string): QueueTab | null {
  if (kind === "missed_you") return "missed_you";
  if (kind === "absent") return "absent";
  if (kind !== "report") return null;
  return Object.hasOwn(REPORT_TABS, status) ? REPORT_TABS[status] : null;
}

export function tabCounts(tabs: readonly QueueTab[]): TabCounts {
  const zero: TabCounts = { held: 0, pending: 0, approved: 0, sent: 0, missed_you: 0, absent: 0, proposals: 0 };
  return tabs.reduce((counts, tab) => ({ ...counts, [tab]: counts[tab] + 1 }), zero);
}

function isTab(value: string | undefined): value is QueueTab {
  return QUEUE_TABS.some((t) => t.tab === value);
}

/** The requested tab, else the first that has rows, else מעוכבים. */
export function pickTab(requested: string | undefined, counts: TabCounts): QueueTab {
  if (isTab(requested)) return requested;
  return QUEUE_TABS.find((t) => counts[t.tab] > 0)?.tab ?? "held";
}

/**
 * The list's filters: לטיפול holds the held and the pending together, the
 * held first, so one list is the morning's work; the others are one tab each.
 */
export type QueueFilter = "todo" | "approved" | "sent" | "missed_you" | "absent" | "proposals";

export const QUEUE_FILTERS: readonly { filter: QueueFilter; label: string; tabs: readonly QueueTab[] }[] = [
  { filter: "todo", label: "לטיפול", tabs: ["held", "pending"] },
  { filter: "approved", label: "אושרו", tabs: ["approved"] },
  { filter: "sent", label: "נשלחו", tabs: ["sent"] },
  { filter: "missed_you", label: "התגעגענו", tabs: ["missed_you"] },
  { filter: "absent", label: "לא הגיעו 3 שבועות", tabs: ["absent"] },
  { filter: "proposals", label: "הצעות יעד", tabs: ["proposals"] },
];

function tabsOf(filter: QueueFilter): readonly QueueTab[] {
  return QUEUE_FILTERS.find((f) => f.filter === filter)?.tabs ?? [];
}

export function filterCount(filter: QueueFilter, counts: TabCounts): number {
  return tabsOf(filter).reduce((sum, tab) => sum + counts[tab], 0);
}

/** The requested filter (an old held or pending link is לטיפול), else the first with rows, else לטיפול. */
export function pickFilter(requested: string | undefined, counts: TabCounts): QueueFilter {
  if (requested === "held" || requested === "pending") return "todo";
  const asked = QUEUE_FILTERS.find((f) => f.filter === requested);
  if (asked) return asked.filter;
  return QUEUE_FILTERS.find((f) => filterCount(f.filter, counts) > 0)?.filter ?? "todo";
}

/** The rows of a filter, in the order of its tabs (held before pending), each tab in its own order. */
export function filterRows<T extends { tab: QueueTab }>(rows: readonly T[], filter: QueueFilter): T[] {
  return tabsOf(filter).flatMap((tab) => rows.filter((row) => row.tab === tab));
}

/** The row after the open one, the first when the open one is not listed, none after the last. */
export function nextReportId(rows: readonly { id: string }[], currentId: string): string | null {
  const at = rows.findIndex((row) => row.id === currentId);
  if (at === -1) return rows[0]?.id ?? null;
  return rows[at + 1]?.id ?? null;
}

const PREVIEW_LENGTH = 90;

/** The start of a text on one line, the name filled in, cut at a word; none before it is written. */
export function textPreview(text: string | null, firstName: string): string | null {
  const flat = text?.replaceAll("{שם}", firstName).replace(/\s+/g, " ").trim() ?? "";
  if (flat === "") return null;
  if (flat.length <= PREVIEW_LENGTH) return flat;
  const cut = flat.slice(0, PREVIEW_LENGTH);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 0 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

const COUNT_WORDS: readonly { tab: QueueTab; one: string; many: string }[] = [
  { tab: "pending", one: "ממתין", many: "ממתינים" },
  { tab: "held", one: "מעוכב", many: "מעוכבים" },
  { tab: "approved", one: "אושר", many: "אושרו" },
  { tab: "sent", one: "נשלח", many: "נשלחו" },
];

/** "12 ממתינים · 3 מעוכבים · 40 נשלחו": the week's reports, zeros left out. */
export function countsLine(counts: TabCounts): string {
  const parts = COUNT_WORDS.filter((w) => counts[w.tab] > 0).map(
    (w) => `${counts[w.tab]} ${counts[w.tab] === 1 ? w.one : w.many}`,
  );
  return parts.length > 0 ? parts.join(" · ") : "אין דוחות בשבוע הזה";
}

const STATUS_LABELS: Readonly<Record<string, string>> = {
  pending: "ממתין לאישור",
  held: "מעוכב",
  approved: "אושר",
  sent: "נשלח",
  not_sent: "לא נשלח",
  listed: "לא הגיע 3 שבועות",
};

export function statusLabel(status: string): string {
  return Object.hasOwn(STATUS_LABELS, status) ? STATUS_LABELS[status] : status;
}

/** What happened to the parent's message of a sent row, or null when nothing is known. */
export function parentOutcome(row: {
  status: string;
  parentMessageId: string | null;
  parentSkipReason: string | null;
}): string | null {
  if (row.status !== "sent") return null;
  if (row.parentMessageId) return "נשלח להורה";
  return skipLabel(row.parentSkipReason);
}

/**
 * "נוספו נתונים": a Shift report, Quick tag or note for the Trainee arrived
 * after the text was written. Compares instants, so offsets do not matter.
 */
export function hasNewData(writtenAt: string | null, eventTimes: readonly string[]): boolean {
  if (writtenAt === null) return false;
  const written = Date.parse(writtenAt);
  return eventTimes.some((at) => Date.parse(at) > written);
}

/** Words split by any whitespace: the count the guardrails hold on. */
export function wordCount(text: string): number {
  return text.split(/\s+/).filter((word) => word !== "").length;
}

/** The week picker's choices: the weeks with rows and the current week, newest first. */
export function weekChoices(stored: readonly string[], current: string): string[] {
  return [...new Set([current, ...stored])].sort((a, b) => b.localeCompare(a));
}

/** A requested Report week (its Friday), else the current one. */
export function pickWeek(requested: string | undefined, current: string): string {
  if (requested && isValidDateString(requested) && reportWeekStart(requested) === requested) return requested;
  return current;
}

export interface QueueLocation {
  week: string;
  branch?: string;
  tab?: QueueFilter;
  report?: string;
}

/** The queue page's URL for a week, branch, tab and open report. */
export function queueHref(location: QueueLocation): string {
  const query = new URLSearchParams({ week: location.week });
  if (location.branch) query.set("branch", location.branch);
  if (location.tab) query.set("tab", location.tab);
  if (location.report) query.set("report", location.report);
  return `/admin/weekly-reports?${query.toString()}`;
}
