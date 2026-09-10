"use server";

import { revalidatePath } from "next/cache";
import { verifyAdmin } from "@/lib/actions/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { israelToday } from "@/lib/utils/tasks";
import { addDays } from "@/lib/utils/iso-date";
import { isValidUUID } from "@/lib/validations/common";
import {
  addSessionsSchema,
  cancelPlanSchema,
  extendPlanSchema,
  manualGrantSchema,
  PAYMENT_METHOD_LABELS_HE,
  type ManualGrantInput,
} from "@/lib/validations/plans-admin";
import { fulfillFromInput } from "@/features/enrollment/lib/fulfillment";
import { notifyOrderFulfilled } from "@/features/enrollment/lib/notify";
import type { EnrollmentAgreement, Order, PlanProduct, PlanStatus } from "@/types/plans";
import { loadPlansWithUsage, type PlanWithUsage } from "../queries";

type ActionResult = { success: true } | { error: string };

export type AdminPlanRow = PlanWithUsage & {
  traineeName: string;
  guardianName: string | null;
  guardianPhone: string | null;
  orderDocumentUrl: string | null;
};

function revalidatePlanSurfaces(profileId?: string): void {
  revalidatePath("/admin/plans");
  revalidatePath("/admin/users");
  if (profileId) revalidatePath(`/admin/users/${profileId}`);
}

/** Every plan in one branch (or all), newest ending first. */
export async function listPlansAction(filter: {
  branchId?: string;
  status?: PlanStatus;
}): Promise<AdminPlanRow[]> {
  const { error } = await verifyAdmin();
  if (error) return [];

  const db = createAdminClient();
  let query = typedFrom(db, "trainee_plans").select("profile_id, branch_id");
  if (filter.branchId && isValidUUID(filter.branchId)) {
    query = query.eq("branch_id", filter.branchId);
  }
  const { data: rows } = (await query) as { data: { profile_id: string }[] | null };
  const profileIds = Array.from(new Set((rows ?? []).map((r) => r.profile_id)));

  const [plans, { data: profiles }] = await Promise.all([
    loadPlansWithUsage(db, profileIds, israelToday()),
    db.from("profiles").select("id, full_name, guardian_name, guardian_phone").in("id", profileIds),
  ]);
  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]));

  const orderIds = [...plans.values()]
    .map((p) => p.plan.order_id)
    .filter((id): id is string => id !== null);
  const { data: orders } = (orderIds.length
    ? await typedFrom(db, "orders").select("id, morning_document_url").in("id", orderIds)
    : { data: [] }) as { data: Pick<Order, "id" | "morning_document_url">[] | null };
  const docByOrder = new Map((orders ?? []).map((o) => [o.id, o.morning_document_url]));

  return [...plans.entries()]
    .map(([profileId, withUsage]) => {
      const profile = profileById.get(profileId);
      return {
        ...withUsage,
        traineeName: profile?.full_name ?? "ללא שם",
        guardianName: profile?.guardian_name ?? null,
        guardianPhone: profile?.guardian_phone ?? null,
        orderDocumentUrl: withUsage.plan.order_id
          ? (docByOrder.get(withUsage.plan.order_id) ?? null)
          : null,
      };
    })
    .filter((row) => !filter.status || row.status === filter.status)
    .sort((a, b) => (a.plan.ends_on < b.plan.ends_on ? 1 : -1));
}

export async function extendPlanAction(input: {
  planId: string;
  endsOn: string;
}): Promise<ActionResult> {
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };
  const parsed = extendPlanSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "קלט לא תקין" };

  const db = createAdminClient();
  const { data, error } = await typedFrom(db, "trainee_plans")
    .update({ ends_on: parsed.data.endsOn })
    .eq("id", parsed.data.planId)
    .select("profile_id");
  if (error || !data?.length) return { error: "המסלול לא נמצא" };
  revalidatePlanSurfaces(data[0].profile_id);
  return { success: true };
}

export async function addSessionsAction(input: {
  planId: string;
  sessions: number;
}): Promise<ActionResult> {
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };
  const parsed = addSessionsSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "קלט לא תקין" };

  const db = createAdminClient();
  const { data: plan } = (await typedFrom(db, "trainee_plans")
    .select("profile_id, sessions_total")
    .eq("id", parsed.data.planId)
    .maybeSingle()) as { data: { profile_id: string; sessions_total: number | null } | null };
  if (!plan) return { error: "המסלול לא נמצא" };
  if (plan.sessions_total === null) return { error: "למסלול לפי זמן אין מונה אימונים" };

  const { error } = await typedFrom(db, "trainee_plans")
    .update({ sessions_total: plan.sessions_total + parsed.data.sessions })
    .eq("id", parsed.data.planId);
  if (error) return { error: "שגיאה בעדכון המסלול" };
  revalidatePlanSurfaces(plan.profile_id);
  return { success: true };
}

export async function cancelPlanAction(input: { planId: string }): Promise<ActionResult> {
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };
  const parsed = cancelPlanSchema.safeParse(input);
  if (!parsed.success) return { error: "מזהה לא תקין" };

  const db = createAdminClient();
  const { data, error } = await typedFrom(db, "trainee_plans")
    .update({ status: "cancelled" })
    .eq("id", parsed.data.planId)
    .select("profile_id");
  if (error || !data?.length) return { error: "המסלול לא נמצא" };
  revalidatePlanSurfaces(data[0].profile_id);
  return { success: true };
}

/**
 * A plan for someone who paid in cash or by transfer. Builds a paid order
 * with source manual and runs the same fulfillment as an online payment, so
 * the account, branch link, and confirmation are identical. Manual grants
 * do not check once_per_trainee: Eden decides.
 */
export async function grantPlanAction(input: ManualGrantInput): Promise<ActionResult> {
  const { error: authError, user, adminProfile } = await verifyAdmin();
  if (authError) return { error: authError };
  const parsed = manualGrantSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "קלט לא תקין" };
  const data = parsed.data;

  const db = createAdminClient();
  const { data: product } = (await typedFrom(db, "plan_products")
    .select("*")
    .eq("id", data.productId)
    .maybeSingle()) as { data: PlanProduct | null };
  if (!product) return { error: "המסלול לא נמצא" };

  const { data: order, error: orderError } = (await typedFrom(db, "orders")
    .insert({
      product_id: product.id,
      branch_id: product.branch_id,
      status: "paid",
      paid_at: new Date().toISOString(),
      amount_ils: product.price_ils,
      parent_name: data.parentName,
      payer_phone: data.payerPhone,
      login_phone: data.loginPhone,
      child_name: data.childName,
      child_birthdate: data.childBirthdate,
      email: data.email,
    })
    .select("*")
    .single()) as { data: Order | null; error: { message: string } | null };
  if (orderError || !order) return { error: "שגיאה ביצירת ההזמנה" };

  // The agreement row records who entered it and how they paid; the ID number
  // stays empty because Eden holds the paper form.
  const { data: agreement } = (await typedFrom(db, "enrollment_agreements")
    .insert({
      order_id: order.id,
      agreement_version: "manual",
      parent_name: data.parentName,
      parent_id_number: "",
      parent_phone: data.payerPhone,
      parent_email: data.email,
      child_name: data.childName,
      child_birthdate: data.childBirthdate,
      medical_notes: data.medicalNotes,
      plan_name: product.name_he,
      plan_price_ils: product.price_ils,
      plan_start_on: data.startsOn,
      payment_method: PAYMENT_METHOD_LABELS_HE[data.paymentMethod],
      emergency_contact_name: data.emergencyContactName ?? "",
      emergency_contact_phone: data.emergencyContactPhone ?? "",
      declares_healthy: true,
      accepts_terms: true,
      authorizes_payment: true,
      photo_consent: false,
      signature_name: `${adminProfile?.full_name ?? "מנהל"} (הרשמה ידנית)`,
    })
    .select("*")
    .single()) as { data: EnrollmentAgreement | null };

  const result = await fulfillFromInput(db, {
    order: { ...order, amount_ils: Number(order.amount_ils) },
    product: { ...product, price_ils: Number(product.price_ils) },
    agreement,
    createdBy: user!.id,
  });
  if (!result.ok) return { error: `ההזמנה נשמרה אך היצירה נכשלה: ${result.error}` };

  // A manual start date other than today: fix the window after fulfillment.
  const patch =
    data.startsOn !== israelToday()
      ? {
          starts_on: data.startsOn,
          ends_on: addDays(data.startsOn, product.duration_days - 1),
          note: data.note,
        }
      : { note: data.note };
  await typedFrom(db, "trainee_plans").update(patch).eq("id", result.planId);

  await notifyOrderFulfilled(db, order.id);
  revalidatePlanSurfaces(result.profileId);
  return { success: true };
}
