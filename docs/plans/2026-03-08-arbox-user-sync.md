# Arbox User Sync — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Nightly cron job that pulls all Arbox members and upserts them as trainee accounts in Supabase.

**Architecture:** Two-phase approach. Phase 1 (run once): a script that links ~75 existing CSV-imported profiles to Arbox users by name match. Phase 2 (nightly cron): `GET /api/cron/arbox-sync` matches by `arbox_user_id` then phone, creates new accounts for unmatched members.

**Matching cascade (nightly sync):**
1. `arbox_user_id` — already linked (re-run safety)
2. `phone` — WhatsApp OTP users
3. No match + has phone → CREATE new trainee account
4. No match + no phone → SKIP (can't create phone auth without phone)

**Tech Stack:** Next.js App Router, Supabase admin client, Arbox REST API (api-key auth), Vitest, tsx (script runner).

**Design doc:** `docs/plans/2026-03-08-arbox-user-sync-design.md`

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260308120000_add_arbox_user_id.sql`

**Step 1: Write the migration**

```sql
-- Add Arbox user_id to profiles for cross-system linking
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS arbox_user_id INTEGER UNIQUE;
CREATE INDEX IF NOT EXISTS idx_profiles_arbox_user_id ON profiles(arbox_user_id);
```

**Step 2: Apply the migration**

```bash
supabase db push
```

Expected: migration applied with no errors.

**Step 3: Commit**

```bash
git add supabase/migrations/20260308120000_add_arbox_user_id.sql
git commit -m "feat(arbox): add arbox_user_id column to profiles"
```

---

## Task 2: Phone Normalizer (TDD)

**Files:**
- Create: `src/lib/arbox/normalize-phone.ts`
- Create: `src/lib/arbox/__tests__/normalize-phone.test.ts`

Arbox stores Israeli phones in various formats. We need E.164 (`+972521234567`) to match against `profiles.phone` and for `auth.admin.createUser`.

**Step 1: Write the failing tests**

`src/lib/arbox/__tests__/normalize-phone.test.ts`:
```typescript
import { describe, it, expect } from "vitest";
import { normalizePhone } from "../normalize-phone";

describe("normalizePhone", () => {
  it("converts 05x local format to E.164", () => {
    expect(normalizePhone("0521234567")).toBe("+972521234567");
  });

  it("strips dashes from local format", () => {
    expect(normalizePhone("052-123-4567")).toBe("+972521234567");
  });

  it("strips spaces from local format", () => {
    expect(normalizePhone("052 123 4567")).toBe("+972521234567");
  });

  it("keeps already-normalized E.164 unchanged", () => {
    expect(normalizePhone("+972521234567")).toBe("+972521234567");
  });

  it("adds + to 972-prefixed number missing it", () => {
    expect(normalizePhone("972521234567")).toBe("+972521234567");
  });

  it("returns null for null input", () => {
    expect(normalizePhone(null)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(normalizePhone("")).toBeNull();
  });

  it("returns null for non-Israeli number", () => {
    expect(normalizePhone("12025551234")).toBeNull();
  });
});
```

**Step 2: Run to confirm failure**

```bash
npm run test:run -- src/lib/arbox/__tests__/normalize-phone.test.ts
```

Expected: FAIL — module not found.

**Step 3: Implement**

`src/lib/arbox/normalize-phone.ts`:
```typescript
/**
 * Normalize an Israeli phone number to E.164 format (+972XXXXXXXXX).
 * Returns null if the number cannot be normalized.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;

  // Strip all non-digit chars except a leading +
  const cleaned = raw.replace(/(?!^\+)\D/g, "");

  if (cleaned.startsWith("+972")) {
    return cleaned; // Already E.164
  }
  if (cleaned.startsWith("972") && cleaned.length === 12) {
    return `+${cleaned}`;
  }
  if (cleaned.startsWith("0") && cleaned.length === 10) {
    return `+972${cleaned.slice(1)}`;
  }

  return null;
}
```

**Step 4: Run to confirm passing**

```bash
npm run test:run -- src/lib/arbox/__tests__/normalize-phone.test.ts
```

Expected: all 8 tests PASS.

**Step 5: Commit**

```bash
git add src/lib/arbox/normalize-phone.ts src/lib/arbox/__tests__/normalize-phone.test.ts
git commit -m "feat(arbox): add Israeli phone normalizer"
```

---

## Task 3: Arbox API Client

**Files:**
- Create: `src/lib/arbox/client.ts`

Thin typed HTTP wrapper — no business logic, no tests needed.

**Step 1: Write the client**

`src/lib/arbox/client.ts`:
```typescript
const BASE_URL = "https://arboxserver.arboxapp.com/api/public/v3";

export type ArboxUser = {
  user_id: number;
  first_name: string;
  last_name: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  gender: string | null;
  birthday: string | null;
  created_at: string;
  address: string | null;
  city: string | null;
  personal_id: number | null;
  active_membership: string | null;
  last_entrance: string | null;
  location_name: string | null;
};

type ArboxUsersResponse = {
  statusCode: number;
  data: ArboxUser[];
};

async function fetchArboxUsersPage(page: number): Promise<ArboxUser[]> {
  const apiKey = process.env.ARBOX_API_KEY;
  if (!apiKey) throw new Error("ARBOX_API_KEY env var is not set");

  const url = `${BASE_URL}/users?page=${page}&limit=500&sort=asc`;
  const response = await fetch(url, {
    headers: { "api-key": apiKey, Accept: "application/json" },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(
      `Arbox API error: ${response.status} ${response.statusText}`
    );
  }

  const json: ArboxUsersResponse = await response.json();
  return json.data ?? [];
}

/**
 * Fetch all Arbox users, paginating 500/page until exhausted.
 */
export async function fetchAllArboxUsers(): Promise<ArboxUser[]> {
  const all: ArboxUser[] = [];
  let page = 1;

  while (true) {
    const users = await fetchArboxUsersPage(page);
    all.push(...users);
    if (users.length < 500) break;
    page++;
  }

  return all;
}
```

**Step 2: Commit**

```bash
git add src/lib/arbox/client.ts
git commit -m "feat(arbox): add typed Arbox API client with pagination"
```

---

## Task 4: One-Time Profile Linking Script

**Files:**
- Create: `scripts/arbox-link-profiles.ts`

Run this **once** before enabling the nightly sync. It matches existing CSV-imported profiles (no phone, no arbox_user_id) to Arbox users by exact `full_name`. Prints a review table in dry-run mode; writes to DB with `--apply`.

**Step 1: Write the script**

`scripts/arbox-link-profiles.ts`:
```typescript
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

  // Index Arbox users by normalized name → allow detecting duplicates
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
```

**Step 2: Dry-run to review matches**

```bash
npx tsx --env-file=.env.local scripts/arbox-link-profiles.ts
```

Review the output. If any names in AMBIGUOUS need resolution, manually set `arbox_user_id` in Supabase dashboard for those profiles.

**Step 3: Apply matches**

```bash
npx tsx --env-file=.env.local scripts/arbox-link-profiles.ts --apply
```

Expected: `Done. N/N profiles linked.`

**Step 4: Commit**

```bash
git add scripts/arbox-link-profiles.ts
git commit -m "feat(arbox): add one-time profile linking script"
```

---

## Task 5: Sync Logic

**Files:**
- Create: `src/lib/arbox/sync.ts`

Core business logic — separated from the HTTP route. Matching cascade: `arbox_user_id` → `phone` → create → skip (no phone).

**Step 1: Write the sync function**

`src/lib/arbox/sync.ts`:
```typescript
import { createAdminClient } from "@/lib/supabase/admin";
import { fetchAllArboxUsers, type ArboxUser } from "./client";
import { normalizePhone } from "./normalize-phone";

export type SyncResult = {
  created: number;
  updated: number;
  skipped: number;
  errors: number;
};

async function processArboxUser(
  supabase: ReturnType<typeof createAdminClient>,
  arboxUser: ArboxUser
): Promise<"created" | "updated" | "skipped" | "error"> {
  const phone = normalizePhone(arboxUser.phone);

  // Step 1: Try match by arbox_user_id (handles re-runs cleanly)
  // Step 2: Try match by phone (WhatsApp OTP users)
  const query = supabase
    .from("profiles")
    .select("id, full_name, birthdate, arbox_user_id");

  const orClause = phone
    ? `arbox_user_id.eq.${arboxUser.user_id},phone.eq.${phone}`
    : `arbox_user_id.eq.${arboxUser.user_id}`;

  const { data: existing, error: lookupError } = await query
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
    if (!existing.birthdate && arboxUser.birthday) updates.birthdate = arboxUser.birthday;

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

  // No match found
  if (!phone) {
    // Can't create a phone-auth user without a phone
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
      `[Arbox Sync] Failed to create auth user for phone ${phone} (arbox_id=${arboxUser.user_id}):`,
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
      birthdate: arboxUser.birthday ?? null,
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
```

**Step 2: Commit**

```bash
git add src/lib/arbox/sync.ts
git commit -m "feat(arbox): add Arbox user sync logic"
```

---

## Task 6: Cron Route

**Files:**
- Create: `src/app/api/cron/arbox-sync/route.ts`

Follows the existing `src/app/api/cron/auto-clockout/route.ts` pattern exactly.

**Step 1: Write the route**

`src/app/api/cron/arbox-sync/route.ts`:
```typescript
import { NextRequest, NextResponse } from "next/server";
import { syncArboxUsers } from "@/lib/arbox/sync";

/**
 * Vercel Cron Job: Sync Arbox members to Supabase trainee accounts.
 *
 * Runs nightly at 2am UTC. Fetches all Arbox users, creates new auth accounts
 * for unmatched members (with phones), and fills null profile fields for existing ones.
 */
export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    console.error("[Arbox Sync] CRON_SECRET env var is not set");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.ARBOX_API_KEY) {
    console.error("[Arbox Sync] ARBOX_API_KEY env var is not set");
    return NextResponse.json({ error: "ARBOX_API_KEY not configured" }, { status: 500 });
  }

  try {
    const result = await syncArboxUsers();
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[Arbox Sync] Fatal error:", error);
    return NextResponse.json(
      { error: "Sync failed", details: String(error) },
      { status: 500 }
    );
  }
}
```

**Step 2: Commit**

```bash
git add src/app/api/cron/arbox-sync/route.ts
git commit -m "feat(arbox): add /api/cron/arbox-sync route"
```

---

## Task 7: Vercel Cron Schedule + Env Vars

**Files:**
- Modify: `vercel.json`
- Modify: `src/lib/env.ts`
- Modify: `.env.local.example`

**Step 1: Update `vercel.json`**

```json
{
  "crons": [
    {
      "path": "/api/cron/auto-clockout",
      "schedule": "*/10 * * * *"
    },
    {
      "path": "/api/cron/arbox-sync",
      "schedule": "0 2 * * *"
    }
  ]
}
```

**Step 2: Add `ARBOX_API_KEY` to `src/lib/env.ts`** optional vars array

```typescript
"ARBOX_API_KEY",
```

**Step 3: Add to `.env.local.example`**

```
# Arbox API (gym management system — user sync)
ARBOX_API_KEY=
```

**Step 4: Add to Vercel**

```bash
vercel env add ARBOX_API_KEY
```

Select Production + Preview environments. Paste the API key when prompted.

**Step 5: Commit**

```bash
git add vercel.json src/lib/env.ts .env.local.example
git commit -m "chore(arbox): schedule nightly sync and register ARBOX_API_KEY"
```

---

## Task 8: Type Check

**Step 1: Run tsc**

```bash
npx tsc --noEmit
```

If TypeScript errors appear on `arbox_user_id` (column not in generated types), check if a generated types file exists:

```bash
ls src/types/
```

If yes, regenerate:
```bash
npx supabase gen types typescript --linked > src/types/supabase.ts
git add src/types/supabase.ts
git commit -m "chore(arbox): regenerate Supabase types"
```

If no generated types file exists, the error won't occur.

---

## Task 9: End-to-End Smoke Test

**Step 1: Pull env vars**

```bash
vercel env pull .env.local --environment=production
```

**Step 2: Run the linking script first (dry run)**

```bash
npx tsx --env-file=.env.local scripts/arbox-link-profiles.ts
```

Review the output carefully before applying.

**Step 3: Start dev server and trigger sync**

```bash
npm run dev
```

In a separate terminal:
```bash
curl -s http://localhost:3000/api/cron/arbox-sync \
  -H "Authorization: Bearer $(grep CRON_SECRET .env.local | cut -d'=' -f2 | tr -d '"')" \
  | jq .
```

Expected:
```json
{ "success": true, "created": N, "updated": N, "skipped": N, "errors": 0 }
```

**Step 4: Verify in Supabase**

Check that newly created profiles have `arbox_user_id` set and `role = 'trainee'`.

**Step 5: Final commit if any fixes**

```bash
git add -A
git commit -m "fix(arbox): address smoke test findings"
```
