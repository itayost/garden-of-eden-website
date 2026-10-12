/**
 * Common validation patterns and utilities
 *
 * Centralized validation constants to ensure consistency across the codebase.
 */

/**
 * UUID v4 validation regex (case-insensitive)
 * Matches: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 */
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Parse a recognizable Israeli phone spelling (+972..., 972..., 05...) into
 * canonical E.164 (+972XXXXXXXXX). Returns null for anything else.
 */
export function normalizePhoneIL(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const trimmed = phone.trim();
  if (!/^\+?[\d\s().-]+$/.test(trimmed)) return null;

  const cleaned = trimmed.replace(/(?!^\+)\D/g, "");

  if (/^\+972\d{9}$/.test(cleaned)) return cleaned;
  if (/^972\d{9}$/.test(cleaned)) return `+${cleaned}`;
  if (/^0\d{9}$/.test(cleaned)) return `+972${cleaned.slice(1)}`;

  return null;
}

/**
 * Validate UUID format
 * @param id - String to validate
 * @returns true if valid UUID v4 format
 */
export function isValidUUID(id: string | null | undefined): id is string {
  if (!id) return false;
  return UUID_REGEX.test(id);
}

/**
 * Validate Israeli phone number
 * @param phone - Phone number to validate
 * @returns true if valid Israeli phone format
 */
export function isValidPhoneIL(phone: string | null | undefined): phone is string {
  return normalizePhoneIL(phone) !== null;
}

/**
 * Format Israeli phone to +972 format
 * @param phone - Phone number starting with 0 or +972
 * @returns Phone in +972 format
 */
export function formatPhoneToInternational(phone: string): string {
  return normalizePhoneIL(phone) ?? phone.trim();
}

/**
 * ISO date string regex (YYYY-MM-DD)
 */
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validate ISO date string format and actual date validity
 */
export function isValidDateString(date: string): boolean {
  if (!DATE_REGEX.test(date)) return false;
  const parsed = new Date(date + "T00:00:00Z");
  if (isNaN(parsed.getTime())) return false;
  return parsed.toISOString().startsWith(date);
}

/**
 * Validate a date range (both dates valid and from <= to)
 */
export function isValidDateRange(from: string, to: string): boolean {
  if (!isValidDateString(from) || !isValidDateString(to)) return false;
  return from <= to;
}

/**
 * Format phone to local display format (0XX)
 * @param phone - Phone number in any format
 * @returns Phone in 0XX format for display
 */
export function formatPhoneToLocal(phone: string | null | undefined): string {
  const international = normalizePhoneIL(phone);
  return international ? `0${international.slice(4)}` : (phone ?? "").trim();
}
