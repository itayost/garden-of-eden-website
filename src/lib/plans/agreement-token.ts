import { createHmac } from "crypto";
import { safeEqualUtf8 } from "@/lib/security/safe-equal";

/**
 * The parent's copy of the agreement is a public URL guarded by an HMAC of
 * the agreement id. No expiry: a signed contract should stay retrievable.
 */
export function signAgreementToken(agreementId: string, secret: string): string {
  return createHmac("sha256", secret).update(`agreement.${agreementId}`).digest("hex");
}

export function verifyAgreementToken(agreementId: string, token: string, secret: string): boolean {
  return safeEqualUtf8(token, signAgreementToken(agreementId, secret));
}
