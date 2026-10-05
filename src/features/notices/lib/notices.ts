"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidUUID } from "@/lib/validations/common";

export interface TraineeNotice {
  id: string;
  body: string;
  createdAt: string;
}

/** The signed-in Trainee's open notices, newest first; RLS lets them read only their own. */
export async function getMyNoticesAction(): Promise<TraineeNotice[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];
  const { data, error } = await supabase
    .from("trainee_notices")
    .select("id, body_he, created_at")
    .eq("profile_id", user.id)
    .is("dismissed_at", null)
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) {
    console.error("[notices] load failed:", error.message);
    return [];
  }
  return (data ?? []).map((n) => ({ id: n.id, body: n.body_he, createdAt: n.created_at }));
}

/** The Trainee dismisses one of their own notices. Written with the service role, scoped to the caller. */
export async function dismissNoticeAction(noticeId: string): Promise<{ success: true } | { error: string }> {
  if (!isValidUUID(noticeId)) return { error: "מזהה לא תקין" };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "נדרשת התחברות" };

  const { error } = await createAdminClient()
    .from("trainee_notices")
    .update({ dismissed_at: new Date().toISOString() })
    .eq("id", noticeId)
    .eq("profile_id", user.id)
    .is("dismissed_at", null);
  if (error) return { error: "הסגירה נכשלה. נסו שוב." };
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/schedule");
  return { success: true };
}
