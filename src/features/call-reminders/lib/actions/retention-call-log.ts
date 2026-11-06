"use server";

import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizePhoneIL } from "@/lib/validations/common";
import { assertPhoneInScope } from "@/lib/retention/scope";
import { checkRateLimit } from "@/lib/rate-limit";
import type { LeadContactOutcome } from "@/types/leads";
import { retentionCallLogSchema, type RetentionCallLogInput } from "../validations";

/** A phone's call history is short; 50 entries covers years of retention calls. */
const MAX_HISTORY = 50;

export interface RetentionCallEntry {
  readonly id: string;
  readonly outcome: LeadContactOutcome;
  readonly notes: string | null;
  readonly authorName: string | null;
  readonly createdAt: string;
  readonly reportMonth: string;
}

/** Documents a retention call. This, not a note or color edit, closes a call reminder. */
export async function addRetentionCallLogAction(
  input: RetentionCallLogInput,
): Promise<{ success: true } | { error: string; fieldErrors?: Record<string, string[]> }> {
  const { error: authError, user } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  const parsed = retentionCallLogSchema.safeParse(input);
  if (!parsed.success) {
    return {
      error: "אימות נתונים נכשל",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }
  const { reportMonth, phone, traineeName, outcome, notes } = parsed.data;

  const limit = await checkRateLimit(`retention-call-log:${user!.id}`, "general");
  if (limit.rateLimited) return { error: "יותר מדי בקשות, נסו שוב בעוד דקה" };

  const scopeError = await assertPhoneInScope(phone);
  if (scopeError) return { error: scopeError };

  const { error } = await createAdminClient().from("retention_call_log").insert({
    report_month: reportMonth,
    trainee_phone: phone,
    trainee_name: traineeName,
    author_id: user!.id,
    outcome,
    notes: notes.trim() || null,
  });
  if (error) {
    console.error("[calls] add retention call failed:", error.message);
    return { error: "שגיאה בשמירת תיעוד השיחה" };
  }
  return { success: true };
}

/** A retention customer's calls, newest first, for staff who may see that customer. */
export async function getRetentionCallLogAction(
  rawPhone: string,
): Promise<{ success: true; data: readonly RetentionCallEntry[] } | { error: string }> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  const phone = normalizePhoneIL(rawPhone);
  if (!phone) return { error: "מספר טלפון לא תקין" };
  const scopeError = await assertPhoneInScope(phone);
  if (scopeError) return { error: scopeError };

  const { data, error } = await createAdminClient()
    .from("retention_call_log")
    .select(
      "id, outcome, notes, created_at, report_month, author:profiles!retention_call_log_author_id_fkey(full_name)",
    )
    .eq("trainee_phone", phone)
    .order("created_at", { ascending: false })
    .limit(MAX_HISTORY);
  if (error) {
    console.error("[calls] load retention calls failed:", error.message);
    return { error: "שגיאה בטעינת היסטוריית השיחות" };
  }

  return {
    success: true,
    data: (data ?? []).map((row) => ({
      id: row.id,
      outcome: row.outcome,
      notes: row.notes,
      authorName: row.author?.full_name ?? null,
      createdAt: row.created_at,
      reportMonth: row.report_month,
    })),
  };
}
