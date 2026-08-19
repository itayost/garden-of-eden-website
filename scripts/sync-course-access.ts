/**
 * Sync each trainee's Arbox purchase facts onto their profile.
 *
 * Two facts per profile, both meaning "ever", not "currently":
 *   arbox_paid_training  held a plan or session membership
 *   arbox_bought_course  bought the digital course item
 *
 * The access tier is derived from them at read time by
 * `resolveAccessTier` in src/lib/access/course-access.ts, so changing the rule
 * never needs a re-sync. `access_override` is an admin decision and is never
 * written here.
 *
 * Only profiles with an `arbox_user_id` can be classified. An unlinked profile
 * is left alone, which leaves it on full access -- the safe direction.
 *
 * Usage:
 *   node scripts/sync-course-access.ts --dry-run
 *   node scripts/sync-course-access.ts
 *
 * CRITICAL: writes to the PRODUCTION Supabase database. --dry-run is safe.
 */

import {
  fetchPaidTrainingUserIds,
  fetchCourseBuyerIds,
} from "../src/lib/arbox/access.ts";
import { resolveAccessTier } from "../src/lib/access/course-access.ts";
import { loadEnvLocal, getAdminClient } from "./import-utils.ts";

const DRY_RUN = process.argv.includes("--dry-run");

interface ProfileRow {
  id: string;
  full_name: string | null;
  role: string;
  arbox_user_id: number | null;
  arbox_paid_training: boolean;
  arbox_bought_course: boolean;
  access_override: "full" | "course_only" | null;
}

async function main(): Promise<void> {
  loadEnvLocal();
  const db = getAdminClient();

  console.log("Reading purchase history from Arbox...");
  const [paidTraining, courseBuyers] = await Promise.all([
    fetchPaidTrainingUserIds(),
    fetchCourseBuyerIds(),
  ]);
  console.log(`  ${paidTraining.size} users have ever paid for training`);
  console.log(`  ${courseBuyers.size} users have bought the digital course\n`);

  const { data, error } = await db
    .from("profiles")
    .select(
      "id, full_name, role, arbox_user_id, arbox_paid_training, arbox_bought_course, access_override"
    )
    .eq("role", "trainee")
    .is("deleted_at", null);

  if (error) throw new Error(`read profiles: ${error.message}`);

  const profiles = (data ?? []) as ProfileRow[];
  const linked = profiles.filter((p) => p.arbox_user_id !== null);

  console.log(
    `${profiles.length} trainees, ${linked.length} linked to Arbox, ` +
      `${profiles.length - linked.length} unlinked (left on full access)\n`
  );

  const changes: { profile: ProfileRow; paid: boolean; course: boolean }[] = [];

  for (const profile of linked) {
    const paid = paidTraining.has(profile.arbox_user_id!);
    const course = courseBuyers.has(profile.arbox_user_id!);
    if (
      paid !== profile.arbox_paid_training ||
      course !== profile.arbox_bought_course
    ) {
      changes.push({ profile, paid, course });
    }
  }

  // What the tiers will be once the changes land.
  const tiers = new Map<string, number>();
  for (const profile of profiles) {
    const change = changes.find((c) => c.profile.id === profile.id);
    const tier = resolveAccessTier({
      arboxPaidTraining: change?.paid ?? profile.arbox_paid_training,
      arboxBoughtCourse: change?.course ?? profile.arbox_bought_course,
      accessOverride: profile.access_override,
    });
    tiers.set(tier, (tiers.get(tier) ?? 0) + 1);
  }

  console.log("Resulting access tiers:");
  for (const [tier, count] of [...tiers].sort()) {
    console.log(`  ${count.toString().padStart(4)}  ${tier}`);
  }

  const restricted = profiles.filter((profile) => {
    const change = changes.find((c) => c.profile.id === profile.id);
    return (
      resolveAccessTier({
        arboxPaidTraining: change?.paid ?? profile.arbox_paid_training,
        arboxBoughtCourse: change?.course ?? profile.arbox_bought_course,
        accessOverride: profile.access_override,
      }) === "course_only"
    );
  });

  if (restricted.length > 0) {
    console.log("\nWould see only the digital course:");
    for (const p of restricted) {
      console.log(`  ${p.full_name ?? "(no name)"}  arbox=${p.arbox_user_id}`);
    }
  }

  console.log(`\n${changes.length} profiles need updating.`);

  if (DRY_RUN) {
    console.log("Dry run -- no DB writes.");
    return;
  }

  let written = 0;
  const syncedAt = new Date().toISOString();
  for (const { profile, paid, course } of changes) {
    const { error: updateError } = await db
      .from("profiles")
      .update({
        arbox_paid_training: paid,
        arbox_bought_course: course,
        arbox_access_synced_at: syncedAt,
      })
      .eq("id", profile.id);
    if (updateError) {
      throw new Error(`update ${profile.id}: ${updateError.message}`);
    }
    written++;
  }

  console.log(`Updated ${written} profiles.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
