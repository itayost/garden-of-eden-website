import type { Branch } from "@/types/branches";

/**
 * The branch an Arbox location name maps to, or null.
 *
 * Exact match after trimming, active branches only. Today every Arbox client
 * carries the same location name and no branch claims it, so this returns
 * null for everyone; the hook wakes up the day Eden sets a branch's Arbox
 * name to match a second Arbox location.
 */
export function matchArboxBranch(
  locationName: string | null,
  branches: readonly Branch[],
): Branch | null {
  const wanted = locationName?.trim();
  if (!wanted) return null;

  return (
    branches.find(
      (branch) =>
        branch.is_active &&
        branch.arbox_location_name !== null &&
        branch.arbox_location_name.trim() === wanted,
    ) ?? null
  );
}

/** Staff tag קריית אתא clients in Arbox by writing "קריות" into the name. */
const KIRYAT_ATA_NAME_TAG = "קריות";
const KIRYAT_ATA_BRANCH = "קריית אתא";
const HAIFA_BRANCH = "חיפה";

/**
 * The branch the staff's naming convention points to: "קריות" anywhere in
 * the Arbox name means קריית אתא, anything else means חיפה (Itay, 2026-09-26).
 * Null when that branch is missing or inactive.
 */
export function branchFromArboxName(fullName: string | null, branches: readonly Branch[]): Branch | null {
  const wanted = fullName?.includes(KIRYAT_ATA_NAME_TAG) ? KIRYAT_ATA_BRANCH : HAIFA_BRANCH;
  return branches.find((branch) => branch.is_active && branch.name_he.trim() === wanted) ?? null;
}

export interface ArboxBranchInput {
  locationName: string | null;
  fullName: string | null;
  /** The profile's branches today. */
  currentBranchIds: readonly string[];
  /** Set when an admin chose the branches by hand; the sync never overrides that. */
  setByAdminAt: string | null;
  isTrainee: boolean;
}

/**
 * The branch the nightly sync should put this profile in, or null to leave it.
 * A matching Arbox location wins; otherwise a trainee with no branch at all
 * gets the one the name points to, so nobody the sync creates is left
 * invisible to staff. Existing memberships and staff are never guessed at.
 */
export function arboxBranchFor(input: ArboxBranchInput, branches: readonly Branch[]): Branch | null {
  if (input.setByAdminAt) return null;
  const byLocation = matchArboxBranch(input.locationName, branches);
  if (byLocation) return byLocation;
  if (!input.isTrainee || input.currentBranchIds.length > 0) return null;
  return branchFromArboxName(input.fullName, branches);
}
