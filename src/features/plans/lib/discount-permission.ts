import "server-only";

import { verifyAdminOrBranchManager } from "@/lib/actions/shared/verify-branch-manager";
import type { Discount } from "@/lib/plans/discount";
import type { ManualCardTerms } from "@/lib/plans/manual-card";

/**
 * Setting the price is for an Admin or the branch's manager: a Discount, or
 * a manual Card's terms. Null when allowed, or when the sale has neither.
 */
export const pricingRefusal = (
  branchId: string,
  sale: { discount: Discount | null; manualCard: ManualCardTerms | null },
): Promise<string | null> =>
  sale.discount || sale.manualCard ? verifyAdminOrBranchManager([branchId]) : Promise.resolve(null);
