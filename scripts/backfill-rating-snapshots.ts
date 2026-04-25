// scripts/backfill-rating-snapshots.ts
//
// One-time backfill: for every non-deleted player_assessments row, write a
// player_rating_snapshots row and grant any retroactive badges (silently —
// preCelebrated = true).
//
// Idempotent: UPSERTs the snapshot keyed on assessment_id; UNIQUE constraint
// on user_achievements absorbs duplicate grants.
//
// Usage: npx tsx scripts/backfill-rating-snapshots.ts [--dry-run]
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import { writeRatingSnapshot } from "../src/features/player-assessments/lib/snapshot";
import { grantAssessmentBadges } from "../src/features/achievements/lib/actions/grant-assessment-badges";
import type { PlayerAssessment } from "../src/types/assessment";

const dryRun = process.argv.includes("--dry-run");

const env: Record<string, string> = {};
for (const line of fs.readFileSync(".env.local", "utf-8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i === -1) continue;
  let v = t.slice(i + 1).trim();
  if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
  v = v.replace(/\\n$/g, "");
  env[t.slice(0, i).trim()] = v;
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log(dryRun ? "[DRY RUN] " : "[LIVE] ", "starting backfill");

  // Process per user, in date order, so badge deltas are computed correctly.
  const { data: profiles, error: pErr } = await supabase
    .from("profiles")
    .select("id, birthdate")
    .eq("role", "trainee");
  if (pErr) throw pErr;

  let snapshotCount = 0;
  let badgeUserCount = 0;
  let userCount = 0;

  for (const p of profiles ?? []) {
    const { data: rows, error: aErr } = await supabase
      .from("player_assessments")
      .select("*")
      .eq("user_id", p.id)
      .is("deleted_at", null)
      .order("assessment_date", { ascending: true });
    if (aErr) {
      console.error(`fetch assessments failed for ${p.id}:`, aErr);
      continue;
    }
    const assessments = (rows ?? []) as PlayerAssessment[];
    if (assessments.length === 0) continue;
    userCount++;

    for (const a of assessments) {
      if (dryRun) {
        snapshotCount++;
        continue;
      }
      const result = await writeRatingSnapshot(supabase, a, p.birthdate);
      if (result.ok) snapshotCount++;
      else if (result.reason !== "no_age_group" && result.reason !== "no_benchmarks") {
        console.error(`snapshot failed for assessment ${a.id}:`, result.reason);
      }
      // Grant badges using the snapshots we just wrote.
      await grantAssessmentBadges(supabase, a, { preCelebrated: true });
    }
    badgeUserCount++;
    if (userCount % 25 === 0) console.log(`processed ${userCount} users`);
  }

  console.log(`Done. ${snapshotCount} snapshots ${dryRun ? "would be written" : "written"}, ${badgeUserCount} users processed for badges.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
