"use server";

import { createClient } from "@/lib/supabase/server";
import type { PlayerGoalRow } from "@/types/database";

/**
 * Get all goals for a player
 */
export async function getPlayerGoals(
  userId: string,
  options?: { includeAchieved?: boolean }
): Promise<PlayerGoalRow[]> {
  const supabase = await createClient();

  let query = supabase
    .from("player_goals")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (!options?.includeAchieved) {
    query = query.is("achieved_at", null);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching goals:", error);
    return [];
  }

  return (data || []) as PlayerGoalRow[];
}

/**
 * Get active goals for the current user (for dashboard)
 */
export async function getMyActiveGoals(): Promise<PlayerGoalRow[]> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  return getPlayerGoals(user.id, { includeAchieved: false });
}
