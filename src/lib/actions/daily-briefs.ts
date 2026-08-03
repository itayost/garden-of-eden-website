"use server";

import { revalidatePath } from "next/cache";

import { verifyAdmin, verifyAdminOrTrainer } from "@/lib/actions/shared";
import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import { isValidDateString } from "@/lib/validations/common";
import { dailyBriefSchema, type DailyBriefInput } from "@/lib/validations/tasks";
import type { DailyBrief } from "@/types/tasks";

type BriefResult = { success: true; data: DailyBrief | null } | { error: string };
type UpsertResult =
  | { success: true; data: DailyBrief }
  | { error: string; fieldErrors?: Record<string, string[]> };

/**
 * Fetch the brief for a single date.
 *
 * Returns `null` when nothing was written for that day. The caller must render
 * an explicit empty state — it must NOT fall back to an earlier day's brief.
 * Stale operational instructions ("the photographer arrives at 16:00") are
 * worse than no instructions.
 */
export async function getBriefAction(date: string): Promise<BriefResult> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  if (!isValidDateString(date)) return { error: "תאריך לא תקין" };

  const supabase = await createClient();
  const { data, error } = await typedFrom(supabase, "daily_briefs")
    .select("*")
    .eq("brief_date", date)
    .maybeSingle();

  if (error) {
    console.error("Get daily brief error:", error);
    return { error: "שגיאה בטעינת הבריף" };
  }

  return { success: true, data: (data as DailyBrief | null) ?? null };
}

/**
 * Write or rewrite the brief for a date. There is one brief per calendar day
 * globally, so this upserts on `brief_date` rather than inserting.
 *
 * Admin only — a trainer reads the brief but never writes it.
 */
export async function upsertBriefAction(input: DailyBriefInput): Promise<UpsertResult> {
  const { error: authError, user, adminProfile } = await verifyAdmin();
  if (authError) return { error: authError };

  const validated = dailyBriefSchema.safeParse(input);
  if (!validated.success) {
    return {
      error: "אימות נתונים נכשל",
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { briefDate, content } = validated.data;
  const callerName = adminProfile!.full_name ?? "מנהל";
  const supabase = await createClient();

  const { data: existing } = await typedFrom(supabase, "daily_briefs")
    .select("id")
    .eq("brief_date", briefDate)
    .maybeSingle();

  // Insert and update are separate rather than a single upsert, because an
  // upsert would rewrite author_id/author_name on every edit and credit the
  // last editor as the author. Editing records updated_by_* instead; the
  // guard_daily_brief_author trigger enforces the same rule at the DB level.
  const { data, error } = existing
    ? await typedFrom(supabase, "daily_briefs")
        .update({
          content,
          updated_by_id: user!.id,
          updated_by_name: callerName,
        })
        .eq("id", existing.id)
        .select()
        .single()
    : await typedFrom(supabase, "daily_briefs")
        .insert({
          brief_date: briefDate,
          content,
          author_id: user!.id,
          author_name: callerName,
          updated_by_id: user!.id,
          updated_by_name: callerName,
        })
        .select()
        .single();

  if (error || !data) {
    console.error("Save daily brief error:", error);
    return { error: "שגיאה בשמירת הבריף" };
  }

  revalidatePath("/admin/tasks");

  return { success: true, data: data as DailyBrief };
}
