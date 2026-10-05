"use server";

import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { assertTraineeInScope } from "@/lib/actions/shared/assert-trainee";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { discountProblem } from "@/lib/plans/discount";
import { toE164 } from "@/lib/plans/local-phone";
import { onlinePaymentsOpen } from "@/lib/payments/online-payments";
import { israelToday } from "@/lib/utils/tasks";
import { sendPaymentLink } from "@/lib/whatsapp/plan-templates";
import { paymentLinkSchema, type PaymentLinkInput } from "@/lib/validations/plans-admin";
import { agreementLink } from "@/features/enrollment/lib/notify";
import { PAYMENT_METHOD_LABELS_HE } from "@/types/plans";
import { discountRefusal } from "../discount-permission";
import { revalidateStaffSurfaces } from "../revalidate-staff";
import { checkTraineeSale } from "../trainee-sale";
import { insertUnsignedAgreement } from "../unsigned-agreement";

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

  const scopeError = await assertTraineeInScope(data.traineeId);
  if (scopeError) return { error: scopeError };

  const db = createAdminClient();
  // A link is not a sale yet, so a repeat is only a second link: no duplicate prompt.
  const sale = await checkTraineeSale(db, {
    traineeId: data.traineeId,
    productId: data.productId,
    isAdmin: staff?.role === "admin",
    confirmDuplicate: true,
  });
  if (!("ok" in sale)) return "error" in sale ? sale : { error: "קלט לא תקין" };
  const { product, trainee } = sale;

  const listPrice = Number(product.price_ils);
  const discountError =
    (await discountRefusal(product.branch_id, data.discount)) ??
    (data.discount ? discountProblem(listPrice, data.discount.amountIls) : null);
  if (discountError) return { error: discountError };
  const amount = data.discount?.amountIls ?? listPrice;

  const loginPhone = toE164(trainee.phone);
  const parent = {
    name: trainee.guardian_name ?? "הורה",
    phone: trainee.guardian_phone ? toE164(trainee.guardian_phone) : loginPhone,
    email: null,
  };
  const { data: order, error: orderError } = (await typedFrom(db, "orders")
    .insert({
      product_id: product.id,
      branch_id: product.branch_id,
      status: "pending",
      payment_provider: "isracard",
      amount_ils: amount,
      list_price_ils: data.discount ? listPrice : null,
      discount_reason: data.discount?.reason ?? null,
      discounted_by: data.discount ? user!.id : null,
      parent_name: parent.name,
      payer_phone: parent.phone,
      login_phone: loginPhone,
      child_name: trainee.full_name ?? "מתאמן",
      child_birthdate: trainee.birthdate ?? null,
      email: null,
      profile_id: data.traineeId,
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
    child: { name: trainee.full_name ?? "מתאמן", birthdate: trainee.birthdate ?? null },
    health: {
      medicalNotes: trainee.medical_notes ?? null,
      emergencyContactName: trainee.emergency_contact_name ?? null,
      emergencyContactPhone: trainee.emergency_contact_phone ?? null,
    },
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

  await db.from("activity_logs").insert({
    user_id: data.traineeId,
    action: "payment_link_created",
    actor_id: user!.id,
    actor_name: staff?.full_name ?? "צוות",
    metadata: { orderId: order.id, productId: product.id, amountIls: amount, ...(data.discount ? { listPriceIls: listPrice } : {}) },
  });

  let whatsapp: PaymentLinkResult["whatsapp"] = { sentTo: null, error: null, skipped: true };
  if (data.sendWhatsApp) {
    const sent = await sendPaymentLink(parent.phone, {
      parentName: parent.name,
      childName: trainee.full_name ?? "",
      planName: product.name_he,
      amount: `₪${amount.toLocaleString("he-IL")}`,
      url,
    });
    whatsapp = sent.success
      ? { sentTo: parent.phone, error: null, skipped: false }
      : { sentTo: null, error: sent.error ?? "שליחה נכשלה", skipped: false };
  }

  revalidateStaffSurfaces(data.traineeId);
  return { ok: true, orderId: order.id, url, whatsapp };
}
