import "server-only";

import { unstable_cache } from "next/cache";
import { verifyAdmin } from "@/lib/actions/shared";
import { countEndingRetention } from "@/lib/retention/ending-soon-load";
import { ENDING_SOON_TAG } from "./cache-tags";

/**
 * Ten minutes. A plan change marks it stale through revalidateStaffSurfaces,
 * and the badge refreshes in the background; card payments and trainee
 * bookings do not, so they rely on the ten minutes.
 */
const BADGE_SECONDS = 600;

const cachedCount = unstable_cache(
  async () => countEndingRetention(),
  ["finance-ending-soon-count"],
  { revalidate: BADGE_SECONDS, tags: [ENDING_SOON_TAG] },
);

/** The badge on שימור לקוחות, for admins: the ending-soon tab's count. 0 for others and on any failure, so the menu never breaks. */
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
