import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { assertBranchWritable } from "@/lib/actions/shared/assert-branch";
import { loadBranchIdsByProfile } from "@/features/branches/lib/memberships";
import { typedFrom } from "@/lib/supabase/helpers";
import { isIntroPackEligible } from "@/lib/plans/eligibility";
import type { PlanProduct } from "@/types/plans";
import { findRecentDuplicate } from "./manual-payment";

export interface SaleTrainee {
  phone: string;
  full_name: string | null;
  birthdate: string | null;
  guardian_name: string | null;
  guardian_phone: string | null;
  medical_notes: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
}

export type TraineeSaleCheck =
  | { ok: true; product: PlanProduct; trainee: SaleTrainee }
  | { error: string }
  | { duplicate: { minutesAgo: number } };

/**
 * Every rule a staff sale to an existing trainee must pass, whatever the
 * money was: the product is live and in a branch the caller may write, a
 * trainer sells only into the trainee's own branch, the account is a trainee
 * with a login phone, the intro pack is sold once, and a repeat within
 * minutes is confirmed first. The caller has already checked auth and scope.
 */
export async function checkTraineeSale(
  db: SupabaseClient,
  input: { traineeId: string; productId: string; isAdmin: boolean; confirmDuplicate: boolean },
): Promise<TraineeSaleCheck> {
  const { data: product } = (await typedFrom(db, "plan_products")
    .select("*")
    .eq("id", input.productId)
    .eq("is_active", true)
    .maybeSingle()) as { data: PlanProduct | null };
  if (!product) return { error: "המסלול לא נמצא או אינו פעיל" };
  const branchError = await assertBranchWritable(product.branch_id);
  if (branchError.error) return { error: branchError.error };
  // The sheet only offers the trainee's branches; the server holds trainers
  // to that too. An admin may sell into a new branch, which also enrolls.
  if (!input.isAdmin) {
    const memberships = (await loadBranchIdsByProfile(db, [input.traineeId])).get(input.traineeId) ?? [];
    if (!memberships.includes(product.branch_id)) return { error: "המסלול שייך לסניף שהמתאמן אינו רשום בו" };
  }

  const { data: trainee } = await db
    .from("profiles")
    .select("role, phone, full_name, birthdate, guardian_name, guardian_phone, medical_notes, emergency_contact_name, emergency_contact_phone")
    .eq("id", input.traineeId)
    .maybeSingle();
  if (!trainee || trainee.role !== "trainee") return { error: "אפשר לרשום תשלום רק למתאמן" };
  if (!trainee.phone) return { error: "למתאמן אין טלפון להתחברות. הוסיפו טלפון בפרופיל קודם." };

  if (product.once_per_trainee) {
    const { count } = await typedFrom(db, "orders")
      .select("id", { count: "exact", head: true })
      .eq("profile_id", input.traineeId)
      .eq("status", "paid")
      .eq("product_id", product.id);
    if (!isIntroPackEligible(product, count ?? 0)) {
      return { error: "חבילת ההיכרות היא לשחקן חדש בלבד ונרכשה כבר. בחרו מסלול אחר." };
    }
  }

  if (!input.confirmDuplicate) {
    const duplicate = await findRecentDuplicate(db, input.traineeId, product.id);
    if (duplicate) return { duplicate };
  }

  return {
    ok: true,
    product: { ...product, price_ils: Number(product.price_ils) },
    trainee: { ...trainee, phone: trainee.phone },
  };
}
