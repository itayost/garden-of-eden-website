"use server";

import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/supabase/current-user";

export async function resetTour(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const user = await getCurrentUser();

  if (!user) return { error: "לא מחובר" };

  const { error } = await supabase
    .from("profiles")
    .update({ tour_completed: false, updated_at: new Date().toISOString() })
    .eq("id", user.id);

  if (error) return { error: "שגיאה בעדכון" };
  return {};
}
