/**
 * What the weekly report loaders share: the service-role client type and the
 * rule that a failed read throws with the table's name. A job that silently
 * writes half a report is worse than a job that stops and logs.
 */
import "server-only";

import type { createAdminClient } from "@/lib/supabase/admin";

export type Db = ReturnType<typeof createAdminClient>;

/** The rows of a finished read, or a logged and thrown failure naming the table. */
export function must<T>(table: string, result: { data: T; error: { message: string } | null }): T {
  if (result.error) {
    console.error(`[weekly-reports] ${table} read failed:`, result.error.message);
    throw new Error(`Weekly reports: ${table} read failed`);
  }
  return result.data;
}

/** The distinct values, in first-seen order. */
export function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

/** Items grouped by key, in their order. Builds a new map; the input is not touched. */
export function groupBy<T>(items: readonly T[], keyOf: (item: T) => string): Map<string, T[]> {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return groups;
}
