/**
 * Card number checks that run on both sides of the form. International cards
 * carry a Luhn check digit; Isracard's own 8 and 9 digit cards use a weighted
 * mod-11 check instead, so both are accepted.
 */

export type CardBrand = "visa" | "mastercard" | "amex" | "diners" | "isracard" | "unknown";

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export function luhnValid(number: string): boolean {
  const digits = digitsOnly(number);
  if (digits.length < 12 || digits.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i -= 1) {
    let d = Number(digits[i]);
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

/** Isracard local cards: 8 digits padded to 9, weights 9..1, sum divisible by 11. */
export function isracardValid(number: string): boolean {
  const digits = digitsOnly(number);
  if (digits.length !== 8 && digits.length !== 9) return false;
  const padded = digits.padStart(9, "0");
  const sum = [...padded].reduce((acc, ch, i) => acc + Number(ch) * (9 - i), 0);
  return sum % 11 === 0;
}

export function cardNumberValid(number: string): boolean {
  return luhnValid(number) || isracardValid(number);
}

export function detectBrand(number: string): CardBrand {
  const d = digitsOnly(number);
  if (d.length === 8 || d.length === 9) return isracardValid(d) ? "isracard" : "unknown";
  if (/^4/.test(d)) return "visa";
  if (/^(5[1-5]|2[2-7])/.test(d)) return "mastercard";
  if (/^3[47]/.test(d)) return "amex";
  if (/^3(0[0-5]|[68])/.test(d)) return "diners";
  return "unknown";
}

export function last4(number: string): string {
  return digitsOnly(number).slice(-4);
}

/** Groups digits for display: 4-4-4-4 (or 4-6-5 for Amex). */
export function formatCardNumber(value: string): string {
  const d = digitsOnly(value).slice(0, 19);
  if (/^3[47]/.test(d)) {
    return [d.slice(0, 4), d.slice(4, 10), d.slice(10, 15)].filter(Boolean).join(" ");
  }
  return d.match(/.{1,4}/g)?.join(" ") ?? "";
}

/** Month 1-12 and a 2 or 4 digit year, not before the current month. */
export function expiryValid(month: number, year: number, now: Date = new Date()): boolean {
  if (!Number.isInteger(month) || month < 1 || month > 12) return false;
  const fullYear = year < 100 ? 2000 + year : year;
  if (fullYear < now.getFullYear() || fullYear > now.getFullYear() + 15) return false;
  if (fullYear === now.getFullYear() && month < now.getMonth() + 1) return false;
  return true;
}
