import type { AgeGroup } from "./types";

export function deriveAgeGroup(birthdate: string | null, now: Date = new Date()): AgeGroup | null {
  if (!birthdate) return null;
  const dob = new Date(birthdate);
  if (Number.isNaN(dob.getTime())) return null;
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) age -= 1;
  if (age <= 12) return "U10-12";
  if (age <= 14) return "U13-14";
  if (age <= 16) return "U15-16";
  return "U17+";
}
