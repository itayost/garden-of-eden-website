/**
 * The staff scope rule the approval queue and the Goal proposals share: a row
 * is shown when its own `branch_ids` meet the caller's branches (the loaders
 * filter on that in the query) and its Trainee is in one of the caller's
 * branches now (here). Every action checks both again, so a list never shows
 * a name that the caller could not act on.
 */
import "server-only";

import { loadBranchIdsByProfile } from "@/features/branches/lib/memberships";
import { unique, type Db } from "./read";

/**
 * The rows whose Trainee is in one of `scopeBranchIds` now, in their order.
 * Null is an Admin, who sees every row.
 */
export async function inTraineeScope<Row extends { trainee_id: string }>(
  db: Db,
  rows: Row[],
  scopeBranchIds: readonly string[] | null,
): Promise<Row[]> {
  if (scopeBranchIds === null) return rows;
  const memberships = await loadBranchIdsByProfile(db, unique(rows.map((row) => row.trainee_id)));
  return rows.filter((row) => (memberships.get(row.trainee_id) ?? []).some((id) => scopeBranchIds.includes(id)));
}
