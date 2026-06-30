/**
 * Bulk-insert AI-drafted premium drill cards into the player-development book.
 * Reads scripts/data/drill-cards-draft.json (array of card objects keyed by drill_id).
 * Additive + idempotent: skips any drill that already has a card (drill_id is UNIQUE),
 * so the existing 1v1 card and re-runs never duplicate.
 *
 * Usage:
 *   npx tsx scripts/seed-drill-cards.ts --dry-run   # validate + counts, no writes
 *   npx tsx scripts/seed-drill-cards.ts             # insert
 */
import * as fs from "fs";
import * as path from "path";
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

function n(v: string | undefined): string | null {
  const t = (v ?? "").trim();
  return t.length > 0 ? t : null;
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

  const validDrillIds = new Set<string>((drillsRes.data ?? []).map((d: { id: string }) => d.id));
  const alreadyCarded = new Set<string>((cardsRes.data ?? []).map((c: { drill_id: string }) => c.drill_id));

  let inserted = 0;
  let skippedExisting = 0;
  let unmatched = 0;

  console.log(`=== seed-drill-cards (${DRY_RUN ? "DRY RUN" : "LIVE"}) ===`);
  console.log(`Draft cards in file: ${cards.length}`);

  for (const card of cards) {
    if (!card.drill_id || !validDrillIds.has(card.drill_id)) {
      unmatched++;
      console.log(`  UNMATCHED drill_id (${card.drill_name_en ?? card.drill_id}) — skipping`);
      continue;
    }
    if (alreadyCarded.has(card.drill_id)) {
      skippedExisting++;
      continue;
    }

    // Normalize failure steps: exactly the last step is final.
    const steps = card.failure_steps.map((s, i) => ({
      text_he: s.text_he,
      is_final: i === card.failure_steps.length - 1,
      order_index: i,
    }));

    if (DRY_RUN) {
      inserted++;
      console.log(
        `  WOULD INSERT ${card.drill_name_en ?? card.drill_id}: ` +
          `${steps.length} steps, ${card.phases.length} phases, ` +
          `${card.phases.reduce((a, p) => a + p.points.length, 0)} points, ${card.metrics.length} metrics`
      );
      continue;
    }

    // 1. card row
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
    if (cardIns.error) {
      console.log(`  ERROR card ${card.drill_name_en}: ${cardIns.error.message}`);
      continue;
    }
    const cardId: string = cardIns.data.id;

    // 2. failure steps
    if (steps.length > 0) {
      const fs1 = await db.from("book_drill_card_failure_steps").insert(
        steps.map((s) => ({ card_id: cardId, text_he: s.text_he, is_final: s.is_final, order_index: s.order_index }))
      );
      if (fs1.error) console.log(`  WARN failure_steps ${card.drill_name_en}: ${fs1.error.message}`);
    }

    // 3. phases + points
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
      if (phaseIns.error) {
        console.log(`  WARN phase ${card.drill_name_en}: ${phaseIns.error.message}`);
        continue;
      }
      const phaseId: string = phaseIns.data.id;
      if (phase.points.length > 0) {
        const pIns = await db.from("book_drill_card_phase_points").insert(
          phase.points.map((pt, idx) => ({ phase_id: phaseId, text_he: pt.text_he, order_index: idx }))
        );
        if (pIns.error) console.log(`  WARN points ${card.drill_name_en}: ${pIns.error.message}`);
      }
    }

    // 4. metrics
    if (card.metrics.length > 0) {
      const mIns = await db.from("book_drill_card_metrics").insert(
        card.metrics.map((m, idx) => ({
          card_id: cardId,
          label_he: m.label_he,
          before_he: n(m.before_he),
          target_he: n(m.target_he),
          order_index: idx,
        }))
      );
      if (mIns.error) console.log(`  WARN metrics ${card.drill_name_en}: ${mIns.error.message}`);
    }

    inserted++;
  }

  console.log("");
  console.log(`${DRY_RUN ? "Would insert" : "Inserted"}: ${inserted}`);
  console.log(`Skipped (already had a card): ${skippedExisting}`);
  console.log(`Unmatched drill_id: ${unmatched}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
