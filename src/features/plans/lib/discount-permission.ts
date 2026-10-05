import "server-only";

import { verifyAdminOrBranchManager } from "@/lib/actions/shared/verify-branch-manager";

/**
 * Setting the price (a Discount, or a manual Card's terms) is for an Admin
 * or the branch's manager. Null when allowed, or when the sale sets none.
 */
export const pricingRefusal = (branchId: string, setsPrice: boolean): Promise<string | null> =>
  setsPrice ? verifyAdminOrBranchManager([branchId]) : Promise.resolve(null);
