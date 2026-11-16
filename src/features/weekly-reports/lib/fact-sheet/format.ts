/**
 * Small helpers shared by the Fact sheet builders. Pure.
 */

/** "2026-11-05" reads "05/11" in a Hold reason. */
export function holdDate(date: string): string {
  const [, month = "", day = ""] = date.split("-");
  return `${day}/${month}`;
}

/** The first word of a name: "יוסי כהן" gives "יוסי". */
export function firstWord(name: string | null | undefined): string {
  return (name ?? "").trim().split(/\s+/)[0] ?? "";
}

/** A trimmed text, or null when it is missing or blank. */
export function textOrNull(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

/** The distinct values, in first-seen order. */
export function distinct<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

/** Rounded to one decimal: 7.25 gives 7.3. */
export function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** The mean rounded to one decimal, or null for no values. */
export function average(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  return round1(values.reduce((sum, v) => sum + v, 0) / values.length);
}

/** Sorts a copy by its `date` field; equal dates keep their order. */
export function byDate<T extends { date: string }>(items: readonly T[]): T[] {
  return [...items].sort((a, b) => a.date.localeCompare(b.date));
}
