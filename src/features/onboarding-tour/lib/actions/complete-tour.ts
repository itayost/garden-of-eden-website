"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function completeTour(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

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
