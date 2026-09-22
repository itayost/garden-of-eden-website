import { trainerNames } from "@/lib/utils/trainer-color";
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
  /** A trainer built this one individually, so group saves skip it. */
  isCustom: boolean;
}

export interface WorklistGroup {
  slotId: string;
  /** HH:MM. */
  startTime: string;
  /** Everyone coaching this hour, in order. */
  trainers: { id: string | null; name: string }[];
  locationHe: string | null;
  /** The slot carries a workout for everyone on it. */
  hasGroupWorkout: boolean;
  /** How many exercises that workout has; zero when there is none. */
  groupExerciseCount: number;
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
    trainerNames(a.trainers).localeCompare(trainerNames(b.trainers), "he")
  );
}

/**
 * A session belongs to a slot, so the summaries arrive keyed by slot first and
 * a trainee in two slots carries a separate status in each.
 */
export function buildSessionWorklist(
  slots: ScheduleSlot[],
  summaries: Record<string, Record<string, SessionSummary>>,
): WorklistGroup[] {
  return [...slots].sort(compareSlots).map((slot) => ({
    slotId: slot.id,
    startTime: slot.start_time.slice(0, 5),
    trainers: [...slot.trainers]
      .sort((x, y) => x.order_index - y.order_index)
      .map((trainer) => ({ id: trainer.trainer_id, name: trainer.trainer_name })),
    locationHe: slot.location_he,
    hasGroupWorkout: slot.workout_updated_at !== null,
    groupExerciseCount: slot.workout_exercises?.length ?? 0,
    rows: slot.trainees
      .filter(isLinkedActive)
      .sort((a, b) => a.order_index - b.order_index)
      .map((entry) => {
        const summary = summaries[slot.id]?.[entry.trainee_id];
        return {
          rosterEntryId: entry.id,
          traineeId: entry.trainee_id,
          traineeName: entry.trainee_name,
          status: statusOf(summary),
          exerciseCount: summary?.exerciseCount ?? 0,
          // Nothing built is not individual work: it is nothing yet, and the
          // next group save will fill it.
          isCustom: summary?.isCustom ?? false,
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
    // Mine if I am any of the hour's trainers, not only if I am its first.
    .filter(
      (group) =>
        !filters.mineOnly ||
        group.trainers.some((trainer) => trainer.id === filters.currentUserId),
    )
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
