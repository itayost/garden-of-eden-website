"use server";

import { waitUntil } from "@vercel/functions";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { checkRateLimit } from "@/lib/rate-limit";
import { isActiveTrainee } from "@/lib/plans/bound-renewal";
import { toE164 } from "@/lib/plans/local-phone";
import { isValidPhoneIL } from "@/lib/validations/common";
import { sendPurchaseRequest } from "@/lib/whatsapp/plan-templates";
import { buildRenewalUrl, buildTraineePurchaseUrl } from "../renewal-link";
import { loadPlanQueues } from "../queries";
import { israelToday } from "@/lib/utils/tasks";
import { canAskParentToBuy } from "../sells-online";

export type PurchaseRequestResult = { ok: true; sentTo: string } | { error: string };

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
  const [{ data: profile }, selling, queues] = await Promise.all([
    db.from("profiles").select("full_name, guardian_name, guardian_phone, role, deleted_at").eq("id", user.id).maybeSingle(),
    canAskParentToBuy(db, user.id),
    loadPlanQueues(db, [user.id], israelToday()),
  ]);
  if (!profile || !isActiveTrainee(profile) || !selling) return { error: "קניית מסלול באפליקציה זמינה למתאמני הסניף בלבד" };
  if (!profile.guardian_phone || !isValidPhoneIL(profile.guardian_phone)) {
    return { error: "לא שמור מספר תקין של הורה. בקשו מהמאמן לעדכן אותו." };
  }

  const limit = await checkRateLimit(`purchase-request:${user.id}`, "purchase_request");
  waitUntil(limit.pending);
  if (limit.rateLimited) return { error: "כבר נשלחו להורה בקשות היום. אפשר לנסות שוב מחר." };

  const parentPhone = toE164(profile.guardian_phone);
  const childName = profile.full_name ?? "";
  // A renewal names the Plan (its product preselected, the order records it);
  // a trainee with no Plan gets the link bound to them.
  const own = queues.get(user.id);
  const url = own ? buildRenewalUrl(own.plan.id) : buildTraineePurchaseUrl(user.id);
  const sent = await sendPurchaseRequest(parentPhone, { parentName: profile.guardian_name ?? "הורה", childName, url }).catch(
    (error: unknown) => ({ success: false as const, error: error instanceof Error ? error.message : String(error) }),
  );
  if (sent.success) return { ok: true, sentTo: parentPhone };
  console.error("[purchase-request] send failed:", sent.error);
  return { error: "השליחה להורה נכשלה. נסו שוב מאוחר יותר." };
}
