"use server";

import { createClient } from "@/lib/supabase/server";
import type { UserStreak } from "../../types";
import type { Profile } from "@/types/database";

/**
 * Get user's streak data from database
 * Returns null if no streak record exists
 * Authorization: User can only access their own streak, trainers/admins can access any
 */
export async function getUserStreak(userId: string): Promise<UserStreak | null> {
  const supabase = await createClient();

  // Verify caller is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return null;
  }

  // Check authorization: user can access their own streak, or trainer/admin can access any
  if (user.id !== userId) {
    const { data: profile } = (await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single()) as { data: Pick<Profile, "role"> | null };

    if (!profile || !["trainer", "admin"].includes(profile.role)) {
      console.error("Unauthorized access to streak data");
      return null;
    }
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
