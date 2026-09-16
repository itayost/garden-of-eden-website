import type { ScheduleSlot, SlotTrainee } from "@/types/schedule";
import type { SessionSummary } from "@/types/training-session";

/**
 * The session-building list: every active, linked roster entry for one day,
 * grouped by slot, with whether that trainee's session is built.
 *
 * Free-text roster names have no account and cannot receive a session, and a
 * cancelled entry is not coming, so neither is work for a trainer.
 */

export type WorklistStatus = "not_built" | "built" | "completed";

export interface WorklistRow {
  rosterEntryId: string;
  traineeId: string;
  traineeName: string;
  status: WorklistStatus;
  exerciseCount: number;
}

export interface WorklistGroup {
  slotId: string;
  /** HH:MM. */
  startTime: string;
  trainerId: string | null;
  trainerName: string | null;
  locationHe: string | null;
  rows: WorklistRow[];
}

export interface WorklistFilters {
  mineOnly: boolean;
  pendingOnly: boolean;
  currentUserId: string;
}

type LinkedEntry = SlotTrainee & { trainee_id: string };

function isLinkedActive(entry: SlotTrainee): entry is LinkedEntry {
  return entry.trainee_id !== null && entry.cancelled_at === null;
}

function statusOf(summary: SessionSummary | undefined): WorklistStatus {
  if (!summary) return "not_built";
  return summary.completed_at ? "completed" : "built";
}

function compareSlots(a: ScheduleSlot, b: ScheduleSlot): number {
  return (
    a.start_time.localeCompare(b.start_time) ||
    (a.trainer_name ?? "").localeCompare(b.trainer_name ?? "", "he")
  );
}

/** Sessions are per trainee per day, so a trainee in two slots shares one status. */
export function buildSessionWorklist(
  slots: ScheduleSlot[],
  summaries: Record<string, SessionSummary>,
): WorklistGroup[] {
  return [...slots].sort(compareSlots).map((slot) => ({
    slotId: slot.id,
    startTime: slot.start_time.slice(0, 5),
    trainerId: slot.trainer_id,
    trainerName: slot.trainer_name,
    locationHe: slot.location_he,
    rows: slot.trainees
      .filter(isLinkedActive)
      .sort((a, b) => a.order_index - b.order_index)
      .map((entry) => {
        const summary = summaries[entry.trainee_id];
        return {
          rosterEntryId: entry.id,
          traineeId: entry.trainee_id,
          traineeName: entry.trainee_name,
          status: statusOf(summary),
          exerciseCount: summary?.exerciseCount ?? 0,
        };
      }),
  }));
}

/** Groups left with no rows are dropped: an empty slot is not work to do. */
export function filterWorklist(
  groups: WorklistGroup[],
  filters: WorklistFilters,
): WorklistGroup[] {
  return groups
    .filter((group) => !filters.mineOnly || group.trainerId === filters.currentUserId)
    .map((group) => ({
      ...group,
      rows: filters.pendingOnly
        ? group.rows.filter((row) => row.status === "not_built")
        : group.rows,
    }))
    .filter((group) => group.rows.length > 0);
}

export function worklistProgress(groups: WorklistGroup[]): { built: number; total: number } {
  const rows = groups.flatMap((group) => group.rows);
  return {
    built: rows.filter((row) => row.status !== "not_built").length,
    total: rows.length,
  };
}
