import "server-only";

import { cache } from "react";
import { createAdminClient } from "@/lib/supabase/admin";
import { loadBookableBranchForUser } from "./queries";

/** Whether this trainee has a branch with self-booking, once per request. */
export const canBookForUser = cache(async (userId: string): Promise<boolean> => {
  return (await loadBookableBranchForUser(createAdminClient(), userId)) !== null;
});
