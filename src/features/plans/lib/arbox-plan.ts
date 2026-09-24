import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { typedFrom } from "@/lib/supabase/helpers";
import { fulfillFromInput } from "@/features/enrollment/lib/fulfillment";
import type { Order, PlanProduct } from "@/types/plans";

export interface ArboxPlanInput {
  product: PlanProduct;
  trainee: {
    profileId: string;
    /** E.164; the trainee's login. */
    loginPhone: string;
    name: string;
    birthdate: string | null;
    parentName: string;
    parentPhone: string;
  };
  terms: {
    startsOn: string;
    endsOn: string;
    sessionsTotal: number | null;
    amountIls: number;
  };
  reference: string | null;
  actor: { id: string; name: string | null };
}

export type ArboxPlanResult =
  | { ok: true; orderId: string; planId: string; startsOn: string; endsOn: string }
  | { ok: false; error: string };

/**
 * A plan the trainee paid for in Arbox. A paid order marked 'arbox' keeps
 * the orders list complete, and the plan goes through the same fulfillment
 * as any sale. Unlike a cash payment there is no agreement, no Morning
 * receipt, and no WhatsApp: Arbox holds the signature and issued the receipt.
 * The terms are what Arbox sold, which need not match the product's.
 */
export async function recordArboxPlan(
  db: SupabaseClient,
  input: ArboxPlanInput,
): Promise<ArboxPlanResult> {
  const { product, trainee, terms } = input;
  // A product without a session count sells time, not sessions.
  const sessionsTotal = product.sessions_total === null ? null : terms.sessionsTotal;
  if (product.sessions_total !== null && sessionsTotal === null) {
    return { ok: false, error: "חסר מספר אימונים לכרטיסייה" };
  }

  const { data: order, error: orderError } = (await typedFrom(db, "orders")
    .insert({
      product_id: product.id,
      branch_id: product.branch_id,
      status: "paid",
      paid_at: new Date().toISOString(),
      payment_provider: "manual",
      payment_method: "arbox",
      reference: input.reference,
      received_by: input.actor.id,
      amount_ils: terms.amountIls,
      parent_name: trainee.parentName,
      payer_phone: trainee.parentPhone,
      login_phone: trainee.loginPhone,
      child_name: trainee.name,
      child_birthdate: trainee.birthdate,
      email: null,
      profile_id: trainee.profileId,
    })
    .select("*")
    .single()) as { data: Order | null; error: { message: string } | null };
  if (orderError || !order) {
    console.error("[arbox-plan] order insert failed:", orderError?.message);
    return { ok: false, error: "שגיאה ביצירת ההזמנה" };
  }

  const fulfilled = await fulfillFromInput(db, {
    order: { ...order, amount_ils: Number(order.amount_ils) },
    product,
    agreement: null,
    createdBy: input.actor.id,
  });
  if (!fulfilled.ok) {
    // A paid order left unfulfilled offers a retry, and the retry path sends
    // the parent our WhatsApp and writes the product's terms. Failing the
    // order closes that door; staff record it again.
    await typedFrom(db, "orders").update({ status: "failed" }).eq("id", order.id);
    return { ok: false, error: `יצירת המסלול נכשלה, נסו שוב: ${fulfilled.error}` };
  }

  // Fulfillment wrote the product's terms; Arbox's are the real ones.
  const note = `Arbox${input.reference ? ` ${input.reference}` : ""}`;
  const { error: planError } = await typedFrom(db, "trainee_plans")
    .update({
      starts_on: terms.startsOn,
      ends_on: terms.endsOn,
      sessions_total: sessionsTotal,
      note,
    })
    .eq("id", fulfilled.planId);
  if (planError) {
    console.error("[arbox-plan] plan terms update failed:", planError.message);
    return { ok: false, error: "המסלול נוצר עם תנאי המוצר, ועדכון התאריכים והאימונים נכשל. תקנו אותו בכרטיס המתאמן." };
  }

  const { error: logError } = await db.from("activity_logs").insert({
    user_id: fulfilled.profileId,
    action: "plan_granted",
    actor_id: input.actor.id,
    actor_name: input.actor.name ?? "צוות",
    metadata: {
      orderId: order.id,
      productId: product.id,
      paymentMethod: "arbox",
      reference: input.reference,
      amountIls: terms.amountIls,
      startsOn: terms.startsOn,
      endsOn: terms.endsOn,
      sessionsTotal,
    },
  });
  if (logError) console.error("[arbox-plan] activity log failed:", logError.message);

  return { ok: true, orderId: order.id, planId: fulfilled.planId, startsOn: terms.startsOn, endsOn: terms.endsOn };
}
