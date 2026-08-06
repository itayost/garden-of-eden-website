/**
 * Cleanup script: backfill names and normalize phones for nameless trainee
 * profiles that were created with bare international ("972XXXXXXXXX") phones.
 *
 * Problem: the admin "ניהול משתמשים" page is polluted with ~400 trainee
 * profiles that have NULL/empty full_name (rendered as "לא צוין") and a phone
 * stored as "972XXXXXXXXX" instead of local "05XXXXXXXX". These are real
 * `profiles` rows (likely from a bulk Arbox sync), NOT leads.
 *
 * This script (keep-and-clean, never delete):
 *   A. Selects the target rows and writes a backup JSON before any mutation.
 *   B. Backfills full_name by matching each 972-phone to an Arbox member.
 *   C. Normalizes profiles.phone "972XXXXXXXXX" -> "05XXXXXXXX", detecting
 *      collisions with existing real accounts (reported, never merged/deleted).
 *
 * Touches profiles.phone ONLY. auth.users.phone (E.164, used for WhatsApp OTP)
 * is never modified.
 *
 * Usage:
 *   npx tsx scripts/cleanup-nameless-972-trainees.ts            # dry-run (default)
 *   npx tsx scripts/cleanup-nameless-972-trainees.ts --apply    # write changes
 */

import * as fs from "fs";
import * as path from "path";
import { loadEnvLocal, getAdminClient } from "./import-utils";
import { fetchAllArboxUsers, type ArboxUser } from "../src/lib/arbox/client";
import { normalizePhone } from "../src/lib/arbox/normalize-phone";
import { isLeadPhone } from "../src/types/leads";

const APPLY = process.argv.includes("--apply");
const BATCH_SIZE = 50;
const PAGE_SIZE = 1000;

interface TargetRow {
  id: string;
  full_name: string | null;
  phone: string | null;
  arbox_user_id: number | null;
  created_at: string;
  deleted_at: string | null;
}

/** Convert any recognizable Israeli phone to local "05XXXXXXXX", or null. */
function toLocalIsraeliPhone(phone: string | null | undefined): string | null {
  const e164 = normalizePhone(phone); // "+9725XXXXXXXX" or null
  if (!e164) return null;
  return "0" + e164.slice(4); // drop "+972", prepend "0"
}

async function main(): Promise<void> {
  loadEnvLocal();
  const supabase = getAdminClient();

  console.log(
    `\n=== cleanup-nameless-972-trainees (${APPLY ? "APPLY" : "DRY-RUN"}) ===\n`
  );

  // ---------------------------------------------------------------------------
  // STEP A — Select targets + backup (paginate past the PostgREST 1000-row cap)
  // ---------------------------------------------------------------------------
  const nameless: TargetRow[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data: rawRows, error: selectErr } = await supabase
      .from("profiles")
      .select("id, full_name, phone, arbox_user_id, created_at, deleted_at")
      .eq("role", "trainee")
      .is("deleted_at", null)
      .or("full_name.is.null,full_name.eq.")
      .order("id")
      .range(from, from + PAGE_SIZE - 1);

    if (selectErr) {
      console.error("Failed to select target profiles:", selectErr);
      process.exit(1);
    }
    nameless.push(...((rawRows ?? []) as TargetRow[]));
    if ((rawRows ?? []).length < PAGE_SIZE) break;
  }

  // Keep only rows whose phone is a recognizable 972-format number.
  const targets = nameless.filter((r) => r.phone && isLeadPhone(r.phone));
  const namelessNon972 = nameless.filter((r) => !r.phone || !isLeadPhone(r.phone));

  console.log(`Nameless active trainees found:        ${nameless.length}`);
  console.log(`  -> with 972-format phone (targets):  ${targets.length}`);
  console.log(`  -> without 972 phone (left as-is):   ${namelessNon972.length}\n`);

  // Backup BEFORE any mutation (even in dry-run) — rollback source.
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.join(process.cwd(), "scripts", "backups");
  fs.mkdirSync(backupDir, { recursive: true });
  const backupPath = path.join(backupDir, `cleanup-nameless-972-${stamp}.json`);
  fs.writeFileSync(
    backupPath,
    JSON.stringify(
      targets.map((r) => ({
        id: r.id,
        full_name: r.full_name,
        phone: r.phone,
        created_at: r.created_at,
      })),
      null,
      2
    )
  );
  console.log(`Backup written: ${backupPath}\n`);

  if (targets.length === 0) {
    console.log("Nothing to do. Exiting.");
    return;
  }

  const targetIds = new Set(targets.map((t) => t.id));

  // ---------------------------------------------------------------------------
  // STEP B — Build Arbox phone -> member index
  // ---------------------------------------------------------------------------
  console.log("Fetching Arbox members...");
  let arboxUsers: ArboxUser[] = [];
  try {
    arboxUsers = await fetchAllArboxUsers();
  } catch (err) {
    console.error("Failed to fetch Arbox users:", err);
    process.exit(1);
  }
  console.log(`Fetched ${arboxUsers.length} Arbox members.\n`);

  const arboxByPhone = new Map<string, ArboxUser>();
  for (const u of arboxUsers) {
    const key = normalizePhone(u.phone);
    if (key && u.full_name && u.full_name.trim()) arboxByPhone.set(key, u);
  }

  // ---------------------------------------------------------------------------
  // STEP C — Build existing active-phone owner index (for collision detection)
  // Paginated: an owner past the 1000-row cap that the index misses would let
  // two active accounts silently end up sharing one real phone number.
  // ---------------------------------------------------------------------------
  const activePhones: { id: string; phone: string; full_name: string | null }[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data: pageRows, error: activeErr } = await supabase
      .from("profiles")
      .select("id, phone, full_name")
      .is("deleted_at", null)
      .not("phone", "is", null)
      .order("id")
      .range(from, from + PAGE_SIZE - 1);

    if (activeErr) {
      console.error("Failed to load active phones:", activeErr);
      process.exit(1);
    }
    activePhones.push(
      ...((pageRows ?? []) as { id: string; phone: string; full_name: string | null }[]),
    );
    if ((pageRows ?? []).length < PAGE_SIZE) break;
  }

  const phoneOwners = new Map<string, { id: string; full_name: string | null }>();
  for (const p of activePhones) {
    if (targetIds.has(p.id)) continue; // skip the batch itself
    const key = normalizePhone(p.phone);
    if (key) phoneOwners.set(key, { id: p.id, full_name: p.full_name });
  }

  // Detect intra-batch duplicates: 972 numbers normalizing to the same key.
  const keyCount = new Map<string, number>();
  for (const t of targets) {
    const key = normalizePhone(t.phone);
    if (key) keyCount.set(key, (keyCount.get(key) ?? 0) + 1);
  }

  // ---------------------------------------------------------------------------
  // Stage updates
  // ---------------------------------------------------------------------------
  interface Staged {
    row: TargetRow;
    updates: { full_name?: string; phone?: string; arbox_user_id?: number };
  }

  const staged: Staged[] = [];
  const stillNameless: TargetRow[] = [];
  const badPhone: TargetRow[] = [];
  const collisions: {
    row: TargetRow;
    existing?: { id: string; full_name: string | null };
    reason: string;
  }[] = [];

  let nameFromArbox = 0;
  let phoneToNormalize = 0;

  for (const row of targets) {
    const updates: { full_name?: string; phone?: string; arbox_user_id?: number } = {};
    const key = normalizePhone(row.phone);

    // --- Collision checks (skip both writes when colliding) ---
    if (key && keyCount.get(key)! > 1) {
      collisions.push({ row, reason: "intra-batch duplicate" });
      continue;
    }
    if (key && phoneOwners.has(key)) {
      collisions.push({
        row,
        existing: phoneOwners.get(key),
        reason: "duplicate of existing active account",
      });
      continue;
    }

    // --- Name backfill ---
    const member = key ? arboxByPhone.get(key) : undefined;
    if (member && member.full_name && member.full_name.trim()) {
      updates.full_name = member.full_name.trim();
      nameFromArbox++;
      // Link the Arbox id too: the phone below is rewritten to local "05..."
      // format, which the nightly arbox-sync dedup or-clause cannot match, so
      // without arbox_user_id the sync would try to re-create these users
      // every night and fail on the duplicate auth phone.
      if (row.arbox_user_id == null) {
        updates.arbox_user_id = member.user_id;
      }
    } else {
      stillNameless.push(row);
    }

    // --- Phone normalization ---
    const desiredLocal = toLocalIsraeliPhone(row.phone);
    if (!desiredLocal) {
      badPhone.push(row);
    } else if (desiredLocal !== row.phone) {
      updates.phone = desiredLocal;
      phoneToNormalize++;
    }

    if (updates.full_name !== undefined || updates.phone !== undefined) {
      staged.push({ row, updates });
    }
  }

  // ---------------------------------------------------------------------------
  // Summary
  // ---------------------------------------------------------------------------
  console.log("--- Summary ---");
  console.log(`Targets:                       ${targets.length}`);
  console.log(`Names recoverable from Arbox:  ${nameFromArbox}`);
  console.log(`Still nameless after Arbox:    ${stillNameless.length}`);
  console.log(`Phone normalizations:          ${phoneToNormalize}`);
  console.log(`Collisions (skipped):          ${collisions.length}`);
  console.log(`Unparseable phones (skipped):  ${badPhone.length}`);
  console.log(`Rows with at least one write:  ${staged.length}\n`);

  if (collisions.length > 0) {
    console.log("--- Collisions (manual review; NOT modified) ---");
    for (const c of collisions) {
      const ex = c.existing
        ? ` -> existing ${c.existing.id} (${c.existing.full_name ?? "?"})`
        : "";
      console.log(`  ${c.row.id} / ${c.row.phone} [${c.reason}]${ex}`);
    }
    console.log("");
  }

  if (stillNameless.length > 0) {
    console.log(`--- Still nameless (${stillNameless.length}) — no Arbox match ---`);
    for (const r of stillNameless.slice(0, 30)) {
      console.log(`  ${r.id} / ${r.phone}`);
    }
    if (stillNameless.length > 30)
      console.log(`  ... +${stillNameless.length - 30} more`);
    console.log("");
  }

  // ---------------------------------------------------------------------------
  // Apply
  // ---------------------------------------------------------------------------
  if (!APPLY) {
    console.log("Dry run complete. Re-run with --apply to write.");
    console.log(`Backup: ${backupPath}`);
    return;
  }

  console.log(`Applying ${staged.length} updates...\n`);
  let nameUpdated = 0;
  let phoneUpdated = 0;
  let failed = 0;
  const failures: { id: string; code?: string; message: string }[] = [];

  for (let i = 0; i < staged.length; i += BATCH_SIZE) {
    const batch = staged.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async ({ row, updates }) => {
        const { error } = await supabase
          .from("profiles")
          .update(updates)
          .eq("id", row.id);
        if (error) {
          failed++;
          failures.push({ id: row.id, code: error.code, message: error.message });
        } else {
          if (updates.full_name !== undefined) nameUpdated++;
          if (updates.phone !== undefined) phoneUpdated++;
        }
      })
    );
    console.log(
      `  processed ${Math.min(i + BATCH_SIZE, staged.length)}/${staged.length}`
    );
  }

  console.log("\n--- Apply report ---");
  console.log(`Names set:           ${nameUpdated}`);
  console.log(`Phones normalized:   ${phoneUpdated}`);
  console.log(`Failed rows:         ${failed}`);
  console.log(`Collisions skipped:  ${collisions.length}`);
  console.log(`Bad phones skipped:  ${badPhone.length}`);
  console.log(`Backup:              ${backupPath}`);

  if (failures.length > 0) {
    console.log("\n--- Failures ---");
    for (const f of failures) {
      console.log(`  ${f.id} [${f.code ?? "?"}] ${f.message}`);
    }
  }

  console.log(
    "\nFollow-up (not done here): profiles.phone format is inconsistent across the whole table " +
      "(+972 / 972 / 05). Consider a separate audit to canonicalize all profiles."
  );
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
