"use server";

import { createClient } from "@/lib/supabase/server";
import { verifyUserAccess } from "@/lib/actions/shared/verify-user-access";
import { isValidUUID } from "@/lib/validations/common";
import type { UserAchievementRow } from "@/types/database";
import type { AchievementWithDisplay } from "../../types";
import { enrichAchievement } from "../utils/achievement-utils";

/**
 * Get all achievements for a specific user
 * Authorization: User can only access their own achievements, trainers/admins can access any
 */
export async function getUserAchievements(
  userId: string
): Promise<AchievementWithDisplay[]> {
  if (!isValidUUID(userId)) return [];

  const { authorized, supabase } = await verifyUserAccess(userId);
  if (!authorized) {
    return [];
  }

  const { data, error } = await supabase
    .from("user_achievements")
    .select("*")
    .eq("user_id", userId)
    .order("unlocked_at", { ascending: false });

  if (error) {
    console.error("Error fetching achievements:", error);
    return [];
  }

  return (data as UserAchievementRow[]).map(enrichAchievement);
}

/**
 * Get achievements for the current logged-in user
 */
export async function getMyAchievements(): Promise<AchievementWithDisplay[]> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  return getUserAchievements(user.id);
}

/**
 * Get uncelebrated achievements for the current user
 */
export async function getUncelebratedAchievements(): Promise<AchievementWithDisplay[]> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return [];
  }

  const { data, error } = await supabase
    .from("user_achievements")
    .select("*")
    .eq("user_id", user.id)
    .eq("celebrated", false)
    .order("unlocked_at", { ascending: true });

  if (error) {
    console.error("Error fetching uncelebrated achievements:", error);
    return [];
  }

  return (data as UserAchievementRow[]).map(enrichAchievement);
}

/**
 * Mark achievement as celebrated
 */
export async function markAchievementCelebrated(
  achievementId: string
): Promise<boolean> {
  if (!isValidUUID(achievementId)) return false;

  const supabase = await createClient();

  // Verify user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.error("Unauthorized: No user logged in");
    return false;
  }

  // Only update achievements belonging to the current user
  const { error } = await supabase
    .from("user_achievements")
    .update({ celebrated: true })
    .eq("id", achievementId)
    .eq("user_id", user.id);

  if (error) {
    console.error("Error marking achievement celebrated:", error);
    return false;
  }

  return true;
}

/**
 * Mark multiple achievements as celebrated
 */
export async function markAchievementsCelebrated(
  achievementIds: string[]
): Promise<boolean> {
  if (achievementIds.length === 0) return true;
  if (achievementIds.some((id) => !isValidUUID(id))) return false;

  const supabase = await createClient();

  // Verify user is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.error("Unauthorized: No user logged in");
    return false;
  }

  // Only update achievements belonging to the current user
  const { error } = await supabase
    .from("user_achievements")
    .update({ celebrated: true })
    .eq("user_id", user.id)
    .in("id", achievementIds);

  if (error) {
    console.error("Error marking achievements celebrated:", error);
    return false;
  }

  return true;
}
