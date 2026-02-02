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
 * Israeli phone number validation regex
 * Accepts: 05XXXXXXXX or +972XXXXXXXXX
 */
export const PHONE_REGEX_IL = /^0\d{9}$|^\+972\d{9}$/;

/**
 * Mobile phone regex (05X format only)
 * Accepts: 05XXXXXXXX
 */
export const PHONE_REGEX_MOBILE = /^05\d{8}$/;

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
  if (!phone) return false;
  return PHONE_REGEX_IL.test(phone);
}

/**
 * Format Israeli phone to +972 format
 * @param phone - Phone number starting with 0 or +972
 * @returns Phone in +972 format
 */
export function formatPhoneToInternational(phone: string): string {
  if (phone.startsWith("+")) return phone;
  return `+972${phone.slice(1)}`;
}

/**
 * Format phone to local display format (0XX)
 * @param phone - Phone number in any format
 * @returns Phone in 0XX format for display
 */
export function formatPhoneToLocal(phone: string | null | undefined): string {
  if (!phone) return "";
  if (phone.startsWith("+972")) {
    return `0${phone.slice(4)}`;
  }
  return phone;
}
