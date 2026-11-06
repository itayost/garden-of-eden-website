"use server";

import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { isValidUUID } from "@/lib/validations/common";
import { assertPhoneInScope } from "@/lib/retention/scope";
import { callTargetSchema, contactNameSchema } from "../validations";
import {
  CALL_REMINDER_DELAY_MS,
  openAttemptFor,
  reminderState,
  type CallTarget,
  type ReminderState,
} from "../rules";
import { loadCallerAttempts } from "../queries";

type Result<T> = { success: true; data: T } | { error: string };

const MESSAGES = {
  invalid: "קלט לא תקין",
  leadNotFound: "הליד לא נמצא",
  reminderNotFound: "התזכורת לא נמצאה",
  startFailed: "שגיאה בשמירת השיחה",
  loadFailed: "שגיאה בטעינת התזכורות",
  dismissFailed: "שגיאה בסגירת התזכורת",
} as const;

type AdminDb = ReturnType<typeof createAdminClient>;

function dueAtFor(startedAt: string): string {
  return new Date(Date.parse(startedAt) + CALL_REMINDER_DELAY_MS).toISOString();
}

/** Lead names come from the lead row; retention names from the report the trainer sees. */
async function resolveContactName(
  db: AdminDb,
  target: CallTarget,
  rawName: unknown,
): Promise<{ name: string } | { error: string }> {
  if (target.kind === "lead") {
    const { data, error } = await db
      .from("leads")
      .select("name")
      .eq("id", target.leadId)
      .maybeSingle();
    if (error) {
      console.error("[calls] lead lookup failed:", error.message);
      return { error: MESSAGES.startFailed };
    }
    if (!data) return { error: MESSAGES.leadNotFound };
    const name = contactNameSchema.safeParse(data.name);
    return { name: name.success ? name.data : "ליד" };
  }

  const scopeError = await assertPhoneInScope(target.phone);
  if (scopeError) return { error: scopeError };
  const name = contactNameSchema.safeParse(rawName);
  return name.success ? { name: name.data } : { error: MESSAGES.invalid };
}

/**
 * Records a tap on a call link. A repeat tap on the same person while an
 * attempt is open reuses it, so tapping again never postpones the reminder.
 */
export async function startCallAttemptAction(
  rawTarget: CallTarget,
  rawName: string,
): Promise<Result<{ attemptId: string; dueAt: string }>> {
  const { error: authError, user } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  const parsed = callTargetSchema.safeParse(rawTarget);
  if (!parsed.success) return { error: MESSAGES.invalid };
  const target = parsed.data;

  const db = createAdminClient();
  const contact = await resolveContactName(db, target, rawName);
  if ("error" in contact) return contact;

  const nowMs = Date.now();
  const loaded = await loadCallerAttempts(db, user!.id, nowMs, target);
  if ("error" in loaded) return { error: MESSAGES.startFailed };
  const open = openAttemptFor(loaded.attempts, loaded.docs, target, nowMs);
  if (open) return { success: true, data: { attemptId: open.id, dueAt: dueAtFor(open.startedAt) } };

  const { data, error } = await db
    .from("call_attempts")
    .insert({
      caller_id: user!.id,
      contact_name: contact.name,
      lead_id: target.kind === "lead" ? target.leadId : null,
      report_month: target.kind === "retention" ? target.reportMonth : null,
      trainee_phone: target.kind === "retention" ? target.phone : null,
    })
    .select("id, started_at")
    .single();
  if (error || !data) {
    console.error("[calls] insert attempt failed:", error?.message);
    return { error: MESSAGES.startFailed };
  }
  return { success: true, data: { attemptId: data.id, dueAt: dueAtFor(data.started_at) } };
}

/** The signed-in staff member's due reminders, and when the next one falls due. */
export async function getCallRemindersAction(): Promise<Result<ReminderState>> {
  const { error: authError, user } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  const nowMs = Date.now();
  const loaded = await loadCallerAttempts(createAdminClient(), user!.id, nowMs);
  if ("error" in loaded) return { error: MESSAGES.loadFailed };
  return { success: true, data: reminderState(loaded.attempts, loaded.docs, nowMs) };
}

/** "לא התקיימה שיחה": closes every open attempt of the caller for that person. */
export async function dismissCallReminderAction(
  attemptId: string,
): Promise<{ success: true } | { error: string }> {
  const { error: authError, user } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };
  if (!isValidUUID(attemptId)) return { error: MESSAGES.invalid };

  const db = createAdminClient();
  const { data: attempt, error: readError } = await db
    .from("call_attempts")
    .select("caller_id, lead_id, trainee_phone")
    .eq("id", attemptId)
    .maybeSingle();
  if (readError) {
    console.error("[calls] read attempt failed:", readError.message);
    return { error: MESSAGES.dismissFailed };
  }
  if (!attempt || attempt.caller_id !== user!.id) return { error: MESSAGES.reminderNotFound };

  const base = db
    .from("call_attempts")
    .update({ dismissed_at: new Date().toISOString() })
    .eq("caller_id", user!.id)
    .is("dismissed_at", null);
  const { error } = attempt.lead_id
    ? await base.eq("lead_id", attempt.lead_id)
    : await base.eq("trainee_phone", attempt.trainee_phone ?? "");
  if (error) {
    console.error("[calls] dismiss failed:", error.message);
    return { error: MESSAGES.dismissFailed };
  }
  return { success: true };
}
