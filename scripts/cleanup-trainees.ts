// Cleanup script: Remove all trainee accounts (auth users, profiles, assessments)
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";

// Parse .env.local
const envContent = fs.readFileSync(".env.local", "utf-8");
const env: Record<string, string> = {};
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  let val = trimmed.slice(eqIdx + 1).trim();
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1);
  }
  val = val.replace(/\\n$/g, "");
  env[key] = val;
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  // 1. Get all trainee profiles
  const { data: trainees, error: fetchErr } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("role", "trainee")
    .is("deleted_at", null);

  if (fetchErr) {
    console.error("Failed to fetch trainees:", fetchErr);
    return;
  }

  console.log(`Found ${trainees?.length || 0} trainees to remove.\n`);
  if (!trainees || trainees.length === 0) return;

  // 2. Delete all assessments for these trainees
  const traineeIds = trainees.map((t) => t.id);
  const { error: assessmentErr, count: assessmentCount } = await supabase
    .from("player_assessments")
    .delete({ count: "exact" })
    .in("user_id", traineeIds);

  if (assessmentErr) {
    console.error("Failed to delete assessments:", assessmentErr);
    return;
  }
  console.log(`Deleted ${assessmentCount} assessments.`);

  // 3. Delete profiles (hard delete)
  const { error: profileErr, count: profileCount } = await supabase
    .from("profiles")
    .delete({ count: "exact" })
    .in("id", traineeIds);

  if (profileErr) {
    console.error("Failed to delete profiles:", profileErr);
    return;
  }
  console.log(`Deleted ${profileCount} profiles.`);

  // 4. Delete auth users
  let authDeleted = 0;
  let authFailed = 0;
  for (const trainee of trainees) {
    const { error } = await supabase.auth.admin.deleteUser(trainee.id);
    if (error) {
      console.error(`  Failed to delete auth user ${trainee.full_name} (${trainee.id}): ${error.message}`);
      authFailed++;
    } else {
      authDeleted++;
    }
  }
  console.log(`Deleted ${authDeleted} auth users. (${authFailed} failed)`);

  console.log("\nCleanup complete!");
}

main().catch(console.error);
