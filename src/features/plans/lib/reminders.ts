import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { dueReminderMilestone } from "@/lib/plans/plan-status";
import { REMINDED_COLUMN, reminderReason } from "@/lib/plans/reminder-copy";
import { sendPlanReminder } from "@/lib/whatsapp/plan-templates";
import type { TraineePlan } from "@/types/plans";
import { loadPlansWithUsage } from "./queries";
import { buildRenewalUrl } from "./renewal-link";

export interface ReminderRunResult {
  expiredOrders: number;
  reminded: number;
  failed: number;
}

const PENDING_ORDER_TTL_HOURS = 24;

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
 * One reminder per plan per milestone, to the guardian phone. Every active
 * plan is evaluated: the ones with nothing due are skipped by
 * dueReminderMilestone, which also refuses to repeat a sent milestone.
 */
export async function runPlanReminders(today: string): Promise<ReminderRunResult> {
  const db = createAdminClient();
  const result: ReminderRunResult = { expiredOrders: 0, reminded: 0, failed: 0 };

  result.expiredOrders = await expireStaleOrders(db);

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
  const plans = await loadPlansWithUsage(db, profileIds, today);

  const { data: profiles } = await db
    .from("profiles")
    .select("id, full_name, guardian_name, guardian_phone")
    .in("id", profileIds);
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  for (const [profileId, { plan, product, sessionsUsed }] of plans) {
    const milestone = dueReminderMilestone(plan, sessionsUsed, today);
    if (!milestone) continue;

    const profile = profileById.get(profileId);
    if (!profile?.guardian_phone) continue;

    const sent = await sendPlanReminder(profile.guardian_phone, {
      parentName: profile.guardian_name ?? "הורה יקר",
      childName: profile.full_name ?? "החניך",
      planName: product.name_he,
      reason: reminderReason(milestone),
      renewUrl: buildRenewalUrl(plan.id),
    });

    if (!sent.success) {
      console.error(`[plan-reminders] send failed for plan ${plan.id}:`, sent.error);
      result.failed += 1;
      continue;
    }

    await typedFrom(db, "trainee_plans")
      .update({ [REMINDED_COLUMN[milestone]]: new Date().toISOString() })
      .eq("id", plan.id);
    result.reminded += 1;
  }

  return result;
}
