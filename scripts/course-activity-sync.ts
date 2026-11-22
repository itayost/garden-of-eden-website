/**
 * The course-access sweep by hand: who trains now by Arbox and by the app's
 * Plan queues, and who the course gate would lock once the rule is on.
 *
 * The same code the nightly cron runs (src/lib/course-access/sync-activity.ts);
 * this is the manual entry point and the dry-run report.
 *
 * Usage (the loaders are server-only, hence the react-server condition):
 *   npx tsx --conditions=react-server scripts/course-activity-sync.ts           # dry run
 *   npx tsx --conditions=react-server scripts/course-activity-sync.ts --apply   # writes
 *
 * Reads PRODUCTION and Arbox. Without --apply it writes nothing. --apply stamps
 * profiles.course_seen_training_on and writes today's sweep row: only with the
 * owner. The rule switches on once the oldest sweep row is 7 days old
 * (COURSE_ACTIVE_GRACE_DAYS, `effectiveLastGoodSweep`): the day of the first
 * sweep row and the six after it lock nobody, which is the week staff have to
 * mark the trainees on the list; from then on the rule locks the courses of
 * trainees who do not train now. "Would lock" counts who that would be.
 * Only the dry run lists them by name, and the list prints children's names:
 * keep the output out of git.
 */
import type { ActivitySweepResult } from "../src/lib/course-access/sync-activity";
import { loadEnvLocal } from "./import-utils";

const APPLY = process.argv.includes("--apply");
const NO_BRANCH = "(no branch)";

type Locked = ActivitySweepResult["wouldLock"][number];

/** Loaded after the env, and only under react-server: the loaders are server-only. */
async function loadSweep() {
  try {
    return (await import("../src/lib/course-access/sync-activity")).syncCourseActivity;
  } catch (error) {
    if (error instanceof Error && error.message.includes("Server Component")) {
      console.error("the loaders are server-only: run it with npx tsx --conditions=react-server scripts/course-activity-sync.ts");
      process.exit(1);
    }
    throw error;
  }
}

/** The locked list by branch (a trainee of two branches under both names joined), in Hebrew order. */
function byBranch(locked: readonly Locked[]): [string, Locked[]][] {
  const he = new Intl.Collator("he");
  const keyOf = (t: Locked) => (t.branches.length > 0 ? [...t.branches].sort(he.compare).join(" + ") : NO_BRANCH);
  const keys = [...new Set(locked.map(keyOf))].sort(he.compare);
  return keys.map((key) => [
    key,
    locked.filter((t) => keyOf(t) === key).sort((a, b) => he.compare(a.fullName, b.fullName)),
  ]);
}

function printReports(result: ActivitySweepResult): void {
  const { rows, rowsWithId } = result;
  console.log("Arbox reports (rows, rows with a user id):");
  console.log(`  activeMembershipsReport ${rows.memberships}, ${rowsWithId.memberships} with a user id`);
  console.log(`  sessionsReport ${rows.cards}, ${rowsWithId.cards} with a user id`);
  console.log(`  membersOnHoldReport ${rows.onHold}, ${rowsWithId.onHold} with a user id`);
}

function printLocked(result: ActivitySweepResult): void {
  if (!result.good || result.wouldLockCount === null) {
    console.log("\nWould lock: not computed (the sweep is not good)");
    return;
  }
  console.log(`\nWould lock: ${result.wouldLockCount}`);
  if (APPLY) {
    console.log("(names are listed on a dry run only)");
    return;
  }
  for (const [branch, trainees] of byBranch(result.wouldLock)) {
    console.log(`\n${branch} (${trainees.length})`);
    for (const t of trainees) {
      console.log(`  ${t.fullName || "(no name)"} | Arbox link: ${t.linkedToArbox ? "yes" : "no"}`);
    }
  }
}

function printResult(result: ActivitySweepResult): void {
  console.log(`Mode: ${APPLY ? "APPLY (writes to production)" : "dry run (writes nothing)"}`);
  printReports(result);
  console.log(`Arbox ids training now: ${result.arboxIds}`);
  console.log(`Plan trainees training now: ${result.planTrainees}`);
  console.log(`good: ${result.good}${result.reason ? ` (${result.reason})` : ""}`);
  console.log(`${APPLY ? "Stamped" : "Would stamp"}: ${result.stamped}`);
  printLocked(result);
}

async function main(): Promise<void> {
  loadEnvLocal();
  const syncCourseActivity = await loadSweep();
  const result = await syncCourseActivity({ dryRun: !APPLY });
  printResult(result);
  if (!result.good) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
