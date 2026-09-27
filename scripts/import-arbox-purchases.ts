/**
 * Import Arbox purchases into trainee plans, or preview it.
 *
 * The same code the nightly cron runs (src/features/plans/lib/arbox-import.ts);
 * this is the manual entry point and the dry-run report.
 *
 * Usage:
 *   npx tsx scripts/import-arbox-purchases.ts --dry-run
 *   npx tsx scripts/import-arbox-purchases.ts
 *
 * CRITICAL: writes to the PRODUCTION Supabase database. --dry-run is safe.
 */
import { runArboxPurchaseImport } from "../src/features/plans/lib/arbox-import.ts";
import { loadEnvLocal } from "./import-utils.ts";

const DRY_RUN = process.argv.includes("--dry-run");

async function main(): Promise<void> {
  loadEnvLocal();
  const { result, actions, skips, unmatchedCards, traineeNames } = await runArboxPurchaseImport({ dryRun: DRY_RUN });
  const name = (id: string | null) => (id ? traineeNames.get(id) ?? id : "-");

  console.log(`${result.purchases} Arbox purchases, ${result.unmatchedCards} cards without a unique sale\n`);
  console.log(`${actions.length} to apply:`);
  for (const a of actions) {
    const p = a.purchase;
    const what = a.type === "create"
      ? `${a.chained ? "chain" : "new"} ${a.plan.startsOn} -> ${a.plan.endsOn}, sessions ${a.plan.sessionsTotal ?? "-"}`
      : `merge into ${a.target.planId}: ends ${a.target.expectEndsOn} -> ${a.set.endsOn}, sessions ${a.target.expectSessionsTotal ?? "-"} -> ${a.set.sessionsTotal ?? "-"}${a.shifts.length ? `, moves ${a.shifts.length} queued` : ""}`;
    console.log(`  ${name(a.profileId)} | ${p.itemName} ${p.purchaseDate} (${p.membershipUserId}) | ${what} | ${a.order.amountIls} ILS`);
  }

  const shown = skips.filter((s) => s.reason !== "not_linked" && s.reason !== "already_imported");
  console.log(`\nskipped: ${JSON.stringify(result.skipped)}`);
  for (const s of shown) {
    console.log(`  ${s.reason} | ${name(s.profileId)} | ${s.purchase.itemName} ${s.purchase.purchaseDate} (${s.purchase.membershipUserId})`);
  }
  for (const c of unmatchedCards) {
    console.log(`  no unique sale | arbox user ${c.userId} | ${c.itemName} ${c.startDate} | ${c.matches} matches`);
  }

  if (!DRY_RUN) {
    console.log(`\napplied: created ${result.created}, merged ${result.merged}, already imported ${result.alreadyImported}, failed ${result.failed}, leftovers repaired ${result.healed}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
