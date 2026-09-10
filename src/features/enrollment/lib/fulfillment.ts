import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { typedFrom } from "@/lib/supabase/helpers";
import {
  loadBranchIdsByProfile,
  replaceProfileBranches,
} from "@/features/branches/lib/memberships";
import { phoneVariants } from "@/lib/plans/phone-variants";
import { renewalStartDate } from "@/lib/plans/plan-status";
import { loadPlansWithUsage } from "@/features/plans/lib/queries";
import { addDays } from "@/lib/utils/iso-date";
import { israelToday } from "@/lib/utils/tasks";
import type { EnrollmentAgreement, Order, PlanProduct } from "@/types/plans";

export type FulfillResult =
  | { ok: true; profileId: string; planId: string }
  | { ok: false; error: string };

interface FulfillInput {
  order: Order;
  product: PlanProduct;
  agreement: EnrollmentAgreement | null;
  /** Null for online orders; the admin for manual grants. */
  createdBy: string | null;
}

/** The profile whose auth phone is this login phone, in any stored spelling. */
async function findProfileByPhone(db: SupabaseClient, e164: string): Promise<string | null> {
  const { data } = await db
    .from("profiles")
    .select("id")
    .in("phone", phoneVariants(e164))
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  return data?.id ?? null;
}

async function createAccount(
  db: SupabaseClient,
  e164: string,
  childName: string,
): Promise<string> {
  const { data, error } = await db.auth.admin.createUser({
    phone: e164,
    phone_confirm: true,
    user_metadata: { full_name: childName },
  });
  if (error || !data.user) {
    // A race with a parallel webhook can create the user first; look again.
    const existing = await findProfileByPhone(db, e164);
    if (existing) return existing;
    throw new Error(`auth createUser failed: ${error?.message ?? "no user"}`);
  }
  return data.user.id;
}

/**
 * Turns a paid order into a person with a plan. Every step is safe to rerun:
 * an existing account is reused, memberships are merged, and the plan is
 * only inserted when the order has none yet.
 */
export async function fulfillFromInput(
  db: SupabaseClient,
  { order, product, agreement, createdBy }: FulfillInput,
): Promise<FulfillResult> {
  try {
    const profileId =
      order.profile_id ??
      (await findProfileByPhone(db, order.login_phone)) ??
      (await createAccount(db, order.login_phone, order.child_name));

    const { data: profile } = await db
      .from("profiles")
      .select(
        "full_name, birthdate, role, guardian_name, guardian_phone, medical_notes, emergency_contact_name, emergency_contact_phone, photo_consent",
      )
      .eq("id", profileId)
      .single();

    // A paid order must never turn a trainer or admin into a trainee. The
    // checkout refuses staff phones up front; this is the backstop.
    if (profile && profile.role !== "trainee") {
      throw new Error(`login phone belongs to a ${profile.role} account`);
    }

    // Existing values win: a renewal or a second plan must not let whoever
    // paid rewrite the guardian, medical notes, or emergency contact that
    // staff may have corrected. Staff edit those on the trainee page.
    const { error: profileError } = await db
      .from("profiles")
      .update({
        full_name: profile?.full_name || order.child_name,
        birthdate: profile?.birthdate || order.child_birthdate,
        role: "trainee",
        profile_completed: true,
        guardian_name: profile?.guardian_name ?? order.parent_name,
        guardian_phone: profile?.guardian_phone ?? order.payer_phone,
        medical_notes: profile?.medical_notes ?? agreement?.medical_notes ?? null,
        emergency_contact_name:
          profile?.emergency_contact_name ?? agreement?.emergency_contact_name ?? null,
        emergency_contact_phone:
          profile?.emergency_contact_phone ?? agreement?.emergency_contact_phone ?? null,
        photo_consent: profile?.photo_consent ?? agreement?.photo_consent ?? null,
      })
      .eq("id", profileId);
    if (profileError) throw new Error(`profile update failed: ${profileError.message}`);

    const memberships = (await loadBranchIdsByProfile(db, [profileId])).get(profileId) ?? [];
    if (!memberships.includes(order.branch_id)) {
      const { error } = await replaceProfileBranches(
        db,
        profileId,
        [...memberships, order.branch_id],
        { stampAdmin: true },
      );
      if (error) throw new Error(`branch link failed: ${error}`);
    }

    const { data: existingPlan } = (await typedFrom(db, "trainee_plans")
      .select("id")
      .eq("order_id", order.id)
      .maybeSingle()) as { data: { id: string } | null };

    let planId = existingPlan?.id ?? null;
    if (!planId) {
      // A renewal starts after the plan that is still running, whatever plan
      // the link named. A used-up card or a cancelled plan is not running,
      // so the new one starts today rather than weeks out. Add-ons never
      // chain: the mental session starts now.
      const today = israelToday();
      let previousEndsOn: string | null = null;
      if (product.kind !== "addon") {
        const current = (await loadPlansWithUsage(db, [profileId], today)).get(profileId);
        if (current && (current.status === "active" || current.status === "ending_soon")) {
          previousEndsOn = current.plan.ends_on;
        }
      }
      const startsOn = renewalStartDate(previousEndsOn, today);
      const { data: plan, error: planError } = (await typedFrom(db, "trainee_plans")
        .insert({
          profile_id: profileId,
          product_id: product.id,
          branch_id: order.branch_id,
          order_id: order.id,
          starts_on: startsOn,
          ends_on: addDays(startsOn, product.duration_days - 1),
          sessions_total: product.sessions_total,
          source: createdBy ? "manual" : "online",
          created_by: createdBy,
        })
        .select("id")
        .single()) as { data: { id: string } | null; error: { message: string } | null };
      if (planError || !plan) throw new Error(`plan insert failed: ${planError?.message}`);
      planId = plan.id;
    }

    if (agreement && !agreement.profile_id) {
      await typedFrom(db, "enrollment_agreements")
        .update({ profile_id: profileId })
        .eq("id", agreement.id);
    }

    const { error: orderError } = await typedFrom(db, "orders")
      .update({
        profile_id: profileId,
        fulfilled_at: new Date().toISOString(),
        fulfillment_error: null,
      })
      .eq("id", order.id);
    if (orderError) throw new Error(`order update failed: ${orderError.message}`);

    return { ok: true, profileId, planId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[fulfillment] order ${order.id}:`, message);
    await typedFrom(db, "orders").update({ fulfillment_error: message }).eq("id", order.id);
    return { ok: false, error: message };
  }
}

/** Loads a paid order with its product and agreement and fulfills it. */
export async function fulfillOrder(db: SupabaseClient, orderId: string): Promise<FulfillResult> {
  const { data: order } = (await typedFrom(db, "orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle()) as { data: Order | null };
  if (!order) return { ok: false, error: "order not found" };
  if (order.status !== "paid") return { ok: false, error: `order is ${order.status}` };
  if (order.fulfilled_at) {
    return { ok: true, profileId: order.profile_id ?? "", planId: "" };
  }

  const [{ data: product }, { data: agreement }] = await Promise.all([
    typedFrom(db, "plan_products").select("*").eq("id", order.product_id).maybeSingle() as Promise<{
      data: PlanProduct | null;
    }>,
    typedFrom(db, "enrollment_agreements")
      .select("*")
      .eq("order_id", order.id)
      .maybeSingle() as Promise<{ data: EnrollmentAgreement | null }>,
  ]);
  if (!product) return { ok: false, error: "product not found" };

  return fulfillFromInput(db, {
    order: { ...order, amount_ils: Number(order.amount_ils) },
    product: { ...product, price_ils: Number(product.price_ils) },
    agreement,
    createdBy: null,
  });
}
