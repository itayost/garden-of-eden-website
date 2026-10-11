"use server";

import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { assertTraineeInScope } from "@/lib/actions/shared/assert-trainee";
import { createAdminClient } from "@/lib/supabase/admin";
import { onlinePaymentsOpen } from "@/lib/payments/online-payments";
import {
  newTraineeLinkSchema,
  paymentLinkSchema,
  type NewTraineeLinkInput,
  type PaymentLinkInput,
} from "@/lib/validations/plans-admin";
import { pricingRefusal } from "../discount-permission";
import { openPaymentLink, type PaymentLinkResult } from "../open-payment-link";
import { checkNewTraineeSale, checkTraineeSale, saleParties } from "../trainee-sale";

export type { PaymentLinkResult } from "../open-payment-link";

const CARD_CLOSED_MESSAGE = "תשלום באשראי באתר עוד לא פתוח. אפשר לרשום מזומן, העברה או ביט.";

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
  if (!onlinePaymentsOpen()) return { error: CARD_CLOSED_MESSAGE };

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
      manualCard: data.manualCard !== null,
    }),
  ]);
  if (scopeError) return { error: scopeError };
  if (!("ok" in sale)) return "error" in sale ? sale : { error: "קלט לא תקין" };
  const { product, trainee } = sale;

  const discountError = await pricingRefusal(product.branch_id, data.discount !== null || data.manualCard !== null);
  if (discountError) return { error: discountError };
  const { loginPhone, child, parent, health } = saleParties(trainee);
  return openPaymentLink(db, {
    product,
    profileId: data.traineeId,
    loginPhone,
    child,
    parent,
    health,
    sendWhatsApp: data.sendWhatsApp,
    discount: data.discount,
    manualCard: data.manualCard,
    actor: { id: user!.id, name: staff?.full_name ?? null },
  });
}

/**
 * A Payment link for a new trainee at the field. No account is opened until
 * the card is charged: fulfillment then finds the trainee on the login phone
 * or creates one, as for a sale on /join. A phone that already belongs to a
 * trainee binds the link to that account.
 */
export async function createNewTraineePaymentLinkAction(
  input: NewTraineeLinkInput,
): Promise<PaymentLinkResult | { error: string }> {
  const { error: authError, user, profile: staff } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };
  const parsed = newTraineeLinkSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "קלט לא תקין" };
  const data = parsed.data;
  if (!onlinePaymentsOpen()) return { error: CARD_CLOSED_MESSAGE };

  const db = createAdminClient();
  const sale = await checkNewTraineeSale(db, {
    productId: data.productId,
    loginPhone: data.loginPhone,
    setsPrice: data.discount !== null,
  });
  if (!("ok" in sale)) return sale;
  const { product, owner } = sale;

  return openPaymentLink(db, {
    product,
    profileId: owner?.id ?? null,
    loginPhone: data.loginPhone,
    child: { name: data.childName, birthdate: owner?.birthdate ?? null },
    parent: { name: data.parentName ?? "הורה", phone: data.payerPhone, email: null },
    health: { medicalNotes: null, emergencyContactName: null, emergencyContactPhone: null },
    sendWhatsApp: data.sendWhatsApp,
    discount: data.discount,
    manualCard: null,
    actor: { id: user!.id, name: staff?.full_name ?? null },
  });
}
