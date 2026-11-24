/**
 * The numbers a report's texts may use: exactly those in its Fact sheet. The
 * model never decides a number. Pure.
 */

import type { FactSheet } from "./types";

/**
 * A number with thousands groups ("3,000", "2.000", "1 000") comes first, so
 * its separator is never read as a decimal point: otherwise "5,000" would
 * pass as the 5 of a sleep average. Then a plain number with an optional
 * decimal part of any length.
 */
const NUMBER = /\d{1,3}(?:[,. \u00A0\u202F]\d{3})+(?!\d)|\d+(?:[.,]\d+)?/g;
const GROUPED = /^\d{1,3}(?:[,. \u00A0\u202F]\d{3})+$/;
/** Any decimal digit, from any script. */
const ANY_DIGIT = /\p{Nd}/gu;

/**
 * A grouped number as one integer; otherwise comma to dot, leading zeros and
 * trailing fractional zeros dropped.
 */
export function normalizeNumber(raw: string): string {
  if (GROUPED.test(raw)) return raw.replace(/\D/g, "").replace(/^0+/, "") || "0";
  const [whole = "", fraction = ""] = raw.replace(",", ".").split(".");
  const integer = whole.replace(/^0+/, "") || "0";
  const decimals = fraction.replace(/0+$/, "");
  return decimals === "" ? integer : `${integer}.${decimals}`;
}

/**
 * True when the text has digits outside 0 to 9 (Arabic-Indic, fullwidth and
 * the like), which the number check cannot read, so they must hold the report.
 */
export function foreignDigitsIn(text: string): boolean {
  return (text.match(ANY_DIGIT) ?? []).some((digit) => digit < "0" || digit > "9");
}

/** Every number in a text, normalized, in order. A minus sign is not part of it. */
export function numbersIn(text: string): string[] {
  return (text.match(NUMBER) ?? []).map(normalizeNumber);
}

/** Every number in a text as numbersIn() reads it, with where it starts and how it is written. */
export function numberMatches(text: string): { index: number; raw: string; value: string }[] {
  return [...text.matchAll(NUMBER)].map((match) => ({
    index: match.index ?? 0,
    raw: match[0],
    value: normalizeNumber(match[0]),
  }));
}

/**
 * Every number value in a value (a sheet, a Goal proposal's candidate) and
 * every number inside its strings, walked recursively. Fields named `id` are
 * skipped: a drill id is a key for the model to choose by, and its digits are
 * not facts.
 */
function numbersOf(value: unknown): string[] {
  if (typeof value === "number") return Number.isFinite(value) ? numbersIn(String(value)) : [];
  if (typeof value === "string") return numbersIn(value);
  if (Array.isArray(value)) return value.flatMap(numbersOf);
  if (typeof value === "object" && value !== null) {
    return Object.entries(value).flatMap(([key, inner]) => (key === "id" ? [] : numbersOf(inner)));
  }
  return [];
}

/** Every number in a value, as `numbersOf()` walks it, once each. */
export function allowedNumbersIn(value: unknown): Set<string> {
  return new Set(numbersOf(value));
}

/**
 * The sheet's numbers without its drills, plus the drill count. A drill's
 * name and "למה" line are the book's text, not facts about the Trainee, so a
 * set count, a time or a percentage in them never becomes a number the texts
 * may use. (A drill's `goal` label repeats `goals[].metric`, which stays in
 * the walk.)
 */
export function allowedNumbers(sheet: FactSheet): Set<string> {
  return new Set([...allowedNumbersIn({ ...sheet, drills: [] }), normalizeNumber(String(sheet.drills.length))]);
}
