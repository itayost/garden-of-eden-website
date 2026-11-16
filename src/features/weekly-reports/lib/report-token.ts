import { createHmac } from "crypto";
import { safeEqualUtf8 } from "@/lib/security/safe-equal";
import { UUID_REGEX } from "@/lib/validations/common";

/**
 * The parent opens one Weekly report without a login, from a WhatsApp link.
 * The token is `report.<id>.<expiry>.<mac>`, signed with the same secret as
 * the renewal links (planTokenSecret()), so it is kept apart from them twice:
 * its four parts never pass verifyRenewalToken() (three parts), and its MAC
 * covers `weekly-report.<id>.<expiry>`, so no renewal or trainee MAC can be
 * moved under the `report` prefix. Never the renewal token's `t-` subject,
 * which a purchase link would accept. Pure: the caller passes the clock and
 * the secret.
 */
export const REPORT_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;

const PREFIX = "report";
const MAC_DOMAIN = "weekly-report";

/** A positive whole number of seconds, spelled one way only. */
const EXPIRY_PATTERN = /^[1-9]\d*$/;

function mac(reportId: string, expiresAt: number, secret: string): string {
  return createHmac("sha256", secret).update(`${MAC_DOMAIN}.${reportId}.${expiresAt}`).digest("hex");
}

export function signReportToken(reportId: string, expiresAtUnix: number, secret: string): string {
  return `${PREFIX}.${reportId}.${expiresAtUnix}.${mac(reportId, expiresAtUnix, secret)}`;
}

/** The report id of a valid, unexpired token, or null. */
export function verifyReportToken(token: string, nowUnix: number, secret: string): string | null {
  const parts = token.split(".");
  if (parts.length !== 4) return null;
  const [prefix, reportId, expiresRaw, signature] = parts;
  if (prefix !== PREFIX) return null;
  if (!UUID_REGEX.test(reportId)) return null;

  if (!EXPIRY_PATTERN.test(expiresRaw)) return null;
  const expiresAt = Number(expiresRaw);
  if (!Number.isSafeInteger(expiresAt) || expiresAt <= nowUnix) return null;

  if (!safeEqualUtf8(signature, mac(reportId, expiresAt, secret))) return null;
  return reportId;
}
