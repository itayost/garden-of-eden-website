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
