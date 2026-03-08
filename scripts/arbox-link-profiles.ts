import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { fetchAllArboxUsers } from "../src/lib/arbox/client";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function normalizeName(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

async function main() {
  const apply = process.argv.includes("--apply");

  console.log("Fetching Arbox users...");
  const arboxUsers = await fetchAllArboxUsers();
  console.log(`  ${arboxUsers.length} Arbox users fetched.`);

  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id, full_name")
    .is("arbox_user_id", null)
    .is("phone", null)
    .eq("is_active", true);

  if (error) throw new Error(`Supabase error: ${error.message}`);
  console.log(`  ${profiles?.length ?? 0} unlinked profiles found.\n`);

  // Index Arbox users by normalized name — detect duplicates
  const arboxByName = new Map<string, (typeof arboxUsers)[0][]>();
  for (const user of arboxUsers) {
    if (!user.full_name) continue;
    const key = normalizeName(user.full_name);
    const bucket = arboxByName.get(key) ?? [];
    bucket.push(user);
    arboxByName.set(key, bucket);
  }

  type Match = {
    profileId: string;
    profileName: string;
    arboxId: number;
    arboxName: string;
  };

  const matches: Match[] = [];
  const ambiguous: { profileName: string; count: number }[] = [];
  const noMatch: string[] = [];

  for (const profile of profiles ?? []) {
    if (!profile.full_name) {
      noMatch.push("(no name)");
      continue;
    }

    const key = normalizeName(profile.full_name);
    const candidates = arboxByName.get(key) ?? [];

    if (candidates.length === 1) {
      matches.push({
        profileId: profile.id,
        profileName: profile.full_name,
        arboxId: candidates[0].user_id,
        arboxName: candidates[0].full_name,
      });
    } else if (candidates.length > 1) {
      ambiguous.push({ profileName: profile.full_name, count: candidates.length });
    } else {
      noMatch.push(profile.full_name);
    }
  }

  console.log(`=== UNIQUE MATCHES (${matches.length}) ===`);
  for (const m of matches) {
    console.log(`  ${m.profileName}  →  Arbox #${m.arboxId} (${m.arboxName})`);
  }

  if (ambiguous.length > 0) {
    console.log(`\n=== AMBIGUOUS — manual review needed (${ambiguous.length}) ===`);
    for (const a of ambiguous) {
      console.log(`  ${a.profileName}  (${a.count} Arbox candidates)`);
    }
  }

  if (noMatch.length > 0) {
    console.log(`\n=== NO ARBOX MATCH (${noMatch.length}) ===`);
    for (const n of noMatch) console.log(`  ${n}`);
  }

  if (!apply) {
    console.log("\nDry run complete. Re-run with --apply to write matches to DB.");
    return;
  }

  console.log("\nApplying matches...");
  let applied = 0;
  for (const m of matches) {
    const { error: updateError } = await supabase
      .from("profiles")
      .update({ arbox_user_id: m.arboxId })
      .eq("id", m.profileId);

    if (updateError) {
      console.error(`  FAILED: ${m.profileName} — ${updateError.message}`);
    } else {
      applied++;
      console.log(`  OK: ${m.profileName} → Arbox #${m.arboxId}`);
    }
  }

  console.log(`\nDone. ${applied}/${matches.length} profiles linked.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
