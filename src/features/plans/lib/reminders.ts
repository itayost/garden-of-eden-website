import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { dueReminder } from "@/lib/plans/plan-queue";
import { REMINDED_COLUMN, reminderReason } from "@/lib/plans/reminder-copy";
import { sendPlanReminder } from "@/lib/whatsapp/plan-templates";
import type { EnrollmentAgreement, TraineePlan } from "@/types/plans";
import { notifyOrderFulfilled } from "@/features/enrollment/lib/notify";
import { loadPlanQueues } from "./queries";
import { buildRenewalUrl } from "./renewal-link";

export interface ReminderRunResult {
  expiredOrders: number;
  signReminders: number;
  reminded: number;
  failed: number;
}

const PENDING_ORDER_TTL_HOURS = 24;
const EXPIRED_ORDER_KEEP_DAYS = 30;
const SIGN_REMINDER_AFTER_DAYS = 3;

/**
 * One nudge to parents who have not signed a staff-opened agreement after
 * three days: the same confirmation with the signing link, sent once.
 */
async function remindUnsignedAgreements(
  db: ReturnType<typeof createAdminClient>,
): Promise<{ sent: number; failed: number }> {
  const cutoff = new Date(Date.now() - SIGN_REMINDER_AFTER_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data } = (await typedFrom(db, "enrollment_agreements")
    .select("id, order_id")
    .is("signed_at", null)
    .is("sign_reminded_at", null)
    .not("order_id", "is", null)
    .lt("created_at", cutoff)
    .order("created_at")
    .limit(50)) as { data: Pick<EnrollmentAgreement, "id" | "order_id">[] | null };
  let sent = 0;
  let failed = 0;
  for (const agreement of data ?? []) {
    const outcome = await notifyOrderFulfilled(db, agreement.order_id!);
    // An order that never fulfilled has nobody to remind; stamp it so it
    // stops occupying the batch. A transient send failure retries tomorrow.
    const unreachable = outcome.sentTo === null;
    if (!unreachable && !outcome.confirmed?.success) {
      failed += 1;
      continue;
    }
    await typedFrom(db, "enrollment_agreements")
      .update({ sign_reminded_at: new Date().toISOString() })
      .eq("id", agreement.id);
    if (!unreachable) sent += 1;
  }
  return { sent, failed };
}

/**
 * Expired checkouts hold a parent's details with no payment behind them;
 * after a month they and their unsigned agreements go. Paid orders and
 * their agreements are kept: the agreement is the contract.
 */
async function purgeExpiredOrders(db: ReturnType<typeof createAdminClient>): Promise<number> {
  const cutoff = new Date(Date.now() - EXPIRED_ORDER_KEEP_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const { data: stale } = (await typedFrom(db, "orders")
    .select("id")
    .eq("status", "expired")
    .lt("created_at", cutoff)) as { data: { id: string }[] | null };
  const ids = (stale ?? []).map((o) => o.id);
  if (ids.length === 0) return 0;
  const { error: agreementsError } = await typedFrom(db, "enrollment_agreements")
    .delete()
    .in("order_id", ids);
  if (agreementsError) {
    console.error("[plan-reminders] purge agreements failed:", agreementsError);
    return 0;
  }
  const { error } = await typedFrom(db, "orders").delete().in("id", ids);
  if (error) {
    console.error("[plan-reminders] purge orders failed:", error);
    return 0;
  }
  return ids.length;
}

/** Orders nobody paid within a day stop pretending to be open checkouts. */
async function expireStaleOrders(db: ReturnType<typeof createAdminClient>): Promise<number> {
  const cutoff = new Date(Date.now() - PENDING_ORDER_TTL_HOURS * 60 * 60 * 1000).toISOString();
  const { data, error } = await typedFrom(db, "orders")
    .update({ status: "expired" })
    .eq("status", "pending")
    .lt("created_at", cutoff)
    .select("id");
  if (error) {
    console.error("[plan-reminders] expire orders failed:", error);
    return 0;
  }
  return data?.length ?? 0;
}

/**
 * One reminder per milestone at the end of each Plan queue, to the guardian
 * phone. Every Trainee with an active plan is evaluated: dueReminder skips a
 * queue with nothing due, refuses to repeat a sent milestone, stays silent
 * while a paid Plan is queued, and sends nothing for a queue that ends on an
 * Arbox purchase (those renew in Arbox).
 */
export async function runPlanReminders(today: string): Promise<ReminderRunResult> {
  const db = createAdminClient();
  const result: ReminderRunResult = { expiredOrders: 0, signReminders: 0, reminded: 0, failed: 0 };

  result.expiredOrders = await expireStaleOrders(db);
  await purgeExpiredOrders(db);
  const signReminders = await remindUnsignedAgreements(db);
  result.signReminders = signReminders.sent;
  result.failed += signReminders.failed;

  const { data: activePlans, error } = (await typedFrom(db, "trainee_plans")
    .select("profile_id")
    .eq("status", "active")) as {
    data: Pick<TraineePlan, "profile_id">[] | null;
    error: { message: string } | null;
  };
  if (error) {
    console.error("[plan-reminders] load plans failed:", error);
    return result;
  }

  const profileIds = Array.from(new Set((activePlans ?? []).map((p) => p.profile_id)));
  const queues = await loadPlanQueues(db, profileIds, today);

  if (profileIds.length === 0) return result;
  const { data: profiles } = await db
    .from("profiles")
    .select("id, full_name, guardian_name, guardian_phone")
    .in("id", profileIds);
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  for (const [profileId, { queue }] of queues) {
    const due = dueReminder(queue);
    if (!due) continue;
    const { milestone, plan } = due;

    const profile = profileById.get(profileId);
    if (!profile?.guardian_phone) continue;

    const sent = await sendPlanReminder(profile.guardian_phone, {
      parentName: profile.guardian_name ?? "הורה יקר",
      childName: profile.full_name ?? "החניך",
      planName: plan.product?.name_he ?? "מסלול",
      reason: reminderReason(milestone),
      renewUrl: buildRenewalUrl(plan.id),
    });

    if (!sent.success) {
      console.error(`[plan-reminders] send failed for plan ${plan.id}:`, sent.error);
      result.failed += 1;
      continue;
    }

    // An unstamped send would repeat tomorrow; count it so someone looks.
    const { error: stampError } = await typedFrom(db, "trainee_plans")
      .update({ [REMINDED_COLUMN[milestone]]: new Date().toISOString() })
      .eq("id", plan.id);
    if (stampError) {
      console.error(`[plan-reminders] stamp failed for plan ${plan.id}:`, stampError);
      result.failed += 1;
      continue;
    }
    result.reminded += 1;
  }

  return result;
}
