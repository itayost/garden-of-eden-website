/**
 * Rescore every rating snapshot against today's benchmarks, or preview it.
 *
 * Snapshots are frozen when an assessment is saved, so they keep whatever
 * scale the benchmarks had then. After the benchmarks change (the 2026-09-30
 * unit cleanup), this recomputes them with the same rateAssessment() the app
 * uses: the age group on the assessment date (a staff-set group while it
 * lasts), rated against that group's current benchmarks.
 *
 * Usage:
 *   npx tsx scripts/rescore-rating-snapshots.ts           # preview, writes nothing
 *   npx tsx scripts/rescore-rating-snapshots.ts --write   # upsert the new snapshots
 *
 * CRITICAL: --write changes PRODUCTION rating snapshots. Badges are not touched.
 * An assessment that can no longer be rated (no birthdate, a birthdate after
 * the assessment, a group without benchmarks) keeps its old snapshot and is
 * listed in the report.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadEnvLocal, getAdminClient } from "./import-utils";
import {
  AGE_GROUP_PROFILE_COLUMNS,
  rateAssessment,
  type RatingSnapshotRow,
} from "../src/features/player-assessments/lib/snapshot";
import type { AgeGroupProfile } from "../src/lib/age-group-override";
import { fetchGroupStats } from "../src/lib/utils/fetch-benchmarks";
import { AGE_GROUPS, type PlayerAssessment } from "../src/types/assessment";
import type { GroupStats } from "../src/lib/assessment-to-rating";

const WRITE = process.argv.includes("--write");
const PAGE_SIZE = 1000;
const UPSERT_CHUNK = 100;

const STAT_FIELDS = [
  "pace",
  "shooting",
  "passing",
  "dribbling",
  "defending",
  "physical",
  "overall_rating",
] as const;
type StatField = (typeof STAT_FIELDS)[number];

type StoredSnapshot = Pick<RatingSnapshotRow, "assessment_id" | "age_group" | StatField>;

async function fetchAll<T>(
  supabase: SupabaseClient,
  table: string,
  columns: string,
  onlyLive: boolean
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    let query = supabase.from(table).select(columns).order("id").range(from, from + PAGE_SIZE - 1);
    if (onlyLive) query = query.is("deleted_at", null);
    const { data, error } = await query;
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

function differs(before: StoredSnapshot, after: RatingSnapshotRow): boolean {
  return before.age_group !== after.age_group || STAT_FIELDS.some((f) => before[f] !== after[f]);
}

function describeDeltas(values: readonly number[]): string {
  if (values.length === 0) return "-";
  const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
  const up = values.filter((v) => v > 0).length;
  const down = values.filter((v) => v < 0).length;
  const big = values.filter((v) => Math.abs(v) >= 10).length;
  return `mean ${avg >= 0 ? "+" : ""}${avg.toFixed(1)}, ${up} up, ${down} down, ${big} by 10+`;
}

function countBy(keys: readonly string[]): string {
  const counts = new Map<string, number>();
  for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k}: ${n}`).join(", ") || "none";
}

async function main(): Promise<void> {
  loadEnvLocal();
  const supabase = getAdminClient();
  console.log(WRITE ? "[WRITE] rescoring rating snapshots\n" : "[PREVIEW] nothing is written\n");

  const [assessments, snapshots, profiles] = await Promise.all([
    fetchAll<PlayerAssessment>(supabase, "player_assessments", "*", true),
    fetchAll<StoredSnapshot>(
      supabase,
      "player_rating_snapshots",
      `assessment_id, age_group, ${STAT_FIELDS.join(", ")}`,
      true
    ),
    fetchAll<{ id: string } & AgeGroupProfile>(supabase, "profiles", `id, ${AGE_GROUP_PROFILE_COLUMNS}`, false),
  ]);

  const statsByGroup = new Map<string, GroupStats | null>();
  for (const group of AGE_GROUPS) {
    statsByGroup.set(group.id, await fetchGroupStats(supabase, group.id));
  }
  const profileByUser = new Map(profiles.map((p) => [p.id, p]));
  const stored = new Map(snapshots.map((s) => [s.assessment_id, s]));

  const toWrite: RatingSnapshotRow[] = [];
  const groupMoves: string[] = [];
  const keptStale: string[] = [];
  const deltas = new Map<StatField, number[]>(STAT_FIELDS.map((f) => [f, []]));
  let unchanged = 0;
  let created = 0;
  let unrated = 0;

  for (const assessment of assessments) {
    const before = stored.get(assessment.id);
    const rated = rateAssessment(assessment, profileByUser.get(assessment.user_id) ?? null, statsByGroup);

    if (!rated.ok) {
      if (before) keptStale.push(`${rated.reason} (was ${before.age_group ?? "none"})`);
      else unrated++;
      continue;
    }
    if (!before) {
      created++;
      toWrite.push(rated.row);
      continue;
    }
    if (!differs(before, rated.row)) {
      unchanged++;
      continue;
    }
    toWrite.push(rated.row);
    if (before.age_group !== rated.row.age_group) {
      groupMoves.push(`${before.age_group ?? "none"} -> ${rated.row.age_group}`);
    }
    for (const field of STAT_FIELDS) {
      const was = before[field];
      const now = rated.row[field];
      if (was !== null && now !== null) deltas.get(field)!.push(now - was);
    }
  }

  console.log(`${assessments.length} live assessments, ${snapshots.length} snapshots`);
  console.log(`  changed:   ${toWrite.length - created}`);
  console.log(`  unchanged: ${unchanged}`);
  console.log(`  new:       ${created} (assessments that had no snapshot)`);
  console.log(`  unrated:   ${unrated} (no snapshot before or after)`);
  console.log(`  kept, cannot be rescored: ${keptStale.length} -> ${countBy(keptStale)}`);
  console.log(`\ngroup moves: ${countBy(groupMoves)}`);
  console.log("\nmean change per stat, over changed snapshots:");
  for (const field of STAT_FIELDS) {
    const values = deltas.get(field)!;
    console.log(`  ${field.padEnd(15)} ${describeDeltas(values)}  (${values.length} snapshots)`);
  }

  if (!WRITE) {
    console.log(`\n${toWrite.length} snapshots would be written. Rerun with --write to apply.`);
    return;
  }

  const computedAt = new Date().toISOString();
  for (let i = 0; i < toWrite.length; i += UPSERT_CHUNK) {
    const chunk = toWrite.slice(i, i + UPSERT_CHUNK).map((row) => ({ ...row, computed_at: computedAt }));
    const { error } = await supabase
      .from("player_rating_snapshots")
      .upsert(chunk, { onConflict: "assessment_id" });
    if (error) throw new Error(`upsert at ${i}: ${error.message}`);
  }
  console.log(`\n${toWrite.length} snapshots written.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
