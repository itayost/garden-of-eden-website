"use server";

import { phoneVariants } from "@/lib/plans/phone-variants";
import { planTokenSecret } from "@/lib/plans/token-secret";
import { headers } from "next/headers";
import { waitUntil } from "@vercel/functions";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { checkRateLimit } from "@/lib/rate-limit";
import { canPayOnline, PAYMENTS_CLOSED_MESSAGE } from "@/lib/payments/online-payments";
import { isIntroPackEligible } from "@/lib/plans/eligibility";
import { verifyRenewalToken } from "@/lib/plans/renewal-token";
import { bindRenewal, isActiveTrainee, sameTraineeOrders, usableAccount } from "@/lib/plans/bound-renewal";
import { israelToday } from "@/lib/utils/tasks";
import { enrollmentSchema, type EnrollmentInput } from "@/lib/validations/enrollment";
import { TERMS_VERSION } from "../../../../../content/terms-kiryat-ata";
import { loadProductById } from "../catalog";

/**
 * The card page's address on success. The client opens it with a full page
 * load, never a client-side navigation: the card page's enforced CSP only
 * takes effect on a document load.
 */
type StartResult = { error: string } | { payUrl: string };

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

type Db = ReturnType<typeof createAdminClient>;

interface Purchaser {
  /** The renewed Trainee, or null for a fresh purchase matched by phone later. */
  profileId: string | null;
  renewalOfPlanId: string | null;
  childName: string;
  childBirthdate: string;
  loginPhone: string;
}

/**
 * A valid renewal token names a Plan, and the purchase belongs to that Plan's
 * Trainee: the order carries the account from the start, so a parent who types
 * another phone can never land the Plan on a new empty account. An invalid or
 * expired token, or a Trainee no longer active, makes this a fresh purchase.
 */
async function resolvePurchaser(
  db: Db,
  data: { renewalToken?: string; childName: string; childBirthdate: string; loginPhone: string },
): Promise<Purchaser | { error: string }> {
  const fresh: Purchaser = {
    profileId: null,
    renewalOfPlanId: null,
    childName: data.childName,
    childBirthdate: data.childBirthdate,
    loginPhone: data.loginPhone,
  };
  if (!data.renewalToken) return fresh;

  const verified = verifyRenewalToken(data.renewalToken, planTokenSecret(), Math.floor(Date.now() / 1000));
  if (!verified) return fresh;

  // Two foreign keys reach profiles (profile_id, created_by): name the one.
  const { data: renewed, error: lookupError } = await db
    .from("trainee_plans")
    .select("id, profile:profiles!trainee_plans_profile_id_fkey(id, full_name, birthdate, phone, role, deleted_at)")
    .eq("id", verified.planId)
    .maybeSingle();
  if (lookupError) {
    console.error("[checkout] renewal lookup failed:", lookupError.message);
    return { error: "לא הצלחנו לאמת את קישור החידוש. נסו שוב בעוד רגע." };
  }
  const account = renewed?.profile;
  if (!renewed || !account || !isActiveTrainee(account)) return fresh;

  const usable = usableAccount({ fullName: account.full_name, birthdate: account.birthdate, phone: account.phone });
  const bound = bindRenewal(usable, data);
  if (!bound.ok) return { error: bound.error };

  // An account with no phone stored takes the typed one on the order, but never
  // another child's: the order would carry that child's login phone.
  if (usable.phone === null) {
    const { data: other } = await db
      .from("profiles")
      .select("id")
      .in("phone", phoneVariants(bound.loginPhone))
      .neq("id", account.id)
      .eq("role", "trainee")
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle();
    if (other) return { error: "מספר הטלפון הזה שייך לחניך אחר. הזינו את המספר של החניך שבקישור." };
  }
  return {
    profileId: account.id,
    renewalOfPlanId: renewed.id,
    childName: bound.childName,
    childBirthdate: bound.childBirthdate,
    loginPhone: bound.loginPhone,
  };
}

/**
 * Validates the agreement, records a pending order and the signed agreement,
 * and returns the address of the site's own card page for that order.
 *
 * Unauthenticated by design: the parent has no account yet. No money moves
 * here, only an order row, so the checkout limiter (5 per 10 minutes per IP
 * and per login phone, fails open when Redis is missing) is the abuse guard;
 * the card charge has the strict one.
 */
export async function startCheckoutAction(input: EnrollmentInput): Promise<StartResult> {
  // Nothing is stored for a payment that cannot happen yet.
  if (!(await canPayOnline())) return { error: PAYMENTS_CLOSED_MESSAGE };

  const ip = await clientIp();
  const limit = await checkRateLimit(`ip:${ip}`, "checkout");
  waitUntil(limit.pending);
  if (limit.rateLimited) return { error: "יותר מדי ניסיונות. נסו שוב בעוד כמה דקות." };

  const validated = enrollmentSchema.safeParse(input);
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "אימות נתונים נכשל" };
  }
  const data = validated.data;

  const phoneLimit = await checkRateLimit(`phone:${data.loginPhone}`, "checkout");
  waitUntil(phoneLimit.pending);
  if (phoneLimit.rateLimited) return { error: "יותר מדי ניסיונות למספר הזה. נסו שוב בעוד כמה דקות." };

  const product = await loadProductById(data.productId);
  if (!product || !product.is_active) return { error: "המסלול אינו זמין" };

  const db = createAdminClient();

  const purchaser = await resolvePurchaser(db, data);
  if ("error" in purchaser) return purchaser;

  const purchaserOrders = sameTraineeOrders(purchaser.loginPhone, purchaser.profileId);
  const [{ data: owner }, { count: charging }, paidIntros] = await Promise.all([
    db
      .from("profiles")
      .select("role")
      .in("phone", phoneVariants(purchaser.loginPhone))
      .is("deleted_at", null)
      .limit(1)
      .maybeSingle(),
    typedFrom(db, "orders")
      .select("id", { count: "exact", head: true })
      .or(purchaserOrders)
      .eq("status", "charging"),
    product.once_per_trainee
      ? typedFrom(db, "orders")
          .select("id", { count: "exact", head: true })
          .or(purchaserOrders)
          // A refunded intro pack was still sold; only a Void undoes the sale.
          .in("status", ["paid", "refunded"])
          .eq("product_id", product.id)
          .then(({ count }: { count: number | null }) => count ?? 0)
      : Promise.resolve(0),
  ]);

  // The login phone may already be a trainee (renewal, second plan) but never
  // a staff account: fulfillment would otherwise rewrite it.
  if (owner && owner.role !== "trainee") {
    return { error: "מספר הטלפון להתחברות שייך לחשבון צוות. השתמשו במספר אחר." };
  }
  // A charge for this phone may have gone through without an answer. Until
  // an admin settles it, a second order would risk charging the parent twice.
  if ((charging ?? 0) > 0) {
    return { error: "יש תשלום קודם למספר הזה שעדיין בבדיקה. כתבו לנו בוואטסאפ 052-577-9446 ונסיים יחד." };
  }
  if (!isIntroPackEligible(product, paidIntros)) {
    return { error: "חבילת ההיכרות היא לשחקן חדש בלבד. בחרו מסלול אחר." };
  }

  const { data: order, error: orderError } = (await typedFrom(db, "orders")
    .insert({
      product_id: product.id,
      branch_id: product.branch_id,
      amount_ils: product.price_ils,
      parent_name: data.parentName,
      payer_phone: data.payerPhone,
      login_phone: purchaser.loginPhone,
      child_name: purchaser.childName,
      child_birthdate: purchaser.childBirthdate,
      email: data.email,
      profile_id: purchaser.profileId,
      renewal_of_plan_id: purchaser.renewalOfPlanId,
    })
    .select("id")
    .single()) as { data: { id: string } | null; error: { message: string } | null };

  if (orderError || !order) {
    console.error("startCheckout order insert error:", orderError);
    return { error: "שגיאה בשמירת ההזמנה" };
  }

  const { error: agreementError } = await typedFrom(db, "enrollment_agreements").insert({
    order_id: order.id,
    agreement_version: TERMS_VERSION,
    parent_name: data.parentName,
    parent_id_number: data.parentIdNumber.replace(/\s+/g, ""),
    parent_phone: data.payerPhone,
    parent_email: data.email,
    child_name: purchaser.childName,
    child_birthdate: purchaser.childBirthdate,
    medical_notes: data.medicalNotes,
    plan_name: product.name_he,
    plan_price_ils: product.price_ils,
    plan_start_on: israelToday(),
    payment_method: "כרטיס אשראי",
    emergency_contact_name: data.emergencyContactName,
    emergency_contact_phone: data.emergencyContactPhone,
    declares_healthy: data.declaresHealthy,
    accepts_terms: data.acceptsTerms,
    authorizes_payment: data.authorizesPayment,
    photo_consent: data.photoConsent,
    signature_name: data.signatureName,
    // The parent signs here, before paying; an unsigned online agreement would
    // reopen the signing form to anyone holding its link.
    signed_at: new Date().toISOString(),
    signed_ip: ip,
  });

  if (agreementError) {
    console.error("startCheckout agreement insert error:", agreementError);
    await typedFrom(db, "orders").update({ status: "failed" }).eq("id", order.id);
    return { error: "שגיאה בשמירת ההסכם" };
  }

  return { payUrl: `/join/pay/${order.id}` };
}
