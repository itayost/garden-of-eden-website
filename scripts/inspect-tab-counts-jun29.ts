/**
 * READ-ONLY: per-tab lead counts + how many were created on 2026-06-29 (Israel
 * time). Helps decide whether the 125 mis-placed leads in "ממומנים" should be
 * moved (if the intended tab is empty) or deleted (if a correct re-paste already
 * exists there). Touches nothing.
 */

import { loadEnvLocal, getAdminClient } from "./import-utils";

const DAY_START = "2026-06-29T00:00:00+03:00";
const DAY_END = "2026-06-30T00:00:00+03:00";

async function main(): Promise<void> {
  loadEnvLocal();
  const supabase = getAdminClient();

  const { data: tabs } = await supabase
    .from("lead_tabs")
    .select("id, slug, name")
    .is("deleted_at", null)
    .order("position", { ascending: true });

  console.log("tab | total leads | created 29.6");
  for (const t of tabs ?? []) {
    const { count: total } = await supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("tab_id", t.id);

    const { count: jun29 } = await supabase
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("tab_id", t.id)
      .gte("created_at", DAY_START)
      .lt("created_at", DAY_END);

    console.log(`${t.name} (${t.slug}) | ${total ?? 0} | ${jun29 ?? 0}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
