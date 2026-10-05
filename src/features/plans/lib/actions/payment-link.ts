"use server";

import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { assertTraineeInScope } from "@/lib/actions/shared/assert-trainee";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { onlinePaymentsOpen } from "@/lib/payments/online-payments";
import { israelToday } from "@/lib/utils/tasks";
import { sendPaymentLink } from "@/lib/whatsapp/plan-templates";
import { paymentLinkSchema, type PaymentLinkInput } from "@/lib/validations/plans-admin";
import { agreementLink } from "@/features/enrollment/lib/notify";
import { PAYMENT_METHOD_LABELS_HE } from "@/types/plans";
import { discountRefusal } from "../discount-permission";
import { revalidateStaffSurfaces } from "../revalidate-staff";
import { checkTraineeSale, saleParties } from "../trainee-sale";
import { insertUnsignedAgreement } from "../unsigned-agreement";
import { staffOrderColumns } from "../staff-order";

export interface PaymentLinkResult {
  ok: true;
  orderId: string;
  /** The parent's link: the agreement to sign, then the card page. */
  url: string;
  whatsapp: { sentTo: string | null; error: string | null; skipped: boolean };
}

/**
 * A Payment link: a pending card order bound to this Trainee at a fixed
 * amount (a Discount for Admins and the branch's manager), with an agreement
 * for the parent to sign before the card page. It becomes a sale only when
 * the charge completes; unpaid, it expires like any pending order.
 */
export async function createPaymentLinkAction(input: PaymentLinkInput): Promise<PaymentLinkResult | { error: string }> {
  const { error: authError, user, profile: staff } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };
  const parsed = paymentLinkSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "קלט לא תקין" };
  const data = parsed.data;
  if (!onlinePaymentsOpen()) return { error: "תשלום באשראי באתר עוד לא פתוח. אפשר לרשום מזומן, העברה או ביט." };

  const db = createAdminClient();
  // Both must pass. A link is not a sale yet, so a repeat is only a second
  // link: no duplicate prompt.
  const [scopeError, sale] = await Promise.all([
    assertTraineeInScope(data.traineeId),
    checkTraineeSale(db, {
      traineeId: data.traineeId,
      productId: data.productId,
      isAdmin: staff?.role === "admin",
      confirmDuplicate: true,
    }),
  ]);
  if (scopeError) return { error: scopeError };
  if (!("ok" in sale)) return "error" in sale ? sale : { error: "קלט לא תקין" };
  const { product, trainee } = sale;

  const discountError = await discountRefusal(product.branch_id, data.discount);
  if (discountError) return { error: discountError };
  const { loginPhone, child, parent, health } = saleParties(trainee);
  const priced = staffOrderColumns(product, data.discount, user!.id, { profileId: data.traineeId, loginPhone, child, parent });
  if (!priced.ok) return { error: priced.problem };
  const amount = priced.paid;

  const { data: order, error: orderError } = (await typedFrom(db, "orders")
    .insert({
      ...priced.columns,
      status: "pending",
      payment_provider: "isracard",
      // Marks the order as a Payment link and names its seller once paid.
      payment_link_by: user!.id,
    })
    .select("id")
    .single()) as { data: { id: string } | null; error: { message: string } | null };
  if (orderError || !order) {
    console.error("[payment-link] order insert failed:", orderError?.message);
    return { error: "שגיאה ביצירת ההזמנה" };
  }

  const agreement = await insertUnsignedAgreement(db, {
    orderId: order.id,
    profileId: data.traineeId,
    parent,
    child,
    health,
    planName: product.name_he,
    priceIls: amount,
    startsOn: israelToday(),
    paymentLabel: PAYMENT_METHOD_LABELS_HE.card,
  });
  if (!agreement) {
    await typedFrom(db, "orders").update({ status: "failed" }).eq("id", order.id);
    return { error: "שגיאה בשמירת ההסכם" };
  }
  const url = agreementLink(agreement.id);

  // The log and the message do not wait on each other.
  const [, sent] = await Promise.all([
    db.from("activity_logs").insert({
      user_id: data.traineeId,
      action: "payment_link_created",
      actor_id: user!.id,
      actor_name: staff?.full_name ?? "צוות",
      metadata: { orderId: order.id, productId: product.id, amountIls: amount, ...(data.discount ? { listPriceIls: priced.listPrice } : {}) },
    }),
    data.sendWhatsApp
      ? sendPaymentLink(parent.phone, {
          parentName: parent.name,
          childName: child.name,
          planName: product.name_he,
          amount: `₪${amount.toLocaleString("he-IL")}`,
          url,
        })
      : null,
  ]);
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

  revalidateStaffSurfaces(data.traineeId);
  return { ok: true, orderId: order.id, url, whatsapp };
}
