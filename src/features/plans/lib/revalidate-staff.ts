import "server-only";

import { revalidatePath, revalidateTag } from "next/cache";
import { ENDING_SOON_TAG } from "@/features/finance/lib/cache-tags";

/** Every staff screen that shows a trainee's plan or orders. */
export function revalidateStaffSurfaces(profileId: string): void {
  revalidatePath(`/admin/users/${profileId}`);
  revalidatePath("/admin/users");
  revalidatePath("/admin/plans");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/schedule");
  revalidatePath("/admin/calendar");
  revalidatePath("/admin/finance");
  revalidatePath("/admin/finance/ending-soon");
  // Stale-while-revalidate: the next navigation serves the old badge count
  // and the recount runs in the background instead of blocking it.
  revalidateTag(ENDING_SOON_TAG, "max");
}
