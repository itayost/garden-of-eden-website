import {
  formatPhoneToInternational,
  isValidPhoneIL,
} from "@/lib/validations/common";

/**
 * Normalize an Israeli phone number to E.164 format (+972XXXXXXXXX).
 * Returns null if the number cannot be normalized.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  return isValidPhoneIL(raw) ? formatPhoneToInternational(raw) : null;
}
