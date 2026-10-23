"use server";

import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { assertTraineeInScope } from "@/lib/actions/shared/assert-trainee";
import { getBranchScopeAction } from "@/lib/actions/shared/branch-scope";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidUUID } from "@/lib/validations/common";
import { israelMinutesOfDay } from "@/lib/utils/israel-time";
import { israelToday } from "@/lib/utils/tasks";
import { loadAllBranches } from "@/features/branches/lib/memberships";
import {
  GUEST_SEARCH_MIN_LENGTH,
  groupGuestRows,
  toHistoryEntries,
  type GuestGroup,
  type HistoryEntry,
} from "@/lib/schedule/training-history";
import { loadGuestRows, loadTraineeHistoryRows } from "../queries";

type Result<T> = { success: true; data: T } | { success: false; error: string };

export interface TrainingHistory {
  entries: HistoryEntry[];
  /** Branch id to Hebrew name, for the rows' branch label. */
  branchNames: Record<string, string>;
}

export interface GuestSearchResult {
  groups: GuestGroup[];
  branchNames: Record<string, string>;
}

const israelNow = () => ({ date: israelToday(), minutes: israelMinutesOfDay(new Date()) });

async function branchNameMap(): Promise<Record<string, string>> {
  const branches = await loadAllBranches(createAdminClient());
  return Object.fromEntries(branches.map((b) => [b.id, b.name_he]));
}

/** Every calendar training of one trainee, newest first. Trainers see their branches' trainees only. */
export async function getTrainingHistoryAction(traineeId: string): Promise<Result<TrainingHistory>> {
  const { error } = await verifyAdminOrTrainer();
  if (error) return { success: false, error };
  if (!isValidUUID(traineeId)) return { success: false, error: "מזהה לא תקין" };
  const scopeError = await assertTraineeInScope(traineeId);
  if (scopeError) return { success: false, error: scopeError };

  const [rows, branchNames] = await Promise.all([
    loadTraineeHistoryRows(createAdminClient(), traineeId),
    branchNameMap(),
  ]);
  if (rows === null) return { success: false, error: "שגיאה בטעינת היסטוריית האימונים" };
  return { success: true, data: { entries: toHistoryEntries(rows, israelNow()), branchNames } };
}

/**
 * Names typed into a roster with no account, matching the query, with the
 * trainings each one did. A trainer sees Slots of their own branches only:
 * a typed name has no branch membership of its own.
 */
export async function searchCalendarGuestsAction(query: string): Promise<Result<GuestSearchResult>> {
  const { error } = await verifyAdminOrTrainer();
  if (error) return { success: false, error };
  const trimmed = typeof query === "string" ? query.trim() : "";
  if (trimmed.length < GUEST_SEARCH_MIN_LENGTH || trimmed.length > 100) {
    return { success: true, data: { groups: [], branchNames: {} } };
  }

  const scopeResult = await getBranchScopeAction();
  if ("error" in scopeResult) return { success: false, error: scopeResult.error };
  const { scope } = scopeResult.data;

  const [rows, branchNames] = await Promise.all([
    loadGuestRows(createAdminClient(), trimmed, scope.kind === "all" ? null : scope.ids),
    branchNameMap(),
  ]);
  if (rows === null) return { success: false, error: "שגיאה בחיפוש ביומן" };
  return { success: true, data: { groups: groupGuestRows(rows, israelNow()), branchNames } };
}
