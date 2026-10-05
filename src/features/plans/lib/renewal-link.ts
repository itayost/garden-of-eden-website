import { planTokenSecret } from "@/lib/plans/token-secret";
import "server-only";

import { RENEWAL_TOKEN_TTL_SECONDS, signRenewalToken, signTraineeToken } from "@/lib/plans/renewal-token";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.edengarden.co.il";

/** `/join?renew=<token>`: the purchase form, opened without a login. */
const joinUrl = (token: string) => `${SITE_URL}/join?renew=${encodeURIComponent(token)}`;

/** The form for renewing this plan: its product preselected. */
export function buildRenewalUrl(planId: string, nowUnix = Math.floor(Date.now() / 1000)): string {
  return joinUrl(signRenewalToken(planId, nowUnix + RENEWAL_TOKEN_TTL_SECONDS, planTokenSecret()));
}

/** The form bound to a trainee with no Plan to name: the in-app purchase link. */
export function buildTraineePurchaseUrl(profileId: string, nowUnix = Math.floor(Date.now() / 1000)): string {
  return joinUrl(signTraineeToken(profileId, nowUnix + RENEWAL_TOKEN_TTL_SECONDS, planTokenSecret()));
}
