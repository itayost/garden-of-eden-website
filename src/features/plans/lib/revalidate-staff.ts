import "server-only";

import { revalidatePath } from "next/cache";

/** Every staff screen that shows a trainee's plan or orders. */
export function revalidateStaffSurfaces(profileId: string): void {
  revalidatePath(`/admin/users/${profileId}`);
  revalidatePath("/admin/plans");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/schedule");
  revalidatePath("/admin/calendar");
}
