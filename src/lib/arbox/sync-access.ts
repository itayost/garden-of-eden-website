import { createAdminClient } from "@/lib/supabase/admin";
import { fetchPaidTrainingUserIds, fetchCourseBuyerIds } from "./access";

/**
 * Refresh each linked trainee's Arbox purchase facts.
 *
 * Writes only the two facts. The access tier is derived from them at read time
 * by `resolveAccessTier`, and `access_override` belongs to the admin, so neither
 * is touched here.
 *
 * A profile with no `arbox_user_id` is skipped rather than cleared: it cannot be
 * classified, and leaving it alone leaves it on full access, which is the safe
 * direction.
 */

export interface AccessSyncResult {
  paidTrainingUsers: number;
  courseBuyers: number;
  linkedProfiles: number;
  updated: number;
}

interface ProfileRow {
  id: string;
  arbox_user_id: number | null;
  arbox_paid_training: boolean;
  arbox_bought_course: boolean;
}

export async function syncCourseAccess(): Promise<AccessSyncResult> {
  const [paidTraining, courseBuyers] = await Promise.all([
    fetchPaidTrainingUserIds(),
    fetchCourseBuyerIds(),
  ]);

  const db = createAdminClient();
  const { data, error } = await db
    .from("profiles")
    .select("id, arbox_user_id, arbox_paid_training, arbox_bought_course")
    .eq("role", "trainee")
    .is("deleted_at", null)
    .not("arbox_user_id", "is", null);

  if (error) throw new Error(`read profiles: ${error.message}`);

  const profiles = (data ?? []) as ProfileRow[];
  const syncedAt = new Date().toISOString();
  let updated = 0;

  for (const profile of profiles) {
    const arboxId = profile.arbox_user_id;
    if (arboxId === null) continue;

    const paid = paidTraining.has(arboxId);
    const course = courseBuyers.has(arboxId);
    if (
      paid === profile.arbox_paid_training &&
      course === profile.arbox_bought_course
    ) {
      continue;
    }

    const { error: updateError } = await db
      .from("profiles")
      .update({
        arbox_paid_training: paid,
        arbox_bought_course: course,
        arbox_access_synced_at: syncedAt,
      })
      .eq("id", profile.id);

    if (updateError) {
      // One bad row must not abandon the rest of the sweep.
      console.error(
        `[Arbox Access] update ${profile.id} failed:`,
        updateError.message
      );
      continue;
    }
    updated++;
  }

  return {
    paidTrainingUsers: paidTraining.size,
    courseBuyers: courseBuyers.size,
    linkedProfiles: profiles.length,
    updated,
  };
}
