/**
 * Sync each trainee's Arbox purchase facts onto their profile, or preview it.
 *
 * The classification and the write both live in
 * `src/lib/arbox/sync-access.ts`, which the nightly cron also calls -- this
 * script is the manual entry point and the dry-run reporter, not a second
 * implementation.
 *
 * Usage:
 *   npx tsx scripts/sync-course-access.ts --dry-run
 *   npx tsx scripts/sync-course-access.ts
 *
 * CRITICAL: writes to the PRODUCTION Supabase database. --dry-run is safe.
 */

import {
  planCourseAccessSync,
  syncCourseAccess,
} from "../src/lib/arbox/sync-access.ts";
import { resolveAccessTier } from "../src/lib/access/course-access.ts";
import { loadEnvLocal } from "./import-utils.ts";

const DRY_RUN = process.argv.includes("--dry-run");

async function main(): Promise<void> {
  loadEnvLocal();

  console.log("Reading purchase history from Arbox...");
  const { result, changes } = await planCourseAccessSync();

  console.log(`  ${result.paidTrainingUsers} users have ever paid for training`);
  console.log(`  ${result.courseBuyers} users have bought the digital course`);
  console.log(`  ${result.linkedProfiles} trainee profiles are linked to Arbox\n`);

  if (result.keptPaidFlag > 0) {
    console.log(
      `  note: ${result.keptPaidFlag} profiles keep a paid-training flag that this ` +
        `run's Arbox data did not confirm (the flag is never cleared)\n`
    );
  }

  const restricted = changes.filter(
    ({ paid, course }) =>
      resolveAccessTier({
        arboxPaidTraining: paid,
        arboxBoughtCourse: course,
        accessOverride: null,
      }) === "course_only"
  );

  if (restricted.length > 0) {
    console.log(`${restricted.length} profiles would become course-only:`);
    for (const { profile } of restricted) {
      console.log(`  arbox=${profile.arbox_user_id}`);
    }
    console.log();
  }

  console.log(`${changes.length} profiles need updating.`);

  if (DRY_RUN) {
    console.log("Dry run -- no DB writes.");
    return;
  }

  const applied = await syncCourseAccess();
  console.log(`Updated ${applied.updated} profiles.`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
