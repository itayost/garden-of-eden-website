import * as path from "path";
import * as XLSX from "xlsx";
import { loadEnvLocal, getAdminClient } from "./import-utils";

const DRY_RUN = process.argv.includes("--dry-run");
const FILE = "features-to-implement/workouts-for-trainers/Elite_Football_Athletic_Database_V2.xlsx";
const SHEET = "מאגר תרגילים מורחב V2";

function s(v: unknown): string | null {
  const t = String(v ?? "").trim();
  return t.length > 0 ? t : null;
}

async function main() {
  loadEnvLocal();
  const wb = XLSX.readFile(path.join(process.cwd(), FILE));
  const ws = wb.Sheets[SHEET];
  const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1 });
  // rows[0] is the header; columns: 0 main, 1 sub, 2 name_he, 3 name_en, 4 equipment, 5 cues, 6 goal
  const exercises = rows.slice(1)
    .filter((r) => s(r[0]))
    .map((r, i) => ({
      main_category: s(r[0]),
      sub_category: s(r[1]),
      name_he: s(r[2]),
      name_en: s(r[3]),
      equipment: s(r[4]),
      cues_he: s(r[5]),
      goal_he: s(r[6]),
      order_index: i,
    }));

  console.log(`Parsed ${exercises.length} exercises (expect 69).`);
  if (DRY_RUN) {
    console.log(JSON.stringify(exercises.slice(0, 2), null, 2));
    console.log("Dry run -- no DB writes.");
    return;
  }
  const db = getAdminClient();
  await db.from("workout_exercises").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  const { error } = await db.from("workout_exercises").insert(exercises);
  if (error) throw new Error(error.message);
  console.log("Seed complete.");
}

main().catch((e) => { console.error(e); process.exit(1); });
