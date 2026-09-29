import type { SupabaseClient } from "@supabase/supabase-js";
import type { GroupStats } from "@/lib/assessment-to-rating";
import { NUMERIC_METRIC_KEYS } from "./assessment-metrics";

interface BenchmarkRow {
  age_group: string;
  player_count: number;
  [key: string]: string | number | null;
}

// One best/worst column pair per metric, so a new metric needs no edit here.
const BENCHMARK_COLUMNS = [
  "age_group",
  "player_count",
  ...NUMERIC_METRIC_KEYS.flatMap((key) => [`${key}_best`, `${key}_worst`]),
].join(", ");

/**
 * Fetch pre-computed GroupStats from age_group_benchmarks table.
 * Returns null if fewer than 2 players in the age group (matching existing logic).
 */
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

  const row = data as unknown as BenchmarkRow;

  // Need at least 2 players for meaningful comparison
  if (row.player_count < 2) return null;

  // Map DB columns to GroupStats interface
  // NULL DB values -> -1 sentinel: the rating functions read it as "no group data"
  const toNum = (val: string | number | null): number =>
    val !== null && val !== undefined ? Number(val) : -1;

  const stats = {} as GroupStats;

  for (const key of NUMERIC_METRIC_KEYS) {
    stats[key] = {
      best: toNum(row[`${key}_best`]),
      worst: toNum(row[`${key}_worst`]),
    };
  }

  return stats;
}
