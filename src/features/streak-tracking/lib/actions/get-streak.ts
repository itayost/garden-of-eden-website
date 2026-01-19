"use server";

import { createClient } from "@/lib/supabase/server";
import type { UserStreak } from "../../types";

/**
 * Get user's streak data from database
 * Returns null if no streak record exists
 */
export async function getUserStreak(userId: string): Promise<UserStreak | null> {
  const supabase = await createClient();

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
