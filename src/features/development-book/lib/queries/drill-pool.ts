/**
 * The Development book as the drill rules read it, through the service role:
 * the whole pool (parameters with their positions, age rows and mapped
 * metrics, and their drills), the drills each Trainee marked done in a range
 * of Israel days, and drills by id with the one name rule.
 *
 * The Weekly report and the Goal proposals import this file; it imports
 * nothing from them, so the dependency runs one way. A failed read throws
 * with the table's name: a job that offers drills from half the book is worse
 * than one that stops and logs.
 */
import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";
import { readAllPages, readInChunks } from "@/lib/supabase/in-chunks";
import { israelDateStr } from "@/lib/utils/israel-time";
import { addDays } from "@/lib/utils/iso-date";
import { drillName, drillWhy, type DrillLine, type DrillPool, type PoolDrill } from "../drill-candidates";
import { POSITION_GROUPS } from "../positions";
import type { CanonicalPosition } from "../types";

type Db = ReturnType<typeof createAdminClient>;

/** The rows of a finished read, or a logged and thrown failure naming the table. */
function must<T>(table: string, result: { data: T; error: { message: string } | null }): T {
  if (result.error) {
    console.error(`[development-book] ${table} read failed:`, result.error.message);
    throw new Error(`Development book: ${table} read failed`);
  }
  return result.data;
}

const CANONICAL_POSITIONS: ReadonlySet<string> = new Set(POSITION_GROUPS.flatMap((group) => group.positions));

function isCanonicalPosition(value: string): value is CanonicalPosition {
  return CANONICAL_POSITIONS.has(value);
}

/** Values grouped by key, in their order; a fresh map, the input is not touched. */
function valuesByKey<T>(rows: readonly T[], keyOf: (row: T) => string, valueOf: (row: T) => string) {
  const groups = new Map<string, string[]>();
  for (const row of rows) groups.set(keyOf(row), [...(groups.get(keyOf(row)) ?? []), valueOf(row)]);
  return groups;
}

async function readPoolTables(db: Db) {
  const [categories, parameters, positions, ageRows, drills, metrics] = await Promise.all([
    readAllPages(() => db.from("book_categories").select("id, order_index").order("id")),
    readAllPages(() =>
      db.from("book_parameters").select("id, category_id, name_he, order_index, is_all_positions").order("id"),
    ),
    readAllPages(() =>
      db.from("book_parameter_positions").select("parameter_id, position").order("parameter_id").order("position"),
    ),
    readAllPages(() => db.from("book_age_rows").select("id, parameter_id, age_group").order("id")),
    readAllPages(() =>
      db.from("book_drills").select("id, parameter_id, name_he, name_en, why_he, order_index").order("id"),
    ),
    readAllPages(() =>
      db.from("book_parameter_metrics").select("parameter_id, metric_key").order("parameter_id").order("metric_key"),
    ),
  ]);
  return {
    categories: must("book_categories", categories),
    parameters: must("book_parameters", parameters),
    positions: must("book_parameter_positions", positions),
    ageRows: must("book_age_rows", ageRows),
    drills: must("book_drills", drills),
    metrics: must("book_parameter_metrics", metrics),
  };
}

/**
 * The whole book for the drill rules. A parameter's order is its category's
 * order, then its own; positions outside the book's canonical list are left
 * out; a drill with no name is left out, and its "למה" line is read through
 * `drillWhy`.
 */
export async function loadDrillPool(db: Db): Promise<DrillPool> {
  const tables = await readPoolTables(db);
  const categoryOrder = new Map(tables.categories.map((row) => [row.id, row.order_index]));
  const positions = valuesByKey(tables.positions, (row) => row.parameter_id, (row) => row.position);
  const ageGroups = valuesByKey(tables.ageRows, (row) => row.parameter_id, (row) => row.age_group);
  const metricKeys = valuesByKey(tables.metrics, (row) => row.parameter_id, (row) => row.metric_key);
  const parameters = tables.parameters.map((row) => ({
    id: row.id,
    nameHe: row.name_he,
    isAllPositions: row.is_all_positions,
    positions: (positions.get(row.id) ?? []).filter(isCanonicalPosition),
    ageGroups: ageGroups.get(row.id) ?? [],
    order: (categoryOrder.get(row.category_id) ?? 0) * 1000 + row.order_index,
    metricKeys: metricKeys.get(row.id) ?? [],
  }));
  const drills = tables.drills.flatMap((row): PoolDrill[] => {
    const name = drillName(row.name_he, row.name_en);
    return name === null
      ? []
      : [{ id: row.id, parameterId: row.parameter_id, name, why: drillWhy(row.why_he), order: row.order_index }];
  });
  return { parameters, drills };
}

/**
 * The drills each Trainee marked done from `fromDay` to `toDay`, Israel days,
 * by Trainee id. A Trainee with none is not in the map.
 */
export async function readDrillsDone(
  db: Db,
  traineeIds: readonly string[],
  fromDay: string,
  toDay: string,
): Promise<Map<string, Set<string>>> {
  if (traineeIds.length === 0) return new Map();
  const rows = must(
    "book_drill_progress",
    await readInChunks([...new Set(traineeIds)], "user_id", () =>
      db
        .from("book_drill_progress")
        .select("id, user_id, drill_id, completed_at")
        .gte("completed_at", `${addDays(fromDay, -1)}T00:00:00Z`)
        .lt("completed_at", `${addDays(toDay, 1)}T00:00:00Z`)
        .order("id"),
    ),
  );
  const kept = rows.filter((row) => {
    const day = israelDateStr(row.completed_at);
    return day >= fromDay && day <= toDay;
  });
  const done = valuesByKey(kept, (row) => row.user_id, (row) => row.drill_id);
  return new Map([...done].map(([traineeId, drillIds]) => [traineeId, new Set(drillIds)]));
}

/**
 * Drills by id, in the order of `ids`, each once, named by `drillName` with
 * the "למה" line through `drillWhy`. A drill that is gone or has no name is
 * left out.
 */
export async function readDrillsByIds(db: Db, ids: readonly string[]): Promise<DrillLine[]> {
  const wanted = [...new Set(ids)];
  if (wanted.length === 0) return [];
  const rows = must(
    "book_drills",
    await readInChunks(wanted, "id", () => db.from("book_drills").select("id, name_he, name_en, why_he").order("id")),
  );
  const byId = new Map(rows.map((row) => [row.id, row]));
  return wanted.flatMap((id): DrillLine[] => {
    const row = byId.get(id);
    const name = row ? drillName(row.name_he, row.name_en) : null;
    return row && name !== null ? [{ id, name, why: drillWhy(row.why_he) }] : [];
  });
}
