"use server";

import { createClient } from "@/lib/supabase/server";
import { isValidUUID } from "@/lib/validations/common";

export async function markVideoWatchedAction(videoId: string) {
  if (!isValidUUID(videoId)) return { error: "מזהה סרטון לא תקין" };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "לא מחובר" };

  const { error } = await supabase.from("video_progress").upsert({
    user_id: user.id,
    video_id: videoId,
    watched: true,
    watched_at: new Date().toISOString(),
  });

  if (error) return { error: "שגיאה בעדכון" };
  return { success: true };
}
