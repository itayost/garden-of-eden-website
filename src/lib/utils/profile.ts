import type { Profile } from "@/types/database";

/** What a Trainee with no usable name is greeted as. */
const GENERIC_FIRST_NAME = "מתאמן";

/**
 * The name a Trainee is greeted by: the first word of the full name, with the
 * generic greeting for a missing or blank one. The one rule behind every
 * "היי, <name>" on the dashboard.
 */
export function firstNameOf(fullName: string | null): string {
  return fullName?.trim().split(/\s+/)[0] || GENERIC_FIRST_NAME;
}

/**
 * Check if a profile has all required fields completed
 * Required: full_name, birthdate
 * @param profile - The profile to check
 */
export function isProfileComplete(profile: Profile | null): boolean {
  if (!profile) return false;

  // Check required fields
  const hasFullName = !!profile.full_name && profile.full_name.trim().length >= 2;
  const hasBirthdate = !!profile.birthdate;

  return hasFullName && hasBirthdate;
}

/**
 * Get the percentage of profile completion
 * Includes optional fields for a more complete picture
 * @param profile - The profile to check
 */
export function getProfileCompletionPercentage(profile: Profile | null): number {
  if (!profile) return 0;

  const fields = [
    { name: "full_name", filled: !!profile.full_name, weight: 30 },
    { name: "birthdate", filled: !!profile.birthdate, weight: 30 },
    { name: "position", filled: !!profile.position, weight: 20 },
    { name: "avatar_url", filled: !!profile.avatar_url, weight: 20 },
  ];

  const total = fields.reduce((sum, field) => sum + (field.filled ? field.weight : 0), 0);
  return total;
}

/**
 * Get list of missing required fields
 * @param profile - The profile to check
 */
export function getMissingRequiredFields(profile: Profile | null): string[] {
  if (!profile) return ["full_name", "birthdate"];

  const missing: string[] = [];

  if (!profile.full_name || profile.full_name.trim().length < 2) {
    missing.push("full_name");
  }
  if (!profile.birthdate) {
    missing.push("birthdate");
  }

  return missing;
}

/**
 * Hebrew labels for missing field messages
 */
export const PROFILE_FIELD_LABELS_HE: Record<string, string> = {
  full_name: "שם מלא",
  birthdate: "תאריך לידה",
  position: "עמדה",
  avatar_url: "תמונת פרופיל",
};
