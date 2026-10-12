import "server-only";

import { unstable_cache } from "next/cache";
import { verifyAdmin } from "@/lib/actions/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { israelToday } from "@/lib/utils/tasks";
import { ENDING_SOON_TAG } from "./cache-tags";
import { endingSoonCount } from "./ending-soon";
import { loadEndingInputs } from "./queries";

/** Ten minutes; plan changes clear it at once through revalidateStaffSurfaces. */
const BADGE_SECONDS = 600;

const cachedCount = unstable_cache(
  async () => endingSoonCount(await loadEndingInputs(createAdminClient(), null), israelToday()),
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
