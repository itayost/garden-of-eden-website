import type { SupabaseClient } from "@supabase/supabase-js";
import type { GroupStats } from "@/lib/assessment-to-rating";
import { COUNTED_METRIC_KEYS, NUMERIC_METRIC_KEYS } from "./assessment-metrics";

interface BenchmarkRow {
  age_group: string;
  player_count: number;
  [key: string]: string | number | null;
}

// One best/worst column pair per metric, so a new metric needs no edit here,
// plus a trainee count for the tests that need one (COUNTED_METRIC_KEYS).
const BENCHMARK_COLUMNS = [
  "age_group",
  "player_count",
  ...NUMERIC_METRIC_KEYS.flatMap((key) => [`${key}_best`, `${key}_worst`]),
  ...COUNTED_METRIC_KEYS.map((key) => `${key}_players`),
].join(", ");

/**
 * GroupStats from one age_group_benchmarks row, or null with fewer than 2
 * trainees in the group. A NULL best or worst becomes -1, which the rating
 * functions read as "no group data"; a missing count becomes 0.
 */
export function benchmarkRowToGroupStats(row: BenchmarkRow): GroupStats | null {
  if (row.player_count < 2) return null;

  const toNum = (val: string | number | null | undefined): number =>
    val !== null && val !== undefined ? Number(val) : -1;

  return Object.fromEntries(
    NUMERIC_METRIC_KEYS.map((key) => {
      const range = { best: toNum(row[`${key}_best`]), worst: toNum(row[`${key}_worst`]) };
      return [
        key,
        COUNTED_METRIC_KEYS.includes(key)
          ? { ...range, players: Number(row[`${key}_players`] ?? 0) }
          : range,
      ];
    }),
  ) as GroupStats;
}

/** Fetch pre-computed GroupStats for an age group from age_group_benchmarks. */
export async function fetchGroupStats(
  supabase: SupabaseClient,
  ageGroupId: string
): Promise<GroupStats | null> {
  const { data, error } = await supabase
    .from("age_group_benchmarks")
    .select(BENCHMARK_COLUMNS)
    .eq("age_group", ageGroupId)
    .single();

  if (error || !data) return null;

  return benchmarkRowToGroupStats(data as unknown as BenchmarkRow);
}
