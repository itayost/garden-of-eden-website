"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/supabase/current-user";

export async function completeTour(): Promise<{ error?: string }> {
  const user = await getCurrentUser();

  if (!user) return { error: "לא מחובר" };

  // Use admin client to bypass RLS — auth is already verified above
  const admin = createAdminClient();
  const { error } = await admin
    .from("profiles")
    .update({ tour_completed: true })
    .eq("id", user.id);

  if (error) return { error: "שגיאה בעדכון" };
  return {};
}
