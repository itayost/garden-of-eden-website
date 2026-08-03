/**
 * Pure helpers for trainer tasks.
 *
 * Overdue and awaiting-review are DERIVED, never stored. There is no
 * notifications table — the admin's alerts are computed from the task rows
 * themselves. See docs/adr/0001-derived-task-notifications.md.
 */

import { israelDateStr } from "@/lib/utils/israel-time";
import type { TrainerTask } from "@/types/tasks";

/** The fields needed to decide whether a task is overdue. */
type OverdueInput = Pick<TrainerTask, "status" | "due_date">;

/** The fields needed to decide whether a task awaits admin review. */
type ReviewInput = Pick<TrainerTask, "status" | "admin_seen_at">;

/**
 * Today's calendar date in Israel, as an ISO YYYY-MM-DD string.
 *
 * The academy runs on Israel time while Vercel runs on UTC, so "today" must be
 * resolved in Israel or a task due today reads as overdue for the three hours
 * either side of midnight.
 */
export function israelToday(now: Date = new Date()): string {
  return israelDateStr(now);
}

/**
 * Formats an ISO YYYY-MM-DD date for display as DD/MM/YYYY.
 *
 * Deliberately not `formatDateShort`: that parses a date-only string as UTC
 * midnight and formats in the viewer's timezone, so on a UTC-negative device a
 * task due 03/08 renders as 02/08 while `isTaskOverdue` — which compares
 * against the Israel date — correctly calls it due today. The two must agree.
 */
export function formatDueDate(dueDate: string): string {
  const [year, month, day] = dueDate.split("-");
  return `${day}/${month}/${year}`;
}

/**
 * A task is overdue when it is still open and its due date has passed.
 *
 * Both values are ISO YYYY-MM-DD strings, so this is a lexicographic compare
 * with no Date parsing — which is exactly what keeps it timezone-safe. Pass
 * `today` from `israelToday()`.
 */
export function isTaskOverdue(task: OverdueInput, today: string): boolean {
  return task.status === "open" && task.due_date < today;
}

/**
 * A closed task awaits review until the admin explicitly acknowledges it.
 *
 * Acknowledgement is deliberately not automatic on page view: the point of the
 * alert is that the admin actually reviews the work and can reopen it.
 */
export function isAwaitingReview(task: ReviewInput): boolean {
  return task.status === "done" && task.admin_seen_at === null;
}

// The badge counts are produced by three `head: true` count queries in
// getTaskCountsAction rather than reduced in JS, so the layout never pulls the
// whole task table. isTaskOverdue / isAwaitingReview above still back the
// client-side lists in TasksReviewSection, which already has the rows loaded.
