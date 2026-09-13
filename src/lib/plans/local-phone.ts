import {
  formatPhoneToInternational,
  formatPhoneToLocal,
} from "@/lib/validations/common";

/** +972501234567 or 972501234567 as the 0501234567 people type and dial. */
export function toLocalPhone(phone: string | null | undefined): string {
  return formatPhoneToLocal(phone);
}

/** Any stored spelling (+972…, 972…, 05…) as +972…; other strings pass through. */
export function toE164(phone: string): string {
  return formatPhoneToInternational(phone);
}
