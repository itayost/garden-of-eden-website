import { createHmac, timingSafeEqual } from "crypto";
import { UUID_REGEX } from "@/lib/validations/common";

/**
 * A renewal link must open the form for one plan without a login: the parent
 * is not the account holder. The token is `planId.expiresAt.hmac`, checked in
 * constant time. Thirty days is long enough to survive a slow reply and
 * short enough that a leaked WhatsApp does not stay actionable for a year.
 */
export const RENEWAL_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

/** A trainee subject is marked so it can never be read as a plan id. */
const TRAINEE_PREFIX = "t-";

function mac(subject: string, expiresAt: number, secret: string): string {
  return createHmac("sha256", secret).update(`${subject}.${expiresAt}`).digest("hex");
}

export function signRenewalToken(planId: string, expiresAtUnix: number, secret: string): string {
  return `${planId}.${expiresAtUnix}.${mac(planId, expiresAtUnix, secret)}`;
}

/**
 * The same link bound to a trainee rather than a Plan: the in-app "buy a
 * plan" for a trainee who has none, or only a cancelled one.
 */
export function signTraineeToken(profileId: string, expiresAtUnix: number, secret: string): string {
  const subject = `${TRAINEE_PREFIX}${profileId}`;
  return `${subject}.${expiresAtUnix}.${mac(subject, expiresAtUnix, secret)}`;
}

export function verifyRenewalToken(
  token: string,
  secret: string,
  nowUnix: number,
): { planId: string } | { profileId: string } | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [subject, expiresRaw, signature] = parts;
  const trainee = subject.startsWith(TRAINEE_PREFIX);
  const id = trainee ? subject.slice(TRAINEE_PREFIX.length) : subject;
  if (!UUID_REGEX.test(id)) return null;

  const expiresAt = Number(expiresRaw);
  if (!Number.isInteger(expiresAt) || expiresAt <= nowUnix) return null;

  const expected = mac(subject, expiresAt, secret);
  if (signature.length !== expected.length) return null;
  if (!timingSafeEqual(Buffer.from(signature, "utf8"), Buffer.from(expected, "utf8"))) {
    return null;
  }
  return trainee ? { profileId: id } : { planId: id };
}
