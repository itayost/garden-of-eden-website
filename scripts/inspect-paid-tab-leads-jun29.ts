/**
 * READ-ONLY: inspect leads in the "ממומן" (paid) tab created on 2026-06-29
 * (Israel time, IDT = UTC+3). Lists what WOULD be affected by a cleanup.
 * Touches nothing.
 *
 * Usage: npx tsx scripts/inspect-paid-tab-leads-jun29.ts
 */

import { loadEnvLocal, getAdminClient } from "./import-utils";

const DAY_START = "2026-06-29T00:00:00+03:00";
const DAY_END = "2026-06-30T00:00:00+03:00";

async function main(): Promise<void> {
  loadEnvLocal();
  const supabase = getAdminClient();

  // Show all tabs so we know exactly which one is "ממומן" and what else exists.
  const { data: tabs, error: tabsErr } = await supabase
    .from("lead_tabs")
    .select("id, slug, name, is_default, position")
    .is("deleted_at", null)
    .order("position", { ascending: true });

  if (tabsErr) {
    console.error("lead_tabs select error:", tabsErr.message);
    process.exit(1);
  }

  console.log("=== All lead tabs ===");
  for (const t of tabs ?? []) {
    console.log(
      `  ${t.name}  (slug=${t.slug}, default=${t.is_default}, id=${t.id})`,
    );
  }

  const paid = (tabs ?? []).find(
    (t) => t.slug === "paid" || /ממומ/.test(t.name as string),
  );
  if (!paid) {
    console.error('\nCould not find a "ממומן" / paid tab.');
    process.exit(1);
  }
  console.log(`\nTarget tab: ${paid.name} (id=${paid.id})`);

  const { data: leads, error: leadsErr } = await supabase
    .from("leads")
    .select("id, name, phone, status, source, created_at")
    .eq("tab_id", paid.id)
    .gte("created_at", DAY_START)
    .lt("created_at", DAY_END)
    .order("created_at", { ascending: true });

  if (leadsErr) {
    console.error("leads select error:", leadsErr.message);
    process.exit(1);
  }

  console.log(
    `\n=== Leads in "${paid.name}" created on 2026-06-29 (Israel time) ===`,
  );
  console.log(`Count: ${leads?.length ?? 0}\n`);
  for (const l of leads ?? []) {
    const created = new Date(l.created_at as string).toLocaleString("he-IL", {
      timeZone: "Asia/Jerusalem",
    });
    console.log(
      `  ${l.name}  |  ${l.phone ?? "—"}  |  status=${l.status}  |  source=${l.source}  |  ${created}  |  id=${l.id}`,
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
