"use server";

import { revalidatePath } from "next/cache";
import { waitUntil } from "@vercel/functions";
import { checkRateLimit } from "@/lib/rate-limit";
import { getBranchScopeAction, verifyAdminOrTrainer } from "@/lib/actions/shared";
import { assertBranchWritable } from "@/lib/actions/shared/assert-branch";
import { assertTraineeInScope } from "@/lib/actions/shared/assert-trainee";
import { isInBranchScope } from "@/lib/branches/branch-scope";
import { loadBranchIdsByProfile } from "@/features/branches/lib/memberships";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { isMorningConfigured } from "@/lib/morning/config";
import { phoneVariants } from "@/lib/plans/phone-variants";
import { renewalStartDate } from "@/lib/plans/plan-status";
import { israelToday } from "@/lib/utils/tasks";
import { isValidUUID } from "@/lib/validations/common";
import { toE164 } from "@/lib/plans/local-phone";
import { isIntroPackEligible } from "@/lib/plans/eligibility";
import {
  newTraineeSchema,
  resendAgreementSchema,
  staffPaymentSchema,
  type NewTraineeInput,
  type StaffPaymentInput,
} from "@/lib/validations/plans-admin";
import { notifyOrderFulfilled } from "@/features/enrollment/lib/notify";
import type { EnrollmentAgreement, PlanProduct } from "@/types/plans";
import { findRecentDuplicate, recordManualPayment, type ManualPaymentResult } from "../manual-payment";
import { loadPlansWithUsage } from "../queries";

export type StaffPaymentOutcome =
  | ManualPaymentResult
  | { duplicate: { minutesAgo: number } }
  | { error: string };

export interface StaffPaymentContext {
  traineeName: string;
  products: PlanProduct[];
  currentProductId: string | null;
  /** What chaining will do. */
  startsOn: string;
  startsAfterCurrent: boolean;
  morningConfigured: boolean;
  parentPhone: string | null;
}

function revalidateStaffSurfaces(profileId: string): void {
  revalidatePath(`/admin/users/${profileId}`);
  revalidatePath("/admin/plans");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/schedule");
  revalidatePath("/admin/calendar");
}

/** Active products the caller may sell: their writable branches, optionally narrowed to the trainee's. */
async function sellableProducts(
  db: ReturnType<typeof createAdminClient>,
  traineeBranchIds: readonly string[] | null,
): Promise<PlanProduct[]> {
  const scopeResult = await getBranchScopeAction();
  if ("error" in scopeResult) return [];
  const scope = scopeResult.data.scope;
  const { data } = (await typedFrom(db, "plan_products")
    .select("*")
    .eq("is_active", true)
    .order("order_index")) as { data: PlanProduct[] | null };
  return (data ?? [])
    .filter((p) => isInBranchScope(scope, [p.branch_id]))
    .filter((p) => traineeBranchIds === null || traineeBranchIds.includes(p.branch_id))
    .map((p) => ({ ...p, price_ils: Number(p.price_ils) }));
}

/** Active products in the branches the caller may sell in, for the new-trainee sheet. */
export async function listSellableProductsAction(): Promise<PlanProduct[]> {
  const { error } = await verifyAdminOrTrainer();
  if (error) return [];
  return sellableProducts(createAdminClient(), null);
}

/** Everything the payment sheet needs to open for one trainee. Staff only, branch scoped. */
export async function getStaffPaymentContextAction(
  traineeId: string,
): Promise<StaffPaymentContext | { error: string }> {
  const { error: authError } = await verifyAdminOrTrainer();
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
  const [products, current] = await Promise.all([
    sellableProducts(db, memberships.get(traineeId) ?? []),
    loadPlansWithUsage(db, [traineeId], today).then((m) => m.get(traineeId) ?? null),
  ]);
  const running = current !== null && (current.status === "active" || current.status === "ending_soon");
  return {
    traineeName: profile.full_name ?? "מתאמן",
    products,
    currentProductId: current?.plan.product_id ?? null,
    startsOn: renewalStartDate(running ? current.plan.ends_on : null, today),
    startsAfterCurrent: running,
    morningConfigured: isMorningConfigured(),
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
  const { data: product } = (await typedFrom(db, "plan_products")
    .select("*")
    .eq("id", data.productId)
    .eq("is_active", true)
    .maybeSingle()) as { data: PlanProduct | null };
  if (!product) return { error: "המסלול לא נמצא או אינו פעיל" };
  const branchError = await assertBranchWritable(product.branch_id);
  if (branchError.error) return { error: branchError.error };
  // The sheet only offers the trainee's branches; the server holds trainers
  // to that too. An admin may sell into a new branch, which also enrolls.
  if (staff?.role !== "admin") {
    const memberships = (await loadBranchIdsByProfile(db, [data.traineeId])).get(data.traineeId) ?? [];
    if (!memberships.includes(product.branch_id)) return { error: "המסלול שייך לסניף שהמתאמן אינו רשום בו" };
  }

  const { data: trainee } = await db
    .from("profiles")
    .select("role, phone, full_name, birthdate, guardian_name, guardian_phone, medical_notes, emergency_contact_name, emergency_contact_phone")
    .eq("id", data.traineeId)
    .maybeSingle();
  if (!trainee || trainee.role !== "trainee") return { error: "אפשר לרשום תשלום רק למתאמן" };
  if (!trainee.phone) return { error: "למתאמן אין טלפון להתחברות. הוסיפו טלפון בפרופיל קודם." };

  if (product.once_per_trainee) {
    const { count } = await typedFrom(db, "orders")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", data.traineeId)
      .eq("status", "paid")
      .eq("product_id", product.id);
    if (!isIntroPackEligible(product, count ?? 0)) {
      return { error: "חבילת ההיכרות היא לשחקן חדש בלבד ונרכשה כבר. בחרו מסלול אחר." };
    }
  }

  if (!data.confirmDuplicate) {
    const duplicate = await findRecentDuplicate(db, data.traineeId, product.id);
    if (duplicate) return { duplicate };
  }

  const loginPhone = toE164(trainee.phone);
  const result = await recordManualPayment(db, {
    product: { ...product, price_ils: Number(product.price_ils) },
    trainee: {
      profileId: data.traineeId,
      loginPhone,
      childName: trainee.full_name ?? "מתאמן",
      childBirthdate: trainee.birthdate ?? null,
    },
    parent: {
      name: trainee.guardian_name ?? "הורה",
      phone: trainee.guardian_phone ? toE164(trainee.guardian_phone) : loginPhone,
      email: null,
    },
    health: {
      medicalNotes: trainee.medical_notes ?? null,
      emergencyContactName: trainee.emergency_contact_name ?? null,
      emergencyContactPhone: trainee.emergency_contact_phone ?? null,
    },
    paymentMethod: data.paymentMethod,
    reference: data.reference,
    startsOn: null,
    sendWhatsApp: data.sendWhatsApp,
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
  if (owner) {
    const scopeError = await assertTraineeInScope(owner.id);
    if (scopeError) return { error: scopeError };
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
): Promise<{ success: true; sentTo: string } | { error: string }> {
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
  if (!outcome.confirmed?.success) return { error: outcome.confirmed?.error ?? "השליחה נכשלה" };
  return { success: true, sentTo: outcome.sentTo ?? "" };
}
