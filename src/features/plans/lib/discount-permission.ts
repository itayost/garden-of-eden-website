import "server-only";

import { verifyAdminOrBranchManager } from "@/lib/actions/shared/verify-branch-manager";
import type { Discount } from "@/lib/plans/discount";

/** A Discount is for an Admin or the branch's manager; null when allowed (or there is none). */
export const discountRefusal = (branchId: string, discount: Discount | null): Promise<string | null> =>
  discount ? verifyAdminOrBranchManager([branchId]) : Promise.resolve(null);
