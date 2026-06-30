/**
 * Bulk-insert AI-drafted premium drill cards into the player-development book.
 * Reads scripts/data/drill-cards-draft.json (array of card objects keyed by drill_id).
 * Additive + idempotent: skips any drill that already has a card (drill_id is UNIQUE),
 * so the existing 1v1 card and re-runs never duplicate.
 *
 * Each card is inserted atomically: if any child insert fails, the card row is rolled
 * back (deleted, cascading its children) so a re-run retries it cleanly instead of
 * leaving a permanent half-card.
 *
 * Usage:
 *   npx tsx scripts/seed-drill-cards.ts --dry-run   # validate + counts, no writes
 *   npx tsx scripts/seed-drill-cards.ts             # insert
 */
import * as fs from "fs";
import * as path from "path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadEnvLocal, getAdminClient } from "./import-utils";

interface DraftCard {
  drill_id: string;
  drill_name_en?: string;
  situation_label_he?: string;
  subtitle_he?: string;
  age_min_label?: string;
  level_label?: string;
  golden_rule_he?: string;
  failure_steps: { text_he: string; is_final?: boolean }[];
  phases: {
    number: number;
    name_he: string;
    subtitle_he?: string;
    drill_note_he?: string;
    points: { text_he: string }[];
  }[];
  metrics: { label_he: string; before_he?: string; target_he?: string }[];
}

const DRY_RUN = process.argv.includes("--dry-run");
// Supabase returns at most this many rows per select by default; warn if a base
// query reaches it so silent truncation never passes unnoticed as the data grows.
const ROW_CAP = 1000;

function n(v: string | undefined): string | null {
  const t = (v ?? "").trim();
  return t.length > 0 ? t : null;
}

/** Returns a human-readable reason if the card is structurally unusable, else null. */
function validateCard(card: DraftCard): string | null {
  if (!Array.isArray(card.failure_steps) || card.failure_steps.length === 0) return "no failure_steps";
  if (card.failure_steps.some((s) => !n(s.text_he))) return "empty failure-step text";
  if (!Array.isArray(card.phases) || card.phases.length === 0) return "no phases";
  for (const p of card.phases) {
    if (!n(p.name_he)) return "empty phase name";
    if (!Array.isArray(p.points) || p.points.length === 0) return "phase without points";
    if (p.points.some((pt) => !n(pt.text_he))) return "empty point text";
  }
  if (!Array.isArray(card.metrics) || card.metrics.length === 0) return "no metrics";
  if (card.metrics.some((m) => !n(m.label_he))) return "empty metric label";
  return null;
}

/**
 * Insert one card and all its children atomically. On any error, delete the card
 * row (FK cascade removes any children already inserted) and return the reason.
 */
async function insertCard(db: SupabaseClient, card: DraftCard): Promise<string | null> {
  const cardIns = await db
    .from("book_drill_cards")
    .insert({
      drill_id: card.drill_id,
      situation_label_he: n(card.situation_label_he),
      subtitle_he: n(card.subtitle_he),
      age_min_label: n(card.age_min_label),
      level_label: n(card.level_label),
      golden_rule_he: n(card.golden_rule_he),
    })
    .select("id")
    .single();
  if (cardIns.error) return `card: ${cardIns.error.message}`;
  const cardId: string = cardIns.data.id;

  const abort = async (msg: string): Promise<string> => {
    await db.from("book_drill_cards").delete().eq("id", cardId);
    return msg;
  };

  const stepsRes = await db.from("book_drill_card_failure_steps").insert(
    card.failure_steps.map((s, i) => ({
      card_id: cardId,
      text_he: s.text_he,
      is_final: i === card.failure_steps.length - 1,
      order_index: i,
    }))
  );
  if (stepsRes.error) return abort(`failure_steps: ${stepsRes.error.message}`);

  for (let pi = 0; pi < card.phases.length; pi++) {
    const phase = card.phases[pi];
    const phaseIns = await db
      .from("book_drill_card_phases")
      .insert({
        card_id: cardId,
        number: phase.number ?? pi + 1,
        name_he: phase.name_he,
        subtitle_he: n(phase.subtitle_he),
        drill_note_he: n(phase.drill_note_he),
        order_index: pi,
      })
      .select("id")
      .single();
    if (phaseIns.error) return abort(`phase ${pi}: ${phaseIns.error.message}`);
    const phaseId: string = phaseIns.data.id;

    const pointsRes = await db.from("book_drill_card_phase_points").insert(
      phase.points.map((pt, idx) => ({ phase_id: phaseId, text_he: pt.text_he, order_index: idx }))
    );
    if (pointsRes.error) return abort(`points (phase ${pi}): ${pointsRes.error.message}`);
  }

  const metricsRes = await db.from("book_drill_card_metrics").insert(
    card.metrics.map((m, idx) => ({
      card_id: cardId,
      label_he: m.label_he,
      before_he: n(m.before_he),
      target_he: n(m.target_he),
      order_index: idx,
    }))
  );
  if (metricsRes.error) return abort(`metrics: ${metricsRes.error.message}`);

  return null;
}

async function main() {
  loadEnvLocal();
  const db = getAdminClient();

  const file = path.join(process.cwd(), "scripts", "data", "drill-cards-draft.json");
  if (!fs.existsSync(file)) throw new Error(`Missing ${file} — generate the drafts first.`);
  const cards: DraftCard[] = JSON.parse(fs.readFileSync(file, "utf-8"));

  const [drillsRes, cardsRes] = await Promise.all([
    db.from("book_drills").select("id"),
    db.from("book_drill_cards").select("drill_id"),
  ]);
  if (drillsRes.error) throw new Error(drillsRes.error.message);
  if (cardsRes.error) throw new Error(cardsRes.error.message);

  const drillRows = drillsRes.data ?? [];
  const cardRows = cardsRes.data ?? [];
  if (drillRows.length >= ROW_CAP || cardRows.length >= ROW_CAP) {
    console.error(
      `WARNING: a base query returned >= ${ROW_CAP} rows and may be truncated by Supabase; ` +
        `paginate the book_drills / book_drill_cards reads before trusting this run.`
    );
  }

  const validDrillIds = new Set<string>(drillRows.map((d: { id: string }) => d.id));
  const alreadyCarded = new Set<string>(cardRows.map((c: { drill_id: string }) => c.drill_id));

  let inserted = 0;
  let skippedExisting = 0;
  let unmatched = 0;
  let malformed = 0;
  let failed = 0;

  console.log(`=== seed-drill-cards (${DRY_RUN ? "DRY RUN" : "LIVE"}) ===`);
  console.log(`Draft cards in file: ${cards.length}`);

  for (const card of cards) {
    if (!card.drill_id || !validDrillIds.has(card.drill_id)) {
      unmatched++;
      console.error(`  UNMATCHED drill_id (${card.drill_name_en ?? card.drill_id}) — skipping`);
      continue;
    }
    if (alreadyCarded.has(card.drill_id)) {
      skippedExisting++;
      continue;
    }
    const invalid = validateCard(card);
    if (invalid) {
      malformed++;
      console.error(`  MALFORMED ${card.drill_name_en ?? card.drill_id}: ${invalid} — skipping`);
      continue;
    }

    if (DRY_RUN) {
      inserted++;
      console.log(
        `  WOULD INSERT ${card.drill_name_en ?? card.drill_id}: ` +
          `${card.failure_steps.length} steps, ${card.phases.length} phases, ` +
          `${card.phases.reduce((a, p) => a + p.points.length, 0)} points, ${card.metrics.length} metrics`
      );
      continue;
    }

    const err = await insertCard(db, card);
    if (err) {
      failed++;
      console.error(`  FAILED ${card.drill_name_en ?? card.drill_id}: ${err} (card row rolled back)`);
      continue;
    }
    inserted++;
  }

  console.log("");
  console.log(`${DRY_RUN ? "Would insert" : "Inserted"}: ${inserted}`);
  console.log(`Skipped (already had a card): ${skippedExisting}`);
  console.log(`Malformed (skipped): ${malformed}`);
  console.log(`Unmatched drill_id: ${unmatched}`);
  if (!DRY_RUN) console.log(`Failed (rolled back): ${failed}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
