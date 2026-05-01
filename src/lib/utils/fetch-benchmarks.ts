import type { SupabaseClient } from "@supabase/supabase-js";
import type { GroupStats } from "@/lib/assessment-to-rating";
import { NUMERIC_METRIC_KEYS, type NumericMetricKey } from "./assessment-metrics";

interface BenchmarkRow {
  age_group: string;
  player_count: number;
  [key: string]: string | number | null;
}

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
    .select("age_group, player_count, " +
      "sprint_5m_best, sprint_5m_worst, sprint_10m_best, sprint_10m_worst, " +
      "sprint_20m_best, sprint_20m_worst, jump_2leg_distance_best, jump_2leg_distance_worst, " +
      "jump_right_leg_best, jump_right_leg_worst, jump_left_leg_best, jump_left_leg_worst, " +
      "jump_2leg_height_best, jump_2leg_height_worst, blaze_spot_time_best, blaze_spot_time_worst, " +
      "flexibility_ankle_best, flexibility_ankle_worst, flexibility_knee_best, flexibility_knee_worst, " +
      "flexibility_hip_best, flexibility_hip_worst, kick_power_kaiser_best, kick_power_kaiser_worst, " +
      "kick_power_right_foot_best, kick_power_right_foot_worst, kick_power_left_foot_best, kick_power_left_foot_worst"
    )
    .eq("age_group", ageGroupId)
    .single();

  if (error || !data) return null;

  const row = data as unknown as BenchmarkRow;

  // Need at least 2 players for meaningful comparison
  if (row.player_count < 2) return null;

  // Map DB columns to GroupStats interface
  // NULL DB values -> -1 sentinel (matching existing convention in calculateGroupStats)
  const toNum = (val: string | number | null): number =>
    val !== null && val !== undefined ? Number(val) : -1;

  const stats = {} as Record<NumericMetricKey, { best: number; worst: number }>;

  for (const key of NUMERIC_METRIC_KEYS) {
    stats[key] = {
      best: toNum(row[`${key}_best`]),
      worst: toNum(row[`${key}_worst`]),
    };
  }

  return stats as GroupStats;
}
