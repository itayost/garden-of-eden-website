import { createHmac, timingSafeEqual } from "crypto";
import { UUID_REGEX } from "@/lib/validations/common";

/**
 * A renewal link must open the form for one plan without a login: the parent
 * is not the account holder. The token is `planId.expiresAt.hmac`, checked in
 * constant time. Thirty days is long enough to survive a slow reply and
 * short enough that a leaked WhatsApp does not stay actionable for a year.
 */
export const RENEWAL_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

function mac(planId: string, expiresAt: number, secret: string): string {
  return createHmac("sha256", secret).update(`${planId}.${expiresAt}`).digest("hex");
}

export function signRenewalToken(planId: string, expiresAtUnix: number, secret: string): string {
  return `${planId}.${expiresAtUnix}.${mac(planId, expiresAtUnix, secret)}`;
}

export function verifyRenewalToken(
  token: string,
  secret: string,
  nowUnix: number,
): { planId: string } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [planId, expiresRaw, signature] = parts;
  if (!UUID_REGEX.test(planId)) return null;

  const expiresAt = Number(expiresRaw);
  if (!Number.isInteger(expiresAt) || expiresAt <= nowUnix) return null;

  const expected = mac(planId, expiresAt, secret);
  if (signature.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(signature, "utf8"), Buffer.from(expected, "utf8"))) {
    return null;
  }
  return { planId };
}
