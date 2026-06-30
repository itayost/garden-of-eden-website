/**
 * One-time migration: populate book_muscles and book_drill_muscles from
 * the free-text book_drills.muscle_he column.
 *
 * Usage:
 *   npx tsx scripts/migrate-drill-muscles.ts --dry-run   # parse only, no DB writes
 *   npx tsx scripts/migrate-drill-muscles.ts             # write to production DB
 *
 * CRITICAL: targets the PRODUCTION Supabase database.
 * Run the real migration only after the book_muscles / book_drill_muscles
 * migration has been applied (supabase db push).
 *
 * Idempotency: aborts early if book_muscles already contains rows.
 */

import { parseMuscleTokens } from "../src/features/development-book/lib/muscle-utils";
import { loadEnvLocal, getAdminClient } from "./import-utils";

const DRY_RUN = process.argv.includes("--dry-run");

// ---------------------------------------------------------------------------
// Dry-run path: reads DB (safe, read-only), prints stats, exits before writes
// ---------------------------------------------------------------------------

async function runDryRun(): Promise<void> {
  console.log("=== migrate-drill-muscles --dry-run ===\n");

  loadEnvLocal();
  const db = getAdminClient();

  const { data: drills, error } = await db
    .from("book_drills")
    .select("id, muscle_he");

  if (error) {
    console.error("Failed to read book_drills:", error);
    process.exit(1);
  }

  if (!drills || drills.length === 0) {
    console.log("No drills found — nothing to migrate.");
    return;
  }

  // Build the distinct muscle set and count links
  const muscleSet = new Map<string, { emoji: string | null; orderIndex: number }>();
  let totalLinks = 0;
  const samples: Array<{ drillId: string; muscleHe: string | null; tokens: string[] }> = [];

  for (const drill of drills) {
    const tokens = parseMuscleTokens(drill.muscle_he as string | null);
    if (tokens.length > 0) {
      totalLinks += tokens.length;
    }
    for (const token of tokens) {
      if (!muscleSet.has(token.nameHe)) {
        muscleSet.set(token.nameHe, { emoji: token.emoji, orderIndex: muscleSet.size });
      }
    }
    if (samples.length < 5 && drill.muscle_he) {
      samples.push({
        drillId: drill.id as string,
        muscleHe: drill.muscle_he as string | null,
        tokens: tokens.map((t) => (t.emoji ? `${t.emoji} ${t.nameHe}` : t.nameHe)),
      });
    }
  }

  console.log(`drills read:         ${drills.length}`);
  console.log(`distinct muscles:    ${muscleSet.size}`);
  console.log(`total links:         ${totalLinks}`);
  console.log("");

  if (samples.length > 0) {
    console.log("--- Sample parses ---");
    for (const s of samples) {
      console.log(`  muscle_he: "${s.muscleHe}"`);
      console.log(`  -> tokens: [${s.tokens.join(", ")}]`);
      console.log("");
    }
  }

  console.log("Dry run complete. No DB writes performed.");
  console.log("To run the real migration: npx tsx scripts/migrate-drill-muscles.ts");
}

// ---------------------------------------------------------------------------
// Real migration path
// ---------------------------------------------------------------------------

async function runMigration(): Promise<void> {
  console.log("=== migrate-drill-muscles (LIVE DB) ===\n");

  loadEnvLocal();
  const db = getAdminClient();

  // Guard: abort if already migrated
  const { count, error: countErr } = await db
    .from("book_muscles")
    .select("id", { count: "exact", head: true });

  if (countErr) {
    console.error("Failed to check book_muscles:", countErr);
    process.exit(1);
  }

  if (count !== null && count > 0) {
    console.log(`book_muscles already has ${count} row(s) — already migrated. Aborting.`);
    process.exit(0);
  }

  // Read all drills
  const { data: drills, error: drillsErr } = await db
    .from("book_drills")
    .select("id, muscle_he");

  if (drillsErr) {
    console.error("Failed to read book_drills:", drillsErr);
    process.exit(1);
  }

  if (!drills || drills.length === 0) {
    console.log("No drills found — nothing to migrate.");
    return;
  }

  // Build distinct muscles (first occurrence wins for emoji; insertion order = order_index)
  const muscleOrder: Array<{ nameHe: string; emoji: string | null; orderIndex: number }> = [];
  const muscleIndex = new Map<string, number>(); // nameHe -> position in muscleOrder

  for (const drill of drills) {
    const tokens = parseMuscleTokens(drill.muscle_he as string | null);
    for (const token of tokens) {
      if (!muscleIndex.has(token.nameHe)) {
        const idx = muscleOrder.length;
        muscleOrder.push({ nameHe: token.nameHe, emoji: token.emoji, orderIndex: idx });
        muscleIndex.set(token.nameHe, idx);
      }
    }
  }

  console.log(`Inserting ${muscleOrder.length} distinct muscles...`);

  const { data: insertedMuscles, error: musclesErr } = await db
    .from("book_muscles")
    .insert(
      muscleOrder.map((m) => ({
        name_he: m.nameHe,
        emoji: m.emoji ?? null,
        order_index: m.orderIndex,
      }))
    )
    .select("id, name_he");

  if (musclesErr || !insertedMuscles) {
    console.error("Failed to insert book_muscles:", musclesErr);
    process.exit(1);
  }

  // Build nameHe -> id map from returned rows
  const muscleIdByName = new Map<string, string>();
  for (const row of insertedMuscles) {
    muscleIdByName.set(row.name_he as string, row.id as string);
  }

  // Build link rows
  const linkRows: Array<{ drill_id: string; muscle_id: string }> = [];
  for (const drill of drills) {
    const tokens = parseMuscleTokens(drill.muscle_he as string | null);
    for (const token of tokens) {
      const muscleId = muscleIdByName.get(token.nameHe);
      if (!muscleId) {
        console.warn(`Warning: no muscle id for "${token.nameHe}" — skipping link.`);
        continue;
      }
      linkRows.push({ drill_id: drill.id as string, muscle_id: muscleId });
    }
  }

  console.log(`Inserting ${linkRows.length} drill-muscle links...`);

  const { error: linksErr } = await db
    .from("book_drill_muscles")
    .insert(linkRows);

  if (linksErr) {
    console.error("Failed to insert book_drill_muscles:", linksErr);
    process.exit(1);
  }

  console.log(`\nMigration complete.`);
  console.log(`  muscles created: ${insertedMuscles.length}`);
  console.log(`  links created:   ${linkRows.length}`);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  if (DRY_RUN) {
    await runDryRun();
  } else {
    await runMigration();
  }
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
