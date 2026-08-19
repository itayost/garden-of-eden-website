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
 *
 * `arbox_paid_training` is treated as monotonic -- it can be set, never cleared.
 * The fact means "ever paid to train", which cannot stop being true, and that
 * makes the worst failure mode impossible: a transient empty or partial Arbox
 * response can no longer rewrite every paying member to course-only. Correcting
 * a wrongly-set flag is what `access_override` is for.
 *
 * `arbox_bought_course` may move in either direction. Gaining it can only
 * restrict someone who has never trained here, and losing it only widens access.
 */

const PROFILE_PAGE_SIZE = 1000;

export interface AccessSyncResult {
  paidTrainingUsers: number;
  courseBuyers: number;
  linkedProfiles: number;
  updated: number;
  /** Profiles Arbox no longer lists as paid, whose flag was kept anyway. */
  keptPaidFlag: number;
}

interface ProfileRow {
  id: string;
  arbox_user_id: number | null;
  arbox_paid_training: boolean;
  arbox_bought_course: boolean;
}

export interface AccessSyncPlan {
  readonly result: AccessSyncResult;
  readonly changes: readonly {
    readonly profile: ProfileRow;
    readonly paid: boolean;
    readonly course: boolean;
  }[];
}

/** Every linked trainee profile, paged past PostgREST's row cap. */
async function readLinkedProfiles(
  db: ReturnType<typeof createAdminClient>
): Promise<ProfileRow[]> {
  const all: ProfileRow[] = [];

  for (let offset = 0; ; offset += PROFILE_PAGE_SIZE) {
    const { data, error } = await db
      .from("profiles")
      .select("id, arbox_user_id, arbox_paid_training, arbox_bought_course")
      .eq("role", "trainee")
      .is("deleted_at", null)
      .not("arbox_user_id", "is", null)
      .order("id", { ascending: true })
      .range(offset, offset + PROFILE_PAGE_SIZE - 1);

    if (error) throw new Error(`read profiles: ${error.message}`);

    const rows = (data ?? []) as ProfileRow[];
    all.push(...rows);
    if (rows.length < PROFILE_PAGE_SIZE) break;
  }

  return all;
}

/** Work out what would change, without writing anything. */
export async function planCourseAccessSync(): Promise<AccessSyncPlan> {
  const [paidTraining, courseBuyers] = await Promise.all([
    fetchPaidTrainingUserIds(),
    fetchCourseBuyerIds(),
  ]);

  const db = createAdminClient();
  const profiles = await readLinkedProfiles(db);

  const changes: AccessSyncPlan["changes"][number][] = [];
  let keptPaidFlag = 0;

  for (const profile of profiles) {
    const arboxId = profile.arbox_user_id;
    if (arboxId === null) continue;

    const seenPaid = paidTraining.has(arboxId);
    // Monotonic: an existing true survives an Arbox response that omits it.
    const paid = profile.arbox_paid_training || seenPaid;
    if (profile.arbox_paid_training && !seenPaid) keptPaidFlag++;

    const course = courseBuyers.has(arboxId);

    if (
      paid !== profile.arbox_paid_training ||
      course !== profile.arbox_bought_course
    ) {
      changes.push({ profile, paid, course });
    }
  }

  return {
    result: {
      paidTrainingUsers: paidTraining.size,
      courseBuyers: courseBuyers.size,
      linkedProfiles: profiles.length,
      updated: changes.length,
      keptPaidFlag,
    },
    changes,
  };
}

export async function syncCourseAccess(): Promise<AccessSyncResult> {
  const { result, changes } = await planCourseAccessSync();
  const db = createAdminClient();
  const syncedAt = new Date().toISOString();

  if (result.keptPaidFlag > 0) {
    // Not fatal, but a large number here means Arbox returned less than it
    // should have, and the next run is worth watching.
    console.warn(
      `[Arbox Access] ${result.keptPaidFlag} profiles are flagged as having paid ` +
        `for training but were absent from this run's Arbox data; flags kept.`
    );
  }

  let updated = 0;
  for (const { profile, paid, course } of changes) {
    const { error } = await db
      .from("profiles")
      .update({
        arbox_paid_training: paid,
        arbox_bought_course: course,
        arbox_access_synced_at: syncedAt,
      })
      .eq("id", profile.id);

    if (error) {
      // One bad row must not abandon the rest of the sweep.
      console.error(`[Arbox Access] update ${profile.id} failed:`, error.message);
      continue;
    }
    updated++;
  }

  // Stamp everyone the run actually considered, not only those that changed --
  // otherwise the admin card reads "never synced" for the majority of trainees
  // however long the nightly job has been running.
  const unchangedIds = changes.length
    ? new Set(changes.map((c) => c.profile.id))
    : new Set<string>();
  const toStamp = (await readLinkedProfiles(db))
    .filter((p) => !unchangedIds.has(p.id))
    .map((p) => p.id);

  for (let i = 0; i < toStamp.length; i += PROFILE_PAGE_SIZE) {
    const batch = toStamp.slice(i, i + PROFILE_PAGE_SIZE);
    const { error } = await db
      .from("profiles")
      .update({ arbox_access_synced_at: syncedAt })
      .in("id", batch);
    if (error) {
      console.error("[Arbox Access] stamping synced_at failed:", error.message);
      break;
    }
  }

  return { ...result, updated };
}
