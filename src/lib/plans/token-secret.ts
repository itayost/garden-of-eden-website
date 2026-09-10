import "server-only";

/**
 * The HMAC key for renewal and agreement tokens. Throwing beats an empty
 * default: with "" every signed link would verify for anyone.
 */
export function planTokenSecret(): string {
  const secret = process.env.PLAN_RENEWAL_TOKEN_SECRET;
  if (!secret) throw new Error("PLAN_RENEWAL_TOKEN_SECRET is not set");
  return secret;
}
