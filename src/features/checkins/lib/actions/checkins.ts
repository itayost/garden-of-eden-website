"use server";

import { revalidatePath } from "next/cache";
import { waitUntil } from "@vercel/functions";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { israelToday } from "@/lib/utils/tasks";
import { checkinSchema, type CheckinInput } from "@/lib/validations/checkins";
import { getCurrentUser } from "@/lib/supabase/current-user";

type Result = { success: true } | { error: string };

/**
 * Saves the signed-in Trainee's Check-in for today in Israel. The date is
 * always the server's; a second answer the same day replaces the first, and
 * the streak trigger only counts the first (it fires on insert).
 */
export async function saveCheckinAction(input: CheckinInput): Promise<Result> {
  const user = await getCurrentUser();
  if (!user) return { error: "לא מחובר" };

  const limit = await checkRateLimit(`checkin:${user.id}`, "general");
  waitUntil(limit.pending);
  if (limit.rateLimited) return { error: "יותר מדי ניסיונות. נסו שוב בעוד דקה." };

  const parsed = checkinSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "התשובה לא תקינה" };

  const db = createAdminClient();
  const { data: profile } = await db.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (profile?.role !== "trainee") return { error: "רק מתאמנים ממלאים צ׳ק-אין" };

  const { error } = await db.from("trainee_checkins").upsert(
    {
      trainee_id: user.id,
      checkin_date: israelToday(),
      sleep_hours: parsed.data.sleepHours,
      energy: parsed.data.energy,
      soreness: parsed.data.soreness,
    },
    { onConflict: "trainee_id,checkin_date" },
  );
  if (error) {
    console.error("[checkins] save failed:", error.message);
    return { error: "שגיאה בשמירה. נסו שוב." };
  }

  revalidatePath("/dashboard");
  return { success: true };
}
