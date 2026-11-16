import { revalidatePath, revalidateTag } from "next/cache";

/** The menu badge's cache (pending reports of the current week, per scope). */
export const WEEKLY_REPORTS_TAG = "weekly-reports";

/**
 * After any change to a weekly report row: the queue page and the badge.
 * The tag expires at once (not stale-while-revalidate), so the render right
 * after an approval already shows the lower count. Works from a server
 * action and from the cron routes alike.
 */
export function revalidateWeeklyReports(): void {
  revalidateTag(WEEKLY_REPORTS_TAG, { expire: 0 });
  revalidatePath("/admin/weekly-reports");
}
