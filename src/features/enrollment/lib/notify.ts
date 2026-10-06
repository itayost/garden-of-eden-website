import { planTokenSecret } from "@/lib/plans/token-secret";
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { typedFrom } from "@/lib/supabase/helpers";
import { signAgreementToken } from "@/lib/plans/agreement-token";
import { sendWelcomeMessage } from "@/lib/whatsapp/welcome";
import type { WhatsAppResult } from "@/lib/whatsapp/api";
import { sendPlanConfirmed } from "@/lib/whatsapp/plan-templates";
import { planConfirmedText, templateMissing, waShareUrl } from "@/lib/whatsapp/share";
import { validityText } from "@/lib/plans/confirmation-copy";
import { orderPlanName } from "@/lib/plans/manual-card";
import { israelToday } from "@/lib/utils/tasks";
import { loadPlanPlacement } from "@/features/plans/lib/queries";
import type { Order } from "@/types/plans";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.edengarden.co.il";

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
  /** The confirmation template is not set yet: staff send this chat from their own WhatsApp. */
  shareUrl: string | null;
}

const NOTHING: NotifyOutcome = { welcome: null, confirmed: null, agreementUrl: null, sentTo: null, shareUrl: null };

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

  const [{ data: agreement }, { data: profile }, { data: product }] =
    await Promise.all([
      typedFrom(db, "enrollment_agreements")
        .select("id")
        .eq("order_id", order.id)
        .maybeSingle() as Promise<{ data: { id: string } | null }>,
      db
        .from("profiles")
        .select("welcome_message_sent_at, full_name, phone")
        .eq("id", order.profile_id)
        .maybeSingle(),
      typedFrom(db, "plan_products")
        .select("name_he")
        .eq("id", order.product_id)
        .maybeSingle() as Promise<{ data: { name_he: string } | null }>,
    ]);

  let welcome: WhatsAppResult | null = null;
  // No login phone: a link never assigns one (it could take the account); staff set it.
  if (profile && !profile.phone) {
    console.warn(`[notify] order ${order.id}: trainee ${order.profile_id} has no login phone; welcome skipped, staff must set it`);
  } else if (profile && !profile.welcome_message_sent_at) {
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
  // The end date, and the start when the Plan waits behind another.
  const placement = await loadPlanPlacement(db, order.profile_id, order.id, israelToday());
  if (!placement) console.error(`[notify] order ${order.id}: no plan to date in the confirmation`);

  const message = {
    parentName: order.parent_name,
    childName: order.child_name,
    planName: orderPlanName(product?.name_he ?? "המסלול", order),
    validity: placement ? validityText(placement.start, placement.endsOn) : "",
    agreementUrl,
  };
  const confirmed = await sendPlanConfirmed(order.payer_phone, message);
  if (!confirmed.success) {
    console.error(`[notify] plan confirmed failed for order ${order.id}:`, confirmed.error);
  }
  // Until Meta approves the template, the same words go out by hand.
  const shareUrl = templateMissing(confirmed) ? waShareUrl(order.payer_phone, planConfirmedText(message)) : null;
  return { welcome, confirmed, agreementUrl: agreement ? agreementUrl : null, sentTo: order.payer_phone, shareUrl };
}
