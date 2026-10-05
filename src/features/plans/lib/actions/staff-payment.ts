"use server";

import { revalidatePath } from "next/cache";
import { waitUntil } from "@vercel/functions";
import { checkRateLimit } from "@/lib/rate-limit";
import { getBranchScopeAction, verifyAdminOrTrainer } from "@/lib/actions/shared";
import { assertBranchWritable } from "@/lib/actions/shared/assert-branch";
import { assertTraineeInScope } from "@/lib/actions/shared/assert-trainee";
import { canManageBranches, isInBranchScope } from "@/lib/branches/branch-scope";
import { loadBranchIdsByProfile } from "@/features/branches/lib/memberships";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { isMorningConfigured } from "@/lib/morning/config";
import { onlinePaymentsOpen } from "@/lib/payments/online-payments";
import { phoneVariants } from "@/lib/plans/phone-variants";
import { placeNewPlan, resolvePlanQueue } from "@/lib/plans/plan-queue";
import { israelToday } from "@/lib/utils/tasks";
import { isValidUUID } from "@/lib/validations/common";
import {
  newTraineeSchema,
  resendAgreementSchema,
  staffPaymentSchema,
  type NewTraineeInput,
  type StaffPaymentInput,
} from "@/lib/validations/plans-admin";
import { notifyOrderFulfilled } from "@/features/enrollment/lib/notify";
import type { EnrollmentAgreement, PlanProduct } from "@/types/plans";
import { discountRefusal } from "../discount-permission";
import { findRecentDuplicate, recordManualPayment, type ManualPaymentResult } from "../manual-payment";
import { revalidateStaffSurfaces } from "../revalidate-staff";
import { checkTraineeSale, introPackRefusal, saleParties } from "../trainee-sale";
import { startDateProblem, latestStartDate } from "@/lib/plans/start-date";
import { hasPlansAhead, loadQueueRows, loadStoredPlans } from "../queries";

export type StaffPaymentOutcome =
  | ManualPaymentResult
  | { duplicate: { minutesAgo: number } }
  | { error: string };

/**
 * A product the caller may sell. managed: the caller is an Admin or the
 * branch's manager, so may also give a Discount or record an Arbox repair.
 */
export type SellableProduct = PlanProduct & { managed: boolean };

export interface StaffPaymentContext {
  traineeName: string;
  products: SellableProduct[];
  currentProductId: string | null;
  /** Where a Plan sold now lands in the queue: at the latest, when a Card ahead may run out sooner. */
  startsOn: string;
  /** A paid Plan is current or queued, so the new one waits behind it. */
  startsAfterCurrent: boolean;
  /** Israel today: the earliest start staff may choose. */
  today: string;
  /** The last start day staff may choose when nothing is current or queued. */
  latestStartOn: string;
  /** A Card ahead can run out before its date, which brings the start forward. */
  startsWhenCardRunsOut: boolean;
  morningConfigured: boolean;
  /** Online card payments are open, so staff may send a Payment link. */
  cardLinksOpen: boolean;
  parentPhone: string | null;
}

/** Active products the caller may sell: their writable branches, optionally narrowed to the trainee's. */
async function sellableProducts(
  db: ReturnType<typeof createAdminClient>,
  traineeBranchIds: readonly string[] | null,
  role: string,
): Promise<SellableProduct[]> {
  const [scopeResult, { data }] = await Promise.all([
    getBranchScopeAction(),
    typedFrom(db, "plan_products").select("*").eq("is_active", true).order("order_index") as unknown as Promise<{
      data: PlanProduct[] | null;
    }>,
  ]);
  if ("error" in scopeResult) return [];
  const { scope, managedBranchIds } = scopeResult.data;
  return (data ?? [])
    .filter((p) => isInBranchScope(scope, [p.branch_id]))
    .filter((p) => traineeBranchIds === null || traineeBranchIds.includes(p.branch_id))
    .map((p) => ({
      ...p,
      price_ils: Number(p.price_ils),
      managed: canManageBranches(role, managedBranchIds, [p.branch_id]),
    }));
}



/** Active products in the branches the caller may sell in, for the new-trainee sheet. */
export async function listSellableProductsAction(): Promise<SellableProduct[]> {
  const { error, profile } = await verifyAdminOrTrainer();
  if (error) return [];
  return sellableProducts(createAdminClient(), null, profile!.role);
}

/** Everything the payment sheet needs to open for one trainee. Staff only, branch scoped. */
export async function getStaffPaymentContextAction(
  traineeId: string,
): Promise<StaffPaymentContext | { error: string }> {
  const { error: authError, profile: staff } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };
  if (!isValidUUID(traineeId)) return { error: "מזהה לא תקין" };
  const scopeError = await assertTraineeInScope(traineeId);
  if (scopeError) return { error: scopeError };

  const db = createAdminClient();
  const [{ data: profile }, memberships] = await Promise.all([
    db.from("profiles").select("full_name, guardian_phone, phone").eq("id", traineeId).maybeSingle(),
    loadBranchIdsByProfile(db, [traineeId]),
  ]);
  if (!profile) return { error: "המתאמן לא נמצא" };

  const today = israelToday();
  const [products, plansByProfile, rowsByProfile] = await Promise.all([
    sellableProducts(db, memberships.get(traineeId) ?? [], staff!.role),
    loadStoredPlans(db, [traineeId]),
    loadQueueRows(db, [traineeId]),
  ]);
  const plans = plansByProfile.get(traineeId) ?? [];
  const rows = rowsByProfile.get(traineeId) ?? [];
  const queue = resolvePlanQueue(plans, rows, today);
  const { ahead } = queue;
  const probe = {
    kind: "subscription" as const,
    branchId: ahead.at(-1)?.plan.branchId ?? "",
    sessionsTotal: null,
    durationDays: 1,
    notBefore: today,
    fixedEndsOn: null,
  };
  return {
    traineeName: profile.full_name ?? "מתאמן",
    products,
    currentProductId: queue.shown?.plan.product_id ?? null,
    startsOn: placeNewPlan(plans, rows, probe, today).startsOn,
    startsAfterCurrent: ahead.length > 0,
    today,
    latestStartOn: latestStartDate(today),
    startsWhenCardRunsOut: ahead.some((e) => e.sessionsLeft !== null && e.endsOn === e.expiresOn),
    morningConfigured: isMorningConfigured(),
    cardLinksOpen: onlinePaymentsOpen(),
    parentPhone: profile.guardian_phone ?? profile.phone ?? null,
  };
}

/** A cash, transfer, or Bit payment for a trainee who already has an account. */
export async function recordTraineePaymentAction(input: StaffPaymentInput): Promise<StaffPaymentOutcome> {
  const { error: authError, user, profile: staff } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };
  const parsed = staffPaymentSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "קלט לא תקין" };
  const data = parsed.data;

  const scopeError = await assertTraineeInScope(data.traineeId);
  if (scopeError) return { error: scopeError };

  const db = createAdminClient();
  const sale = await checkTraineeSale(db, {
    traineeId: data.traineeId,
    productId: data.productId,
    isAdmin: staff?.role === "admin",
    confirmDuplicate: data.confirmDuplicate,
  });
  if (!("ok" in sale)) return sale;
  const { product, trainee } = sale;
  // Only a later start for a training Plan needs the queue; fulfillment
  // enforces the rule again where the Plan is placed.
  const today = israelToday();
  const needsQueue = data.startsOn !== null && data.startsOn !== today && product.kind !== "addon";
  const startProblem = startDateProblem(
    data.startsOn,
    today,
    needsQueue ? await hasPlansAhead(db, data.traineeId, today) : false,
  );
  if (startProblem) return { error: startProblem };
  const discountError = await discountRefusal(product.branch_id, data.discount);
  if (discountError) return { error: discountError };

  const parties = saleParties(trainee);
  const result = await recordManualPayment(db, {
    product,
    trainee: {
      profileId: data.traineeId,
      loginPhone: parties.loginPhone,
      childName: parties.child.name,
      childBirthdate: parties.child.birthdate,
    },
    parent: parties.parent,
    health: parties.health,
    paymentMethod: data.paymentMethod,
    reference: data.reference,
    startsOn: data.startsOn,
    sendWhatsApp: data.sendWhatsApp,
    discount: data.discount,
    actor: { id: user!.id, name: staff?.full_name ?? null },
  });
  if (!result.ok) return { error: result.error };
  revalidateStaffSurfaces(result.profileId);
  return result;
}

/**
 * A new trainee signed up at the field. Staff enter the child, two phones,
 * the product, and how it was paid; the parent completes the rest when
 * signing. An existing account for that phone is reused, never a staff one.
 */
export async function createTraineeWithPaymentAction(input: NewTraineeInput): Promise<StaffPaymentOutcome> {
  const { error: authError, user, profile: staff } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };
  const parsed = newTraineeSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "קלט לא תקין" };
  const data = parsed.data;

  const db = createAdminClient();
  const { data: product } = (await typedFrom(db, "plan_products")
    .select("*")
    .eq("id", data.productId)
    .eq("is_active", true)
    .maybeSingle()) as { data: PlanProduct | null };
  if (!product) return { error: "המסלול לא נמצא או אינו פעיל" };
  const branchError = await assertBranchWritable(product.branch_id);
  if (branchError.error) return { error: branchError.error };

  const { data: owner } = await db
    .from("profiles")
    .select("id, role, birthdate")
    .in("phone", phoneVariants(data.loginPhone))
    .is("deleted_at", null)
    .limit(1)
    .maybeSingle();
  if (owner && owner.role !== "trainee") return { error: "מספר הטלפון שייך לחשבון צוות" };
  // The date's bounds hold for everyone. For an existing trainee with a Plan
  // current or queued, fulfillment lets the queue decide instead.
  const startProblem = startDateProblem(data.startsOn, israelToday(), false);
  if (startProblem) return { error: startProblem };
  const discountError = await discountRefusal(product.branch_id, data.discount);
  if (discountError) return { error: discountError };
  if (owner) {
    const scopeError = await assertTraineeInScope(owner.id);
    if (scopeError) return { error: scopeError };
    // An existing phone is a sale to that trainee: the intro pack is still once only.
    const introRefusal = await introPackRefusal(db, owner.id, product);
    if (introRefusal) return { error: introRefusal };
    if (!data.confirmDuplicate) {
      const duplicate = await findRecentDuplicate(db, owner.id, product.id);
      if (duplicate) return { duplicate };
    }
  }

  const result = await recordManualPayment(db, {
    product: { ...product, price_ils: Number(product.price_ils) },
    trainee: {
      profileId: owner?.id ?? null,
      loginPhone: data.loginPhone,
      childName: data.childName,
      childBirthdate: owner?.birthdate ?? null,
    },
    parent: { name: data.parentName ?? "הורה", phone: data.payerPhone, email: null },
    health: { medicalNotes: null, emergencyContactName: null, emergencyContactPhone: null },
    paymentMethod: data.paymentMethod,
    reference: data.reference,
    startsOn: data.startsOn,
    sendWhatsApp: data.sendWhatsApp,
    discount: data.discount,
    actor: { id: user!.id, name: staff?.full_name ?? null },
  });
  if (!result.ok) return { error: result.error };
  revalidateStaffSurfaces(result.profileId);
  revalidatePath("/admin/users");
  return result;
}

/** Re-sends the confirmation with the signing link for an agreement the parent has not signed. */
export async function resendAgreementLinkAction(
  agreementId: string,
): Promise<{ success: true; sentTo: string } | { shareUrl: string } | { error: string }> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };
  const parsed = resendAgreementSchema.safeParse({ agreementId });
  if (!parsed.success) return { error: "מזהה לא תקין" };

  const db = createAdminClient();
  const { data: agreement } = (await typedFrom(db, "enrollment_agreements")
    .select("id, order_id, profile_id, signed_at")
    .eq("id", agreementId)
    .maybeSingle()) as { data: Pick<EnrollmentAgreement, "id" | "order_id" | "profile_id" | "signed_at"> | null };
  if (!agreement || !agreement.order_id || !agreement.profile_id) return { error: "ההסכם לא נמצא" };
  if (agreement.signed_at) return { error: "ההסכם כבר נחתם" };
  const scopeError = await assertTraineeInScope(agreement.profile_id);
  if (scopeError) return { error: scopeError };
  // One message per agreement per few minutes: a double tap is not two WhatsApps.
  const limit = await checkRateLimit(`resend:${agreementId}`, "checkout");
  waitUntil(limit.pending);
  if (limit.rateLimited) return { error: "הקישור נשלח לפני רגע. נסו שוב בעוד כמה דקות." };

  const outcome = await notifyOrderFulfilled(db, agreement.order_id);
  // Until Meta approves the template, staff send it from their own WhatsApp.
  if (outcome.shareUrl) return { shareUrl: outcome.shareUrl };
  if (!outcome.confirmed?.success) return { error: "השליחה נכשלה" };
  return { success: true, sentTo: outcome.sentTo ?? "" };
}
