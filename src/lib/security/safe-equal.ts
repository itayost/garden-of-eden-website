import { timingSafeEqual } from "crypto";

/**
 * Constant-time string compare. Byte lengths are compared first: a multibyte
 * string with the right character count would make timingSafeEqual throw
 * instead of refusing.
 */
export function safeEqualUtf8(given: string, expected: string): boolean {
  const a = Buffer.from(given, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
