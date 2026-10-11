import "server-only";

import { revalidatePath } from "next/cache";

/**
 * Every staff screen that shows a trainee's plan or orders. Null for an order
 * with no account yet (a new trainee's Payment link): the lists still change.
 */
export function revalidateStaffSurfaces(profileId: string | null): void {
  if (profileId) revalidatePath(`/admin/users/${profileId}`);
  revalidatePath("/admin/users");
  revalidatePath("/admin/plans");
  revalidatePath("/admin/orders");
  revalidatePath("/admin/schedule");
  revalidatePath("/admin/calendar");
}
