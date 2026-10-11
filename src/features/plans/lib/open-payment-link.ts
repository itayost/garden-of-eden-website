import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { typedFrom } from "@/lib/supabase/helpers";
import { israelToday } from "@/lib/utils/tasks";
import { sendPaymentLink } from "@/lib/whatsapp/plan-templates";
import { sameTraineeOrders } from "@/lib/plans/bound-renewal";
import { orderPlanName, type ManualCardTerms } from "@/lib/plans/manual-card";
import type { Discount } from "@/lib/plans/discount";
import { agreementLink } from "@/features/enrollment/lib/notify";
import { PAYMENT_METHOD_LABELS_HE, type PlanProduct } from "@/types/plans";
import { insertUnsignedAgreement, type UnsignedAgreementInput } from "./unsigned-agreement";
import { revalidateStaffSurfaces } from "./revalidate-staff";
import { staffOrderColumns } from "./staff-order";

export interface PaymentLinkResult {
  ok: true;
  orderId: string;
  /** The parent's link: the agreement to sign, then the card page. */
  url: string;
  whatsapp: { sentTo: string | null; error: string | null; skipped: boolean };
}

export interface OpenPaymentLinkInput {
  product: PlanProduct;
  /** Null for a new trainee: fulfillment finds or creates the account once the card is charged. */
  profileId: string | null;
  /** E.164; the child's WhatsApp, which is the login. */
  loginPhone: string;
  child: UnsignedAgreementInput["child"];
  parent: UnsignedAgreementInput["parent"];
  health: UnsignedAgreementInput["health"];
  sendWhatsApp: boolean;
  /** Already allowed by the action; null at list price. */
  discount: Discount | null;
  /** Already allowed by the action; null for a catalog sale. */
  manualCard: ManualCardTerms | null;
  actor: { id: string; name: string | null };
}

/**
 * A Payment link: a pending card order at a fixed amount, with an agreement
 * for the parent to sign before the card page. It becomes a sale only when
 * the charge completes; unpaid, it expires like any pending order. The
 * caller has already checked who may sell what at which price.
 */
export async function openPaymentLink(
  db: SupabaseClient,
  input: OpenPaymentLinkInput,
): Promise<PaymentLinkResult | { error: string }> {
  const { product, profileId, loginPhone, child, parent, health, actor } = input;
  const priced = staffOrderColumns(
    product,
    { discount: input.discount, manualCard: input.manualCard, freeReason: null },
    actor.id,
    { profileId, loginPhone, child, parent },
  );
  if (!priced.ok) return { error: priced.problem };
  const amount = priced.paid;
  const planName = orderPlanName(product.name_he, priced.columns);

  const { data: order, error: orderError } = (await typedFrom(db, "orders")
    .insert({
      ...priced.columns,
      status: "pending",
      payment_provider: "isracard",
      // Marks the order as a Payment link and names its seller once paid.
      payment_link_by: actor.id,
    })
    .select("id")
    .single()) as { data: { id: string } | null; error: { message: string } | null };
  if (orderError || !order) {
    console.error("[payment-link] order insert failed:", orderError?.message);
    return { error: "שגיאה ביצירת ההזמנה" };
  }

  const agreement = await insertUnsignedAgreement(db, {
    orderId: order.id,
    profileId,
    parent,
    child,
    health,
    planName,
    priceIls: amount,
    startsOn: israelToday(),
    paymentLabel: PAYMENT_METHOD_LABELS_HE.card,
  });
  if (!agreement) {
    await typedFrom(db, "orders").update({ status: "failed" }).eq("id", order.id);
    return { error: "שגיאה בשמירת ההסכם" };
  }
  const url = agreementLink(agreement.id);

  // None of these wait on each other. The newest link is the only one the
  // parent can pay: older unpaid links for this child (by account, or by
  // login phone before there is one) close, so two messages can never mean
  // two charges; one being charged right now (charging) is left to finish.
  // A new trainee has no account to log against yet; the order names who
  // sent the link.
  const [{ error: supersedeError }, , sent] = await Promise.all([
    typedFrom(db, "orders")
      .update({ status: "failed", fulfillment_error: "replaced by a newer Payment link" })
      .or(sameTraineeOrders(loginPhone, profileId))
      .not("payment_link_by", "is", null)
      .in("status", ["pending", "expired"])
      .neq("id", order.id),
    profileId
      ? db.from("activity_logs").insert({
          user_id: profileId,
          action: "payment_link_created",
          actor_id: actor.id,
          actor_name: actor.name ?? "צוות",
          metadata: {
            orderId: order.id,
            productId: product.id,
            amountIls: amount,
            ...(input.discount ? { listPriceIls: priced.listPrice } : {}),
            ...(input.manualCard ? { manualCard: input.manualCard } : {}),
          },
        })
      : null,
    input.sendWhatsApp
      ? sendPaymentLink(parent.phone, {
          parentName: parent.name,
          childName: child.name,
          planName,
          amount: `₪${amount.toLocaleString("he-IL")}`,
          url,
        })
      : null,
  ]);
  if (supersedeError) console.error("[payment-link] closing older links failed:", supersedeError.message);
  const whatsapp: PaymentLinkResult["whatsapp"] = !sent
    ? { sentTo: null, error: null, skipped: true }
    : sent.success
      ? { sentTo: parent.phone, error: null, skipped: false }
      : {
          sentTo: null,
          // An unset template means Meta has not approved it yet: say so in Hebrew.
          error: sent.error?.includes("not configured") ? "תבנית הוואטסאפ לקישור עוד לא אושרה" : "השליחה נכשלה",
          skipped: false,
        };

  revalidateStaffSurfaces(profileId);
  return { ok: true, orderId: order.id, url, whatsapp };
}
