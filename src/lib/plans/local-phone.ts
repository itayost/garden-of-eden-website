/** +972501234567 or 972501234567 as the 0501234567 people type and dial. */
export function toLocalPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const match = /^\+?972(\d{9})$/.exec(phone);
  return match ? `0${match[1]}` : phone;
}

/** Any stored spelling (+972…, 972…, 05…) as +972…; other strings pass through. */
export function toE164(phone: string): string {
  const local = toLocalPhone(phone);
  return /^0\d{9}$/.test(local) ? `+972${local.slice(1)}` : phone;
}
