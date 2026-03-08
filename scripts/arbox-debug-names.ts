/**
 * Debug script: print first 20 Arbox full_names to compare with our DB names.
 * Run: npx tsx --env-file=.env.local scripts/arbox-debug-names.ts
 */
import { fetchAllArboxUsers } from "../src/lib/arbox/client";

async function main() {
  const users = await fetchAllArboxUsers();
  console.log(`Total Arbox users: ${users.length}\n`);
  console.log("Sample Arbox names (first 30):");
  for (const u of users.slice(0, 30)) {
    console.log(`  user_id=${u.user_id} | first="${u.first_name}" | last="${u.last_name}" | full="${u.full_name}" | phone=${u.phone}`);
  }
}

main().catch(console.error);
