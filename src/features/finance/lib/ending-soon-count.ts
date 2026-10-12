import "server-only";

import { unstable_cache } from "next/cache";
import { verifyAdmin } from "@/lib/actions/shared";
import { israelToday } from "@/lib/utils/tasks";
import { ENDING_SOON_TAG } from "./cache-tags";
import { endingSoonCount } from "./ending-soon";
import { loadEndingInputs } from "./queries";

/**
 * Ten minutes. A plan change marks it stale through revalidateStaffSurfaces,
 * and the badge refreshes in the background; card payments and trainee
 * bookings do not, so they rely on the ten minutes.
 */
const BADGE_SECONDS = 600;

const cachedCount = unstable_cache(
  async () => endingSoonCount(await loadEndingInputs(null), israelToday()),
  ["finance-ending-soon-count"],
  { revalidate: BADGE_SECONDS, tags: [ENDING_SOON_TAG] },
);

/** The menu badge: 0 for non-admins and on any failure, so the menu never breaks. */
export async function endingSoonBadgeCount(): Promise<number> {
  const { error } = await verifyAdmin();
  if (error) return 0;
  try {
    return await cachedCount();
  } catch (err) {
    console.error("endingSoonBadgeCount failed:", err);
    return 0;
  }
}
