"use server";

import { createClient } from "@/lib/supabase/server";

export async function resetTour(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: "לא מחובר" };

  const { error } = await supabase
    .from("profiles")
    .update({ tour_completed: false, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) return { error: "שגיאה בעדכון" };
  return {};
}
