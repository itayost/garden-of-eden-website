/**
 * Export drills that have NO premium card, with the context needed to draft one.
 * Read-only. Writes scripts/data/cardless-drills.json.
 *
 * Usage: npx tsx scripts/export-cardless-drills.ts
 */
import * as fs from "fs";
import * as path from "path";
import { loadEnvLocal, getAdminClient } from "./import-utils";

interface CardlessDrill {
  drill_id: string;
  name_en: string | null;
  name_he: string | null;
  muscle_he: string | null;
  sets_he: string | null;
  how_he: string | null;
  why_he: string | null;
  connect_he: string | null;
  parameter_he: string | null;
  category_he: string | null;
}

async function main() {
  loadEnvLocal();
  const db = getAdminClient();

  const [drillsRes, cardsRes, paramsRes, catsRes] = await Promise.all([
    db
      .from("book_drills")
      .select("id, parameter_id, name_en, name_he, muscle_he, sets_he, how_he, why_he, connect_he")
      .order("order_index"),
    db.from("book_drill_cards").select("drill_id"),
    db.from("book_parameters").select("id, name_he, category_id"),
    db.from("book_categories").select("id, name_he"),
  ]);

  for (const r of [drillsRes, cardsRes, paramsRes, catsRes]) {
    if (r.error) throw new Error(r.error.message);
  }

  const hasCard = new Set<string>((cardsRes.data ?? []).map((c: { drill_id: string }) => c.drill_id));
  const catById = new Map<string, string | null>(
    (catsRes.data ?? []).map((c: { id: string; name_he: string | null }) => [c.id, c.name_he])
  );
  const paramById = new Map<string, { name_he: string | null; category_id: string }>(
    (paramsRes.data ?? []).map((p: { id: string; name_he: string | null; category_id: string }) => [
      p.id,
      { name_he: p.name_he, category_id: p.category_id },
    ])
  );

  const cardless: CardlessDrill[] = (drillsRes.data ?? [])
    .filter((d: { id: string }) => !hasCard.has(d.id))
    .map((d) => {
      const param = paramById.get(d.parameter_id);
      return {
        drill_id: d.id,
        name_en: d.name_en,
        name_he: d.name_he,
        muscle_he: d.muscle_he,
        sets_he: d.sets_he,
        how_he: d.how_he,
        why_he: d.why_he,
        connect_he: d.connect_he,
        parameter_he: param?.name_he ?? null,
        category_he: param ? catById.get(param.category_id) ?? null : null,
      };
    });

  const outDir = path.join(process.cwd(), "scripts", "data");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "cardless-drills.json");
  fs.writeFileSync(outPath, JSON.stringify(cardless, null, 2), "utf-8");

  const total = (drillsRes.data ?? []).length;
  console.log(`Total drills: ${total}`);
  console.log(`With card:    ${hasCard.size}`);
  console.log(`Cardless:     ${cardless.length} -> ${outPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
