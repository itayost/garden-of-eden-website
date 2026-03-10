"use server";

import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { isValidUUID } from "@/lib/validations/common";
import { createClient } from "@/lib/supabase/server";

const MAX_SUMMARY_LENGTH = 10_000;

export async function saveSummary(
  userId: string,
  summary: string,
): Promise<{ error: string | null }> {
  const auth = await verifyAdminOrTrainer();
  if (auth.error) {
    return { error: auth.error };
  }

  if (!isValidUUID(userId)) {
    return { error: "מזהה משתמש לא תקין" };
  }

  const trimmed = summary.trim();
  if (!trimmed) {
    return { error: "הסיכום לא יכול להיות ריק" };
  }

  if (trimmed.length > MAX_SUMMARY_LENGTH) {
    return { error: "הסיכום ארוך מדי" };
  }

  const supabase = await createClient();
  const authorId = auth.user!.id;

  // Verify target is a trainee (trainers cannot write summaries for other trainers/admins)
  if (auth.profile?.role === "trainer") {
    const { data: targetProfile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    if (!targetProfile || targetProfile.role !== "trainee") {
      return { error: "לא ניתן לשמור סיכום עבור משתמש זה" };
    }
  }

  // Check if a summary already exists for this trainee by this author
  const { data: existing } = await supabase
    .from("trainee_summaries")
    .select("id")
    .eq("user_id", userId)
    .eq("author_id", authorId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("trainee_summaries")
      .update({ summary: trimmed, updated_at: new Date().toISOString() })
      .eq("id", existing.id);

    if (error) {
      return { error: "שגיאה בעדכון הסיכום" };
    }
  } else {
    const { error } = await supabase
      .from("trainee_summaries")
      .insert({
        user_id: userId,
        author_id: authorId,
        summary: trimmed,
      });

    if (error) {
      return { error: "שגיאה בשמירת הסיכום" };
    }
  }

  return { error: null };
}
