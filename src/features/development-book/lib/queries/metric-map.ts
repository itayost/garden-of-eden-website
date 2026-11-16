/**
 * What the Admin map editor (`/admin/book/metrics`) reads, through the
 * service role: every Development book parameter with its category name,
 * positions and drill count, and every pair of the metric-to-book map. A
 * failed read throws with the table's name.
 */
import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";
import { readAllPages } from "@/lib/supabase/in-chunks";
import { drillName } from "../drill-candidates";
import { byBookOrder, metricMapRows, type MapParameter, type MetricMapRow } from "../metric-map";
import { POSITION_GROUPS } from "../positions";

type Db = ReturnType<typeof createAdminClient>;

/** The rows of a finished read, or a logged and thrown failure naming the table. */
function must<T>(table: string, result: { data: T; error: { message: string } | null }): T {
  if (result.error) {
    console.error(`[development-book] ${table} read failed:`, result.error.message);
    throw new Error(`Development book: ${table} read failed`);
  }
  return result.data;
}

/** The positions the drill rules know; anything else never makes a parameter visible. */
const CANONICAL_POSITIONS: ReadonlySet<string> = new Set(POSITION_GROUPS.flatMap((group) => group.positions));

/** How many times each key appears. */
function countBy(keys: readonly string[]): Map<string, number> {
  return keys.reduce((counts, key) => counts.set(key, (counts.get(key) ?? 0) + 1), new Map<string, number>());
}

async function readMapTables(db: Db) {
  const [categories, parameters, positions, drills, pairs] = await Promise.all([
    readAllPages(() => db.from("book_categories").select("id, name_he, order_index").order("id")),
    readAllPages(() =>
      db.from("book_parameters").select("id, category_id, name_he, order_index, is_all_positions").order("id"),
    ),
    readAllPages(() =>
      db.from("book_parameter_positions").select("parameter_id, position").order("parameter_id").order("position"),
    ),
    readAllPages(() => db.from("book_drills").select("id, parameter_id, name_he, name_en").order("id")),
    readAllPages(() =>
      db.from("book_parameter_metrics").select("parameter_id, metric_key").order("parameter_id").order("metric_key"),
    ),
  ]);
  return {
    categories: must("book_categories", categories),
    parameters: must("book_parameters", parameters),
    positions: must("book_parameter_positions", positions),
    drills: must("book_drills", drills),
    pairs: must("book_parameter_metrics", pairs),
  };
}

/**
 * One row per Goal metric with its mapped parameters, and every parameter in
 * the book's order for the "הוספת פרמטר" list. A drill counts only when it
 * has a name, as the drill rules offer only those.
 */
export async function loadMetricMapView(db: Db): Promise<{ rows: MetricMapRow[]; parameters: MapParameter[] }> {
  const tables = await readMapTables(db);
  const categories = new Map(tables.categories.map((row) => [row.id, row]));
  const drillCounts = countBy(
    tables.drills.filter((row) => drillName(row.name_he, row.name_en) !== null).map((row) => row.parameter_id),
  );
  const parameters = tables.parameters
    .map((row): MapParameter => {
      const category = categories.get(row.category_id);
      return {
        id: row.id,
        nameHe: row.name_he,
        categoryName: category?.name_he ?? "",
        order: (category?.order_index ?? 0) * 1000 + row.order_index,
        isAllPositions: row.is_all_positions,
        positions: tables.positions
          .filter((position) => position.parameter_id === row.id && CANONICAL_POSITIONS.has(position.position))
          .map((position) => position.position),
        drillCount: drillCounts.get(row.id) ?? 0,
      };
    })
    .sort(byBookOrder);
  const pairs = tables.pairs.map((row) => ({ parameterId: row.parameter_id, metricKey: row.metric_key }));
  return { rows: metricMapRows(parameters, pairs), parameters };
}
