"use server";

import { waitUntil } from "@vercel/functions";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { isActiveTrainee } from "@/lib/plans/bound-renewal";
import { toE164 } from "@/lib/plans/local-phone";
import { purchaseRequestShareUrl } from "@/lib/plans/purchase-request";
import { sendPurchaseRequest } from "@/lib/whatsapp/plan-templates";
import { buildTraineePurchaseUrl } from "../renewal-link";
import { sellsOnline } from "../sells-online";

/** sentTo: the parent got the WhatsApp; shareUrl: open the child's own WhatsApp to the parent instead. */
export type PurchaseRequestResult = { ok: true; sentTo: string } | { ok: true; shareUrl: string } | { error: string };

/**
 * The trainee's "buy a plan": the parent gets a purchase link bound to this
 * trainee, to choose, sign and pay on their own phone. Three a day, so a
 * child cannot flood the parent.
 */
export async function requestPurchaseLinkAction(): Promise<PurchaseRequestResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "נדרשת התחברות" };

  const db = createAdminClient();
  const [{ data: profile }, selling] = await Promise.all([
    db.from("profiles").select("full_name, guardian_name, guardian_phone, role, deleted_at").eq("id", user.id).maybeSingle(),
    sellsOnline(db, user.id),
  ]);
  if (!profile || !isActiveTrainee(profile) || !selling) return { error: "קניית מסלול באפליקציה זמינה למתאמני הסניף בלבד" };
  if (!profile.guardian_phone) return { error: "לא שמור מספר של הורה. בקשו מהמאמן לעדכן אותו." };

  const limit = await checkRateLimit(`purchase-request:${user.id}`, "purchase_request");
  waitUntil(limit.pending);
  if (limit.rateLimited) return { error: "כבר נשלחו להורה בקשות היום. אפשר לנסות שוב מחר." };

  const parentPhone = toE164(profile.guardian_phone);
  const childName = profile.full_name ?? "";
  const url = buildTraineePurchaseUrl(user.id);
  const sent = await sendPurchaseRequest(parentPhone, { parentName: profile.guardian_name ?? "הורה", childName, url });
  if (sent.success) return { ok: true, sentTo: parentPhone };
  // Until Meta approves the template, the child's own WhatsApp carries it.
  if (sent.error?.includes("not configured")) return { ok: true, shareUrl: purchaseRequestShareUrl(parentPhone, childName, url) };
  console.error("[purchase-request] send failed:", sent.error);
  return { error: "השליחה להורה נכשלה. נסו שוב מאוחר יותר." };
}
