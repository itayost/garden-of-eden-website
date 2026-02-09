"use server";

import { verifyUserAccess } from "@/lib/actions/shared/verify-user-access";
import type { UserStreak } from "../../types";

/**
 * Get user's streak data from database
 * Returns null if no streak record exists
 * Authorization: User can only access their own streak, trainers/admins can access any
 */
export async function getUserStreak(userId: string): Promise<UserStreak | null> {
  const { authorized, supabase } = await verifyUserAccess(userId);
  if (!authorized) {
    return null;
  }

  const { data, error } = await supabase
    .from("user_streaks")
    .select("*")
    .eq("user_id", userId)
    .single();

  if (error) {
    // PGRST116 = no rows found, which is expected for new users
    if (error.code !== "PGRST116") {
      console.error("Error fetching streak:", error);
    }
    return null;
  }

  return data as UserStreak;
}
