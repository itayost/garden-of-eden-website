/**
 * A Trainee's gender, which decides the Hebrew forms used to address them
 * (אתה or את). Stored on `profiles.gender`; filled when empty by /join, the
 * signing page and the Arbox sync, and changed only by staff.
 */

export const GENDERS = ["male", "female"] as const;

export type Gender = (typeof GENDERS)[number];

export const GENDER_LABELS: Record<Gender, string> = { male: "בן", female: "בת" };

/** A stored or Arbox value as a Gender, or null when it is neither. */
export function parseGender(value: unknown): Gender | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  return (GENDERS as readonly string[]).includes(normalized) ? (normalized as Gender) : null;
}
