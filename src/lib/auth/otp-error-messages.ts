/**
 * Translate Supabase GoTrue OTP errors into actionable Hebrew messages.
 * Codes match the ErrorCode union in @supabase/auth-js; older servers may
 * omit the code, so known English messages are matched as a fallback.
 */

export const OTP_SEND_ERROR_FALLBACK = "שגיאה בשליחת קוד האימות. נסו שוב";

const UNREGISTERED_PHONE = "מספר הטלפון אינו רשום במערכת. פנו למועדון לצורך רישום";
const RATE_LIMITED = "נשלחו יותר מדי בקשות. המתינו דקה ונסו שוב";
const INVALID_PHONE = "מספר הטלפון אינו תקין";
const CODE_WRONG_OR_EXPIRED = "הקוד שגוי או שפג תוקפו. בקשו קוד חדש";

const MESSAGES_BY_CODE: Readonly<Record<string, string>> = {
  otp_disabled: UNREGISTERED_PHONE,
  over_sms_send_rate_limit: RATE_LIMITED,
  over_request_rate_limit: RATE_LIMITED,
  sms_send_failed: "שליחת ההודעה נכשלה. ודאו שהמספר פעיל ב-WhatsApp ונסו שוב",
  phone_provider_disabled: "התחברות בטלפון אינה זמינה כרגע. פנו למועדון",
  validation_failed: INVALID_PHONE,
  otp_expired: CODE_WRONG_OR_EXPIRED,
  user_banned: "החשבון חסום. פנו למועדון",
};

const MESSAGE_PATTERNS: ReadonlyArray<readonly [RegExp, string]> = [
  [/signups not allowed/i, UNREGISTERED_PHONE],
  [/security purposes/i, RATE_LIMITED],
  [/rate limit/i, RATE_LIMITED],
  [/invalid phone/i, INVALID_PHONE],
  [/token has expired or is invalid/i, CODE_WRONG_OR_EXPIRED],
];

function extractCode(error: unknown): string | null {
  if (typeof error !== "object" || error === null) return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === "string" ? code : null;
}

function extractMessage(error: unknown): string | null {
  if (error instanceof Error) return error.message;
  if (typeof error !== "object" || error === null) return null;
  const message = (error as { message?: unknown }).message;
  return typeof message === "string" ? message : null;
}

export function getOtpErrorMessage(
  error: unknown,
  fallback: string = OTP_SEND_ERROR_FALLBACK
): string {
  const code = extractCode(error);
  if (code && Object.hasOwn(MESSAGES_BY_CODE, code)) {
    return MESSAGES_BY_CODE[code];
  }

  const message = extractMessage(error);
  if (message) {
    const match = MESSAGE_PATTERNS.find(([pattern]) => pattern.test(message));
    if (match) return match[1];
  }

  return fallback;
}
