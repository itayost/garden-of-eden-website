/**
 * Fix phone numbers: sync profiles.phone into auth.users for users
 * who were created via email-only migration and later got a phone in profiles.
 *
 * Usage: npx tsx scripts/fix-phone-format.ts [--dry-run]
 */
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import { normalizePhone } from "../src/lib/arbox/normalize-phone";

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

const dryRun = process.argv.includes("--dry-run");

const PAGE_SIZE = 1000;

// ── MAIN ──────────────────────────────────────────────
async function main() {
  console.log(`\n=== Fix Phone Numbers ${dryRun ? "(DRY RUN)" : ""} ===\n`);

  // 1. List ALL auth users - a single page silently truncates at PAGE_SIZE,
  // and a truncated map misclassifies page-2 users as phone-less, overwriting
  // working OTP phones below.
  const allAuthUsers: { id: string; phone?: string | null }[] = [];
  for (let page = 1; ; page++) {
    const { data: listData, error: listError } = await supabase.auth.admin.listUsers({
      page,
      perPage: PAGE_SIZE,
    });
    if (listError) {
      console.error("Failed to list users:", listError.message);
      process.exit(1);
    }
    allAuthUsers.push(...listData.users);
    if (listData.users.length < PAGE_SIZE) break;
  }
  const authPhoneMap = new Map<string, string | undefined>();
  for (const u of allAuthUsers) {
    authPhoneMap.set(u.id, u.phone || undefined);
  }

  console.log(`Total auth users: ${allAuthUsers.length}`);
  console.log(`  With phone: ${allAuthUsers.filter((u) => u.phone).length}`);
  console.log(`  Without phone: ${allAuthUsers.filter((u) => !u.phone).length}`);

  // 2. Get all profiles with phone (paginate past the PostgREST 1000-row cap)
  const profiles: { id: string; phone: string | null; full_name: string | null }[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data: pageRows, error: profilesError } = await supabase
      .from("profiles")
      .select("id, phone, full_name")
      .not("phone", "is", null)
      .order("id")
      .range(from, from + PAGE_SIZE - 1);

    if (profilesError) {
      console.error("Failed to query profiles:", profilesError.message);
      process.exit(1);
    }
    profiles.push(...(pageRows ?? []));
    if ((pageRows ?? []).length < PAGE_SIZE) break;
  }

  console.log(`Profiles with phone: ${profiles.length}`);

  // 3. Find users where profile has phone but auth.users doesn't
  const missingAuthPhone = profiles.filter((p) => {
    const authPhone = authPhoneMap.get(p.id);
    return p.phone && !authPhone;
  });

  console.log(`\nUsers with profile phone but NO auth phone: ${missingAuthPhone.length}`);

  let successCount = 0;
  let failCount = 0;
  let skippedUnparseable = 0;

  if (missingAuthPhone.length > 0) {
    console.log("\n--- Fixing missing auth phones ---");
    for (const p of missingAuthPhone) {
      // normalizePhone validates digits and length and returns null for
      // anything unrecognizable - never write a made-up E.164 value as a
      // confirmed OTP phone.
      const normalizedPhone = normalizePhone(p.phone);
      if (!normalizedPhone) {
        console.log(`  ${p.full_name} | profile: "${p.phone}" | SKIP: not a valid Israeli phone`);
        skippedUnparseable++;
        continue;
      }
      console.log(`  ${p.full_name} | profile: "${p.phone}" | adding to auth: "${normalizedPhone}"`);

      if (!dryRun) {
        const { error: updateError } = await supabase.auth.admin.updateUserById(p.id, {
          phone: normalizedPhone,
          phone_confirm: true,
        });
        if (updateError) {
          console.error(`    FAIL: ${updateError.message}`);
          failCount++;
        } else {
          console.log(`    OK`);
          successCount++;
        }
      }
    }
  }

  // Summary
  console.log("\n=== Summary ===");
  console.log(`Users needing auth phone: ${missingAuthPhone.length}`);
  console.log(`Skipped (unparseable phone): ${skippedUnparseable}`);
  if (!dryRun) {
    console.log(`  Success: ${successCount}`);
    console.log(`  Failed: ${failCount}`);
  }
  if (dryRun) {
    console.log("\n(Dry run - no changes made. Run without --dry-run to apply.)");
  } else {
    console.log("\nDone!");
  }
}

main().catch((err) => {
  console.error("Script failed:", err);
  process.exit(1);
});
