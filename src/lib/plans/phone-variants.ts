import { formatPhoneToInternational } from "@/lib/validations/common";

/** Build canonical and legacy spellings for resilient phone lookups. */
export function phoneVariants(phone: string): string[] {
  const e164 = formatPhoneToInternational(phone);
  const match = /^\+972(\d{9})$/.exec(e164);
  if (!match) return [phone];
  const rest = match[1];
  return [e164, `972${rest}`, `0${rest}`];
}
