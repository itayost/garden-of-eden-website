"use server";

import { revalidatePath } from "next/cache";
import { waitUntil } from "@vercel/functions";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { israelToday } from "@/lib/utils/tasks";
import { parentPhoneSchema, type ParentPhoneInput } from "@/lib/validations/parent-phone";
import { noParentRefusal, parentPhoneRefusal } from "../prompt";

type Result = { success: true } | { error: string };

async function signedInUserId(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/**
 * The Trainee's own answer on the dashboard card. A number already stored is
 * never overwritten from here (staff may have set it); the card was stale.
 */
export async function saveParentPhoneAction(input: ParentPhoneInput): Promise<Result> {
  const userId = await signedInUserId();
  if (!userId) return { error: "לא מחובר" };

  const limit = await checkRateLimit(`parent-phone:${userId}`, "general");
  waitUntil(limit.pending);
  if (limit.rateLimited) return { error: "יותר מדי ניסיונות. נסו שוב בעוד דקה." };

  const parsed = parentPhoneSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "מספר טלפון לא תקין" };

  const db = createAdminClient();
  const { data: profile, error: readError } = await db
    .from("profiles")
    .select("phone, guardian_phone")
    .eq("id", userId)
    .maybeSingle();
  if (readError || !profile) return { error: "שגיאה בשמירה. נסו שוב." };
  if (profile.guardian_phone?.trim()) return { success: true };

  const refusal = parentPhoneRefusal(parsed.data.phone, profile.phone);
  if (refusal) return { error: refusal };

  // Only fills an empty number: a staff save that lands between the read above
  // and this write must win, so a changed row means there is nothing to do.
  const { data: written, error } = await db
    .from("profiles")
    .update({ guardian_phone: parsed.data.phone })
    .eq("id", userId)
    .or("guardian_phone.is.null,guardian_phone.eq.")
    .select("id");
  if (error) {
    console.error("[parent-phone] save failed:", error.message);
    return { error: "שגיאה בשמירה. נסו שוב." };
  }
  if (!written || written.length === 0) return { success: true };

  await db.from("activity_logs").insert({
    user_id: userId,
    action: "user_updated",
    actor_id: userId,
    actor_name: "המתאמן",
    changes: [{ field: "guardian_phone", old_value: null, new_value: parsed.data.phone }],
  });

  revalidatePath("/dashboard");
  return { success: true };
}

/** "לא עכשיו": the card comes back a week later. */
export async function dismissParentPromptAction(): Promise<Result> {
  const userId = await signedInUserId();
  if (!userId) return { error: "לא מחובר" };

  const { error } = await createAdminClient()
    .from("profiles")
    .update({ guardian_prompt_dismissed_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) return { error: "שגיאה בשמירה. נסו שוב." };

  revalidatePath("/dashboard");
  return { success: true };
}

/** "אני מעל 18": refused when the stored birthdate says otherwise. */
export async function declareNoParentNeededAction(): Promise<Result> {
  const userId = await signedInUserId();
  if (!userId) return { error: "לא מחובר" };

  const db = createAdminClient();
  const { data: profile } = await db.from("profiles").select("birthdate").eq("id", userId).maybeSingle();
  if (!profile) return { error: "שגיאה בשמירה. נסו שוב." };

  const refusal = noParentRefusal(profile.birthdate, israelToday());
  if (refusal) return { error: refusal };

  const { error } = await db.from("profiles").update({ guardian_not_needed: true }).eq("id", userId);
  if (error) return { error: "שגיאה בשמירה. נסו שוב." };

  revalidatePath("/dashboard");
  return { success: true };
}
