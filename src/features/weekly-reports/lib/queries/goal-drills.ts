/**
 * The drills of the accepted Goal proposal behind each Goal, which the Fact
 * sheet puts first for that Goal (`sheetDrills`).
 *
 * It lives in the Weekly report and reads `goal_proposals` directly, so the
 * dependency between the two features runs one way: the Goal proposals import
 * the Weekly report, never the reverse.
 */
import "server-only";

import { readInChunks } from "@/lib/supabase/in-chunks";
import { type Db, must, unique } from "./read";

/** The statuses of an accepted proposal: as made, or with a target staff typed. */
const ACCEPTED_STATUSES = ["accepted", "changed"] as const;

/**
 * Goal id to the `drill_ids` of the accepted proposal that wrote it. A Goal
 * set by hand is not in the map. Accepting inserts a new Goal, so one
 * proposal stands behind a Goal; were there two, the first by id wins, so a
 * rebuilt sheet gets the same drills.
 */
export async function readGoalDrills(db: Db, goalIds: readonly string[]): Promise<Map<string, string[]>> {
  const ids = unique(goalIds);
  if (ids.length === 0) return new Map();
  const rows = must(
    "goal_proposals",
    await readInChunks(ids, "goal_id", () =>
      db.from("goal_proposals").select("id, goal_id, drill_ids").in("status", [...ACCEPTED_STATUSES]).order("id"),
    ),
  );
  // Newest id first, so the later entry a Map keeps is the first by id.
  const lastIdFirst = [...rows].sort((a, b) => (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
  return new Map(
    lastIdFirst.flatMap((row): [string, string[]][] =>
      row.goal_id === null ? [] : [[row.goal_id, [...row.drill_ids]]],
    ),
  );
}
