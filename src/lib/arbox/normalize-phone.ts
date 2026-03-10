/**
 * Normalize an Israeli phone number to E.164 format (+972XXXXXXXXX).
 * Returns null if the number cannot be normalized.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;

  // Strip all non-digit chars except a leading +
  const cleaned = raw.replace(/(?!^\+)\D/g, "");

  if (cleaned.startsWith("+972") && cleaned.length === 13) {
    return cleaned; // Already E.164
  }
  if (cleaned.startsWith("972") && cleaned.length === 12) {
    return `+${cleaned}`;
  }
  if (cleaned.startsWith("0") && cleaned.length === 10) {
    return `+972${cleaned.slice(1)}`;
  }

  return null;
}
