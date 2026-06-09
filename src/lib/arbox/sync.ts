import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllArboxUsers, fetchArboxBirthdays, type ArboxUser } from "./client";
import { normalizePhone } from "./normalize-phone";

export type SyncResult = {
  created: number;
  updated: number;
  skipped: number;
  errors: number;
};

export type BirthdaySyncResult = {
  updated: number;
  skipped: number;
  errors: number;
};

async function processArboxUser(
  supabase: ReturnType<typeof createAdminClient>,
  arboxUser: ArboxUser
): Promise<"created" | "updated" | "skipped" | "error"> {
  const phone = normalizePhone(arboxUser.phone);

  // Match by arbox_user_id (re-run safety) or phone (WhatsApp OTP users)
  const orClause = phone
    ? `arbox_user_id.eq.${arboxUser.user_id},phone.eq.${phone}`
    : `arbox_user_id.eq.${arboxUser.user_id}`;

  const { data: existing, error: lookupError } = await supabase
    .from("profiles")
    .select("id, full_name, arbox_user_id")
    .or(orClause)
    .maybeSingle();

  if (lookupError) {
    console.error(
      `[Arbox Sync] Lookup error for arbox user ${arboxUser.user_id}:`,
      lookupError
    );
    return "error";
  }

  if (existing) {
    // Fill null fields only — our DB wins on populated data
    const updates: Record<string, unknown> = {};
    if (!existing.arbox_user_id) updates.arbox_user_id = arboxUser.user_id;
    if (!existing.full_name && arboxUser.full_name) updates.full_name = arboxUser.full_name;

    if (Object.keys(updates).length === 0) return "skipped";

    const { error: updateError } = await supabase
      .from("profiles")
      .update(updates)
      .eq("id", existing.id);

    if (updateError) {
      console.error(`[Arbox Sync] Update error for profile ${existing.id}:`, updateError);
      return "error";
    }
    return "updated";
  }

  // No match found — need a phone to create a phone-auth account
  if (!phone) {
    console.warn(
      `[Arbox Sync] Skipping arbox user ${arboxUser.user_id} (${arboxUser.full_name}) — no phone`
    );
    return "skipped";
  }

  // Create new auth user — on_auth_user_created trigger auto-creates the profile row
  const { data: authData, error: createError } = await supabase.auth.admin.createUser({
    phone,
    phone_confirm: true,
    user_metadata: { full_name: arboxUser.full_name },
  });

  if (createError || !authData.user) {
    console.error(
      `[Arbox Sync] Failed to create auth user for arbox_id=${arboxUser.user_id}:`,
      createError
    );
    return "error";
  }

  // Enrich the auto-created profile with Arbox data
  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      arbox_user_id: arboxUser.user_id,
      full_name: arboxUser.full_name ?? null,
    })
    .eq("id", authData.user.id);

  if (profileError) {
    console.error(
      `[Arbox Sync] Failed to update new profile ${authData.user.id}:`,
      profileError
    );
    return "error";
  }

  return "created";
}

export async function syncArboxUsers(): Promise<SyncResult> {
  const result: SyncResult = { created: 0, updated: 0, skipped: 0, errors: 0 };
  const supabase = createAdminClient();

  console.log("[Arbox Sync] Fetching all Arbox users...");
  const users = await fetchAllArboxUsers();
  console.log(`[Arbox Sync] Processing ${users.length} Arbox users...`);

  for (const user of users) {
    const outcome = await processArboxUser(supabase, user);
    if (outcome === "error") result.errors++;
    else result[outcome]++;
  }

  console.log("[Arbox Sync] Complete:", result);
  return result;
}

/**
 * Sync birthdays from Arbox into profiles.birthdate.
 * Only fills null birthdates — manually entered ones are preserved.
 */
export async function syncArboxBirthdays(): Promise<BirthdaySyncResult> {
  const result: BirthdaySyncResult = { updated: 0, skipped: 0, errors: 0 };
  const supabase = createAdminClient();

  console.log("[Arbox Birthday Sync] Fetching birthdays from Arbox...");
  const birthdays = await fetchArboxBirthdays();
  console.log(`[Arbox Birthday Sync] Found ${birthdays.size} birthdays`);

  if (birthdays.size === 0) return result;

  // Fetch profiles linked to Arbox that are missing a birthdate
  const { data: profiles, error: fetchError } = await supabase
    .from("profiles")
    .select("id, arbox_user_id")
    .not("arbox_user_id", "is", null)
    .is("birthdate", null);

  if (fetchError) {
    console.error("[Arbox Birthday Sync] Failed to fetch profiles:", fetchError);
    return { ...result, errors: 1 };
  }

  if (!profiles || profiles.length === 0) {
    console.log("[Arbox Birthday Sync] No profiles need birthday updates");
    return result;
  }

  console.log(`[Arbox Birthday Sync] ${profiles.length} profiles missing birthdate`);

  for (const profile of profiles) {
    const birthday = birthdays.get(profile.arbox_user_id as number);

    if (!birthday) {
      result.skipped++;
      continue;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({ birthdate: birthday })
      .eq("id", profile.id);

    if (updateError) {
      console.error(
        `[Arbox Birthday Sync] Failed to update profile ${profile.id}:`,
        updateError
      );
      result.errors++;
    } else {
      result.updated++;
    }
  }

  console.log("[Arbox Birthday Sync] Complete:", result);
  return result;
}
