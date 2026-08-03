/**
 * Trainer tasks (משימות למאמנים) and daily briefs (בריף יומי).
 *
 * A task is an operational unit of work an admin assigns to exactly one
 * trainer. It is staff work, NOT training content — workout programs and book
 * drills cover content assigned to trainees.
 *
 * Neither table is in the generated Supabase types, so reads go through
 * `typedFrom()` and these interfaces are the source of truth.
 */

// =============================================================================
// Enum tuples (single source of truth for runtime + types)
// =============================================================================

export const TRAINER_TASK_STATUSES = ["open", "done", "cancelled"] as const;

export type TrainerTaskStatus = (typeof TRAINER_TASK_STATUSES)[number];

// =============================================================================
// Shared constants
// =============================================================================

/** PostgREST select string for a task with its assignee and linked trainee joined. */
export const TASK_SELECT_WITH_RELATIONS =
  "*, assignee:profiles!trainer_tasks_assigned_to_fkey(id, full_name), trainee:profiles!trainer_tasks_trainee_id_fkey(id, full_name)";

/** Sentinel for the "no linked trainee" option in trainee pickers and filters. */
export const TASK_NO_TRAINEE_VALUE = "__none__";

// =============================================================================
// Table interfaces
// =============================================================================

export interface TrainerTask {
  id: string;
  title: string;
  description: string | null;
  /** The trainer who must do this. Exactly one, never null. */
  assigned_to: string;
  assignee?: { id: string; full_name: string | null } | null;
  /**
   * Context tag only. Does not grant the trainee access and does not establish
   * a trainer-trainee relationship.
   */
  trainee_id: string | null;
  trainee?: { id: string; full_name: string | null } | null;
  /** ISO YYYY-MM-DD. Compared as a string against the Israel calendar date. */
  due_date: string;
  status: TrainerTaskStatus;
  created_by: string;
  created_by_name: string;
  completion_note: string | null;
  completed_at: string | null;
  completed_by: string | null;
  reopen_reason: string | null;
  /** NULL on a done task means the admin has not reviewed it yet. */
  admin_seen_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DailyBrief {
  id: string;
  /** ISO YYYY-MM-DD. Unique — one brief per calendar day, globally. */
  brief_date: string;
  content: string;
  /** The admin who first wrote this day's brief. Never changes on edit. */
  author_id: string;
  author_name: string;
  /** The admin who last edited it. Equals the author until someone else edits. */
  updated_by_id: string | null;
  updated_by_name: string | null;
  created_at: string;
  updated_at: string;
}

/** Derived counts that drive the nav badge and the admin review section. */
export interface TaskCounts {
  open: number;
  overdue: number;
  awaitingReview: number;
}

// =============================================================================
// Hebrew label maps
// =============================================================================

export const TRAINER_TASK_STATUS_LABELS: Record<TrainerTaskStatus, string> = {
  open: "פתוחה",
  done: "בוצעה",
  cancelled: "בוטלה",
};

export const TRAINER_TASK_STATUS_COLORS: Record<TrainerTaskStatus, string> = {
  open: "bg-blue-100 text-blue-800",
  done: "bg-green-100 text-green-800",
  cancelled: "bg-gray-100 text-gray-700",
};
