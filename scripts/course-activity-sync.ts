/**
 * The course-access sweep by hand: who trains now by Arbox and by the app's
 * Plan queues, and who the course gate would lock once the sweep is applied.
 *
 * The same code the nightly cron runs (src/lib/course-access/sync-activity.ts);
 * this is the manual entry point and the dry-run report.
 *
 * Usage (the loaders are server-only, hence the react-server condition):
 *   npx tsx --conditions=react-server scripts/course-activity-sync.ts           # dry run
 *   npx tsx --conditions=react-server scripts/course-activity-sync.ts --apply   # writes
 *
 * Reads PRODUCTION and Arbox. Without --apply it writes nothing. --apply stamps
 * profiles.course_seen_training_on and writes today's sweep row, which starts
 * locking the courses of trainees who do not train now: only with the owner.
 * The locked list prints children's names: keep the output out of git.
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

function printResult(result: ActivitySweepResult): void {
  const { rows } = result;
  console.log(`Mode: ${APPLY ? "APPLY (writes to production)" : "dry run (writes nothing)"}`);
  console.log(
    `Arbox rows: activeMembershipsReport ${rows.memberships}, sessionsReport ${rows.cards}, membersOnHoldReport ${rows.onHold}`,
  );
  console.log(`Arbox ids training now: ${result.arboxIds}`);
  console.log(`Plan trainees training now: ${result.planTrainees}`);
  console.log(`good: ${result.good}${result.reason ? ` (${result.reason})` : ""}`);
  console.log(`${APPLY ? "Stamped" : "Would stamp"}: ${result.stamped}`);

  console.log(`\nWould lock: ${result.wouldLock.length}`);
  for (const [branch, trainees] of byBranch(result.wouldLock)) {
    console.log(`\n${branch} (${trainees.length})`);
    for (const t of trainees) {
      console.log(`  ${t.fullName || "(no name)"} | Arbox link: ${t.linkedToArbox ? "yes" : "no"}`);
    }
  }
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
