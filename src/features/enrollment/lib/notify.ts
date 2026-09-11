import { planTokenSecret } from "@/lib/plans/token-secret";
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { typedFrom } from "@/lib/supabase/helpers";
import { signAgreementToken } from "@/lib/plans/agreement-token";
import { sendWelcomeMessage } from "@/lib/whatsapp/welcome";
import type { WhatsAppResult } from "@/lib/whatsapp/api";
import { sendPlanConfirmed } from "@/lib/whatsapp/plan-templates";
import type { Order, TraineePlan } from "@/types/plans";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.edengarden.co.il";

function ddmmyyyy(iso: string): string {
  return iso.split("-").reverse().join("/");
}

/**
 * Two messages after fulfillment: the app welcome to the child's login phone
 * when the account is new (the welcome dispatcher only covers Arbox accounts),
 * and the plan confirmation with the agreement link to the parent.
 * Best-effort: a failed send is logged, never thrown; the money already landed.
 */
export interface NotifyOutcome {
  /** Null when the welcome was already sent (or nothing to send). */
  welcome: WhatsAppResult | null;
  confirmed: WhatsAppResult | null;
  /** Where the parent's link points: the signing page until signed, the copy after. */
  agreementUrl: string | null;
  sentTo: string | null;
}

const NOTHING: NotifyOutcome = { welcome: null, confirmed: null, agreementUrl: null, sentTo: null };

/** The parent's link for an agreement id; the same page signs and later displays. */
export function agreementLink(agreementId: string): string {
  return `${SITE_URL}/join/agreement/${agreementId}?t=${signAgreementToken(agreementId, planTokenSecret())}`;
}

export async function notifyOrderFulfilled(db: SupabaseClient, orderId: string): Promise<NotifyOutcome> {
  const { data: order } = (await typedFrom(db, "orders")
    .select("*")
    .eq("id", orderId)
    .maybeSingle()) as { data: Order | null };
  if (!order || !order.profile_id) return NOTHING;

  const [{ data: plan }, { data: agreement }, { data: profile }, { data: product }] =
    await Promise.all([
      typedFrom(db, "trainee_plans")
        .select("ends_on")
        .eq("order_id", order.id)
        .maybeSingle() as Promise<{ data: Pick<TraineePlan, "ends_on"> | null }>,
      typedFrom(db, "enrollment_agreements")
        .select("id")
        .eq("order_id", order.id)
        .maybeSingle() as Promise<{ data: { id: string } | null }>,
      db
        .from("profiles")
        .select("welcome_message_sent_at, full_name")
        .eq("id", order.profile_id)
        .maybeSingle(),
      typedFrom(db, "plan_products")
        .select("name_he")
        .eq("id", order.product_id)
        .maybeSingle() as Promise<{ data: { name_he: string } | null }>,
    ]);

  let welcome: WhatsAppResult | null = null;
  if (profile && !profile.welcome_message_sent_at) {
    welcome = await sendWelcomeMessage(order.login_phone, profile.full_name);
    if (welcome.success) {
      await db
        .from("profiles")
        .update({ welcome_message_sent_at: new Date().toISOString() })
        .eq("id", order.profile_id);
    } else {
      console.error(`[notify] welcome failed for order ${order.id}:`, welcome.error);
    }
  }

  const agreementUrl = agreement ? agreementLink(agreement.id) : `${SITE_URL}/join`;

  const confirmed = await sendPlanConfirmed(order.payer_phone, {
    parentName: order.parent_name,
    childName: order.child_name,
    planName: product?.name_he ?? "המסלול",
    endsOn: plan ? ddmmyyyy(plan.ends_on) : "",
    agreementUrl,
  });
  if (!confirmed.success) {
    console.error(`[notify] plan confirmed failed for order ${order.id}:`, confirmed.error);
  }
  return { welcome, confirmed, agreementUrl: agreement ? agreementUrl : null, sentTo: order.payer_phone };
}
