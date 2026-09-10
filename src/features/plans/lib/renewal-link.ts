import "server-only";

import { RENEWAL_TOKEN_TTL_SECONDS, signRenewalToken } from "@/lib/plans/renewal-token";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.edengarden.co.il";

/** `/join?renew=<token>`: opens the form for this plan without a login. */
export function buildRenewalUrl(planId: string, nowUnix = Math.floor(Date.now() / 1000)): string {
  const secret = process.env.PLAN_RENEWAL_TOKEN_SECRET ?? "";
  const token = signRenewalToken(planId, nowUnix + RENEWAL_TOKEN_TTL_SECONDS, secret);
  return `${SITE_URL}/join?renew=${encodeURIComponent(token)}`;
}
