"use server";

import { revalidatePath } from "next/cache";

import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { syncArboxUsers } from "@/lib/arbox/sync";
import { arboxSyncSummary } from "@/lib/arbox/sync-summary";
import { checkRateLimit } from "@/lib/rate-limit";
import { runArboxPurchaseImport } from "../arbox-import";
import { revalidateStaffSurfaces } from "../revalidate-staff";

type SyncNowResult = { success: true; message: string } | { error: string };

/**
 * "סנכרון עם Arbox": the two nightly steps staff need during the day. The user
 * sync links new Arbox clients and places them in a branch; the purchase
 * import then turns their new cards and memberships into plans. Birthdays
 * and the course-access step stay nightly: they are slow and not urgent.
 *
 * Runs the import regardless of ARBOX_IMPORT_PURCHASES, which gates only the
 * unattended nightly run; pressing the button is the staff's decision.
 */
export async function syncArboxNowAction(): Promise<SyncNowResult> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  if (!process.env.ARBOX_API_KEY) return { error: "החיבור ל-Arbox לא מוגדר" };

  // One key for the whole staff: the limit protects Arbox, not a user.
  const limit = await checkRateLimit("arbox-sync:manual", "arbox_sync");
  if (limit.rateLimited) return { error: "סנכרון רץ לפני פחות מ-5 דקות. נסו שוב בעוד כמה דקות." };

  try {
    const users = await syncArboxUsers();
    const { result } = await runArboxPurchaseImport({ dryRun: false });
    result.touchedProfileIds.forEach(revalidateStaffSurfaces);
    revalidatePath("/admin/users");
    return {
      success: true,
      message: arboxSyncSummary({
        usersCreated: users.created,
        plansCreated: result.created,
        plansPastTheirEnd: result.pastTheirEnd,
        purchasesFailed: result.failed,
      }),
    };
  } catch (error) {
    console.error("[Arbox Sync] Manual sync failed:", error);
    return { error: "הסנכרון עם Arbox נכשל. נסו שוב מאוחר יותר." };
  }
}
