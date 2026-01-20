"use server";

import { createClient } from "@/lib/supabase/server";
import type { PlayerGoalRow, Profile } from "@/types/database";

/**
 * Get all goals for a player
 * Authorization: User can only access their own goals, trainers/admins can access any
 */
export async function getPlayerGoals(
  userId: string,
  options?: { includeAchieved?: boolean }
): Promise<PlayerGoalRow[]> {
  const supabase = await createClient();

  // Verify caller is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return [];
  }

  // Check authorization: user can access their own goals, or trainer/admin can access any
  if (user.id !== userId) {
    const { data: profile } = (await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()) as { data: Pick<Profile, "role"> | null };

    if (!profile || !["trainer", "admin"].includes(profile.role)) {
      console.error("Unauthorized access to goals data");
      return [];
    }
  }

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
