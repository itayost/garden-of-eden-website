import { planTokenSecret } from "@/lib/plans/token-secret";
import "server-only";

import { RENEWAL_TOKEN_TTL_SECONDS, signRenewalToken, signTraineeToken } from "@/lib/plans/renewal-token";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.edengarden.co.il";

/** `/join?renew=<token>`: opens the form for this plan without a login. */
export function buildRenewalUrl(planId: string, nowUnix = Math.floor(Date.now() / 1000)): string {
  const secret = planTokenSecret();
  const token = signRenewalToken(planId, nowUnix + RENEWAL_TOKEN_TTL_SECONDS, secret);
  return `${SITE_URL}/join?renew=${encodeURIComponent(token)}`;
}

/** The same form bound to a trainee: the in-app purchase link, Plan or none. */
export function buildTraineePurchaseUrl(profileId: string, nowUnix = Math.floor(Date.now() / 1000)): string {
  const token = signTraineeToken(profileId, nowUnix + RENEWAL_TOKEN_TTL_SECONDS, planTokenSecret());
  return `${SITE_URL}/join?renew=${encodeURIComponent(token)}`;
}
