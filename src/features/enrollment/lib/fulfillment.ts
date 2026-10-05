import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { typedFrom } from "@/lib/supabase/helpers";
import {
  loadBranchIdsByProfile,
  replaceProfileBranches,
} from "@/features/branches/lib/memberships";
import { phoneVariants } from "@/lib/plans/phone-variants";
import { placeNewPlan, resolvePlanQueue, type NewPlanTerms } from "@/lib/plans/plan-queue";
import { appliedStart } from "@/lib/plans/start-date";
import { orderManualTerms } from "@/lib/plans/manual-card";
import { loadQueueRows, loadStoredPlans } from "@/features/plans/lib/queries";
import { israelToday } from "@/lib/utils/tasks";
import type { EnrollmentAgreement, Order, PlanProduct } from "@/types/plans";

export type FulfillResult =
  | { ok: true; profileId: string; planId: string }
  | { ok: false; error: string };

interface FulfillInput {
  order: Order;
  product: PlanProduct;
  agreement: EnrollmentAgreement | null;
  /** Null for online orders; the staff member for staff sales and Payment links. */
  createdBy: string | null;
  /** How it was paid; by default a staff sale is manual. A Payment link is paid online. */
  source?: "online" | "manual";
  /** Terms that differ from the product's: what Arbox sold. */
  terms?: Partial<Pick<NewPlanTerms, "notBefore" | "fixedEndsOn" | "sessionsTotal" | "durationDays">>;
  /** A staff-chosen start; it applies only when nothing is current or queued (appliedStart). */
  chosenStartsOn?: string | null;
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
  { order, product, agreement, createdBy, source, terms, chosenStartsOn = null }: FulfillInput,
): Promise<FulfillResult> {
  // A manual Card was sold on the terms staff typed, kept on the order.
  const manual = orderManualTerms(order);
  const termsOverride = terms ?? (manual ? { sessionsTotal: manual.sessions, durationDays: manual.days } : undefined);
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
        // A staff signup carries no birthdate until the parent signs; leave the
        // app's onboarding to ask for what is still missing.
        profile_completed: Boolean(profile?.birthdate || order.child_birthdate),
        guardian_name: profile?.guardian_name ?? order.parent_name,
        guardian_phone: profile?.guardian_phone ?? order.payer_phone,
        medical_notes: profile?.medical_notes ?? agreement?.medical_notes ?? null,
        // Empty strings mean "not given yet" on a staff-opened agreement.
        emergency_contact_name:
          profile?.emergency_contact_name || agreement?.emergency_contact_name || null,
        emergency_contact_phone:
          profile?.emergency_contact_phone || agreement?.emergency_contact_phone || null,
        // Consent is an answer the parent gives at signing, never a default.
        photo_consent:
          profile?.photo_consent ?? (agreement?.signed_at ? agreement.photo_consent : null),
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
    let startsOn: string | null = null;
    if (!planId) {
      // A sale joins the end of the Trainee's Plan queue, whatever plan a
      // renewal link named (ADR-0008). The stored dates are the queue's
      // forecast; the sale-time terms are what the queue reads.
      const today = israelToday();
      const [plans, rows] = await Promise.all([
        loadStoredPlans(db, [profileId]),
        loadQueueRows(db, [profileId]),
      ]);
      const own = plans.get(profileId) ?? [];
      const ownRows = rows.get(profileId) ?? [];
      const queueHasPlans = resolvePlanQueue(own, ownRows, today).ahead.length > 0;
      const terms: NewPlanTerms = {
        kind: product.kind,
        branchId: order.branch_id,
        sessionsTotal:
          termsOverride?.sessionsTotal !== undefined ? termsOverride.sessionsTotal : product.sessions_total,
        durationDays: termsOverride?.durationDays ?? product.duration_days,
        notBefore: termsOverride?.notBefore ?? appliedStart(chosenStartsOn, today, queueHasPlans, product.kind),
        fixedEndsOn: termsOverride?.fixedEndsOn ?? null,
      };
      const placed = placeNewPlan(own, ownRows, terms, today);
      const { data: plan, error: planError } = (await typedFrom(db, "trainee_plans")
        .insert({
          profile_id: profileId,
          product_id: product.id,
          branch_id: order.branch_id,
          order_id: order.id,
          starts_on: placed.startsOn,
          // An Arbox Plan queued past its own end never runs; the row still needs a window.
          ends_on: placed.endsOn < placed.startsOn ? placed.startsOn : placed.endsOn,
          sessions_total: terms.sessionsTotal,
          not_before: terms.notBefore,
          duration_days: terms.durationDays,
          fixed_ends_on: terms.fixedEndsOn,
          source: source ?? (createdBy ? "manual" : "online"),
          created_by: createdBy,
        })
        .select("id")
        .single()) as { data: { id: string } | null; error: { message: string } | null };
      if (planError || !plan) throw new Error(`plan insert failed: ${planError?.message}`);
      planId = plan.id;
      startsOn = placed.startsOn;
    }

    // The agreement names the Trainee and states the Plan's start, which the queue decides at the sale.
    if (agreement) {
      const patch: { profile_id?: string; plan_start_on?: string } = {};
      if (!agreement.profile_id) patch.profile_id = profileId;
      if (startsOn && agreement.plan_start_on !== startsOn) patch.plan_start_on = startsOn;
      if (patch.profile_id || patch.plan_start_on) {
        await typedFrom(db, "enrollment_agreements").update(patch).eq("id", agreement.id);
      }
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
    // Paid by card online; a Payment link names the staff member who sent it.
    createdBy: order.payment_link_by,
    source: "online",
  });
}
