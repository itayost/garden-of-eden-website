/**
 * Move the leads in "ממומנים" (paid) created on 2026-06-29 (Israel time) to the
 * "שימור לקוחות חודש יוני" tab — fixing the mis-placed paste.
 *
 * Safety:
 * 1. Backs up the full affected rows (incl. original tab_id) to scripts/backups/
 *    BEFORE any write, so the move is fully recoverable.
 * 2. Moves only the exact rows that were backed up (by id).
 * 3. Verifies counts afterwards.
 *
 * Reversible: restoring is just setting tab_id back to the paid tab for those ids.
 *
 * Usage: npx tsx scripts/move-paid-jun29-to-retention.ts
 */

import * as fs from "fs";
import * as path from "path";
import { loadEnvLocal, getAdminClient } from "./import-utils";

const DAY_START = "2026-06-29T00:00:00+03:00";
const DAY_END = "2026-06-30T00:00:00+03:00";

async function main(): Promise<void> {
  loadEnvLocal();
  const supabase = getAdminClient();

  const { data: tabs, error: tabsErr } = await supabase
    .from("lead_tabs")
    .select("id, slug, name")
    .is("deleted_at", null);
  if (tabsErr) throw new Error(`lead_tabs select: ${tabsErr.message}`);

  const paid = (tabs ?? []).find((t) => t.slug === "paid");
  // Tab names carry no year, so require exactly one match - a June tab from
  // another year or a duplicate would otherwise be picked arbitrarily and all
  // leads bulk-moved to the wrong tab.
  const retentionMatches = (tabs ?? []).filter(
    (t) => /שימור/.test(t.name as string) && /יוני/.test(t.name as string),
  );
  if (!paid) throw new Error('paid ("ממומנים") tab not found');
  if (retentionMatches.length !== 1) {
    throw new Error(
      `Expected exactly one "שימור...יוני" tab, found ${retentionMatches.length}: ` +
        retentionMatches.map((t) => `${t.name} (${t.id})`).join(", "),
    );
  }
  const retention = retentionMatches[0];

  console.log(`Source: ${paid.name} (${paid.id})`);
  console.log(`Target: ${retention.name} (${retention.id})\n`);

  // 1. Fetch full rows for backup.
  const { data: rows, error: fetchErr } = await supabase
    .from("leads")
    .select("*")
    .eq("tab_id", paid.id)
    .gte("created_at", DAY_START)
    .lt("created_at", DAY_END)
    .order("created_at", { ascending: true });
  if (fetchErr) throw new Error(`leads fetch: ${fetchErr.message}`);

  const affected = rows ?? [];
  console.log(`Affected leads: ${affected.length}`);
  if (affected.length === 0) {
    console.log("Nothing to move. Exiting.");
    return;
  }

  // 2. Back up before writing.
  const backupsDir = path.join(process.cwd(), "scripts", "backups");
  fs.mkdirSync(backupsDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = path.join(
    backupsDir,
    `move-paid-jun29-to-retention-${stamp}.json`,
  );
  fs.writeFileSync(
    backupPath,
    JSON.stringify(
      {
        movedAt: new Date().toISOString(),
        from_tab: { id: paid.id, name: paid.name },
        to_tab: { id: retention.id, name: retention.name },
        rows: affected,
      },
      null,
      2,
    ),
  );
  console.log(`Backup written: ${backupPath}`);

  // 3. Move by exact ids.
  const ids = affected.map((r) => r.id as string);
  const { data: moved, error: updErr } = await supabase
    .from("leads")
    .update({ tab_id: retention.id })
    .in("id", ids)
    .select("id");
  if (updErr) throw new Error(`update: ${updErr.message}`);
  console.log(`Moved: ${moved?.length ?? 0} leads`);

  // 4. Verify. A verification that swallows its own errors (or a nonzero
  // remainder) must not read as success after a production write.
  const { count: paidJun29, error: verifyPaidErr } = await supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("tab_id", paid.id)
    .gte("created_at", DAY_START)
    .lt("created_at", DAY_END);
  if (verifyPaidErr) throw new Error(`verify (paid) failed: ${verifyPaidErr.message}`);

  const { count: retentionTotal, error: verifyRetErr } = await supabase
    .from("leads")
    .select("id", { count: "exact", head: true })
    .eq("tab_id", retention.id);
  if (verifyRetErr) throw new Error(`verify (retention) failed: ${verifyRetErr.message}`);

  console.log(`\nVerify -> ${paid.name} created 29.6: ${paidJun29 ?? 0} (expect 0)`);
  console.log(`Verify -> ${retention.name} total: ${retentionTotal ?? 0}`);

  if ((paidJun29 ?? 0) !== 0 || (moved?.length ?? 0) !== affected.length) {
    console.error(
      `VERIFY FAILED: moved ${moved?.length ?? 0}/${affected.length}, ` +
        `${paidJun29 ?? 0} leads still in ${paid.name}. Backup: ${backupPath}`,
    );
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
