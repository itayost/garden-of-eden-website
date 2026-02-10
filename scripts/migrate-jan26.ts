// Migration script: January 2026 CSV assessments
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";

// ── ENV ──────────────────────────────────────────────
const envContent = fs.readFileSync(".env.local", "utf-8");
const env: Record<string, string> = {};
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  let val = trimmed.slice(eqIdx + 1).trim();
  if (
    (val.startsWith('"') && val.endsWith('"')) ||
    (val.startsWith("'") && val.endsWith("'"))
  ) {
    val = val.slice(1, -1);
  }
  val = val.replace(/\\n$/g, "");
  env[key] = val;
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── CSV PARSING ──────────────────────────────────────
function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      fields.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

// ── NUMBER PARSING ───────────────────────────────────
function parseNum(val: string | undefined): number | null {
  if (!val) return null;
  let cleaned = val.trim();
  if (!cleaned || cleaned === "-") return null;
  // Hebrew text like "חסר"
  if (/[\u0590-\u05FF]/.test(cleaned)) return null;
  // Remove parenthetical notes like "(ידיים ורגליים ביחד)"
  cleaned = cleaned.replace(/\(.*?\)/g, "").trim();
  // Replace comma decimal separator
  cleaned = cleaned.replace(",", ".");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

// Parse Kaiser column: values like "3% 62", "5%135", "107 5%", "125", "3%" (null)
function parseKaiser(val: string | undefined): number | null {
  if (!val) return null;
  let cleaned = val.trim();
  if (!cleaned) return null;
  // Remove all "N%" patterns (3%, 5%, 7%, 2%)
  cleaned = cleaned.replace(/\d+\s*%/g, "").trim();
  if (!cleaned) return null;
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

// Normalize jump values: if < 10, it's in meters → convert to cm
function normalizeJump(val: number | null): number | null {
  if (val === null) return null;
  if (val < 10) return Math.round(val * 100);
  return Math.round(val);
}

// ── TYPES ────────────────────────────────────────────
interface ParsedRow {
  name: string;
  sprint_5m: number | null;
  sprint_10m: number | null;
  kaiser: number | null;
  jump_2leg_distance: number | null;
  jump_right_leg: number | null;
  jump_left_leg: number | null;
  blaze_spot_time: number | null;
  warnings: string[];
}

// ── MAIN ─────────────────────────────────────────────
async function main() {
  const csv = fs.readFileSync("מבדקים כדורגלנים - ינואר 26.csv", "utf-8");
  const lines = csv.split("\n");

  // Skip header (line 0)
  const dataLines = lines.slice(1);

  // Parse all rows
  const rows: ParsedRow[] = [];
  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i];
    if (!line.trim()) continue;

    const fields = parseCSVLine(line);
    const name = fields[0]?.trim();
    if (!name) continue; // skip empty name rows (like row 117)

    const warnings: string[] = [];

    const sprint_5m = parseNum(fields[1]);
    const sprint_10m = parseNum(fields[2]);
    const kaiser = parseKaiser(fields[3]);

    let jump_2leg = normalizeJump(parseNum(fields[4]));
    let jump_right = normalizeJump(parseNum(fields[5]));
    let jump_left = normalizeJump(parseNum(fields[6]));

    const blaze = parseNum(fields[7]);

    // Warn on suspicious values
    if (sprint_5m !== null && sprint_10m !== null && sprint_5m > sprint_10m) {
      warnings.push(`sprint_5m(${sprint_5m}) > sprint_10m(${sprint_10m}) — possibly swapped`);
    }

    rows.push({
      name,
      sprint_5m,
      sprint_10m,
      kaiser,
      jump_2leg_distance: jump_2leg,
      jump_right_leg: jump_right,
      jump_left_leg: jump_left,
      blaze_spot_time: blaze,
      warnings,
    });
  }

  console.log(`Parsed ${rows.length} data rows.`);

  // Group by name for deduplication
  const byName = new Map<string, ParsedRow[]>();
  for (const row of rows) {
    if (!byName.has(row.name)) byName.set(row.name, []);
    byName.get(row.name)!.push(row);
  }

  const duplicates = [...byName.entries()].filter(([, v]) => v.length > 1);
  if (duplicates.length > 0) {
    console.log(`\nDuplicate names (will create multiple assessments):`);
    for (const [name, dups] of duplicates) {
      console.log(`  ${name}: ${dups.length} rows`);
    }
  }

  console.log(`\nUnique trainees: ${byName.size}`);
  console.log(`Starting migration...\n`);

  let emailCounter = 1;
  let successCount = 0;
  let failCount = 0;

  for (const [name, userRows] of byName) {
    const email = `trainee-${String(emailCounter).padStart(3, "0")}@edengarden.co.il`;
    emailCounter++;

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name: name },
    });

    if (authError) {
      console.error(`  FAIL [user] ${name}: ${authError.message}`);
      failCount += userRows.length;
      continue;
    }

    const userId = authData.user.id;

    // Update profile (trigger auto-created it)
    await supabase.from("profiles").update({ full_name: name }).eq("id", userId);

    // Create assessment(s)
    for (let i = 0; i < userRows.length; i++) {
      const row = userRows[i];
      // Use Jan 1 for first, Jan 2 for second, etc.
      const day = String(i + 1).padStart(2, "0");
      const assessmentDate = `2026-01-${day}`;

      if (row.warnings.length > 0) {
        console.log(`  WARN ${name}: ${row.warnings.join("; ")}`);
      }

      const { error: insertError } = await supabase.from("player_assessments").insert({
        user_id: userId,
        assessment_date: assessmentDate,
        sprint_5m: row.sprint_5m,
        sprint_10m: row.sprint_10m,
        kick_power_kaiser: row.kaiser,
        jump_2leg_distance: row.jump_2leg_distance,
        jump_right_leg: row.jump_right_leg,
        jump_left_leg: row.jump_left_leg,
        blaze_spot_time: row.blaze_spot_time,
      });

      if (insertError) {
        console.error(`  FAIL [assessment] ${name}: ${insertError.message}`);
        failCount++;
      } else {
        successCount++;
      }
    }
  }

  console.log(`\n=== DONE ===`);
  console.log(`Users created: ${byName.size}`);
  console.log(`Assessments: ${successCount} success, ${failCount} failed`);
}

main().catch(console.error);
