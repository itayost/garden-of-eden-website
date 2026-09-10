# Branches Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the `branches` entity (חיפה, קריית אתא), let Eden assign each user to one or both branches, and surface the branch in the admin users list, forms, export, and Arbox sync.

**Architecture:** A `branches` lookup table plus a `profile_branches` many-to-many join, both admin-editable through a small CMS page copied from the muscles CMS. Membership reads for other users go through the service-role client inside gated server actions, matching the existing pick-list pattern. Pure helpers (scope resolution, Arbox matching, filter matching) live in `src/lib/branches/` and `src/lib/admin/` and are unit-tested.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Supabase (Postgres + RLS), Zod 4, TanStack Table, nuqs, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-10-branches-design.md` (Sections 1, 2, 6, 7). Plan 2 (`2026-09-10-branches-scoping-and-schedule.md`) covers Sections 3, 4, 5.

## Global Constraints

- All user-facing text in Hebrew; `dir="rtl"` already set on `<html>`; use logical CSS (`ms-`, `me-`, `start`, `end`).
- No emojis in code, comments, or docs. No em dashes in user-facing copy.
- Immutability: never mutate objects or arrays; return new copies.
- Admin actions call `verifyAdmin()`; staff actions call `verifyAdminOrTrainer()`; both from `@/lib/actions/shared`.
- Validate every id with `isValidUUID()` or a Zod uuid regex from `@/lib/validations/common`.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the client. `createAdminClient()` only inside server actions gated by a verify call.
- Tables missing from generated types are read through `typedFrom(supabase, "table")`.
- No mock-based tests. Unit tests cover pure functions only.
- Files 200-400 lines typical, 800 max. Split when a file grows past that.
- Migration file names use the Supabase timestamp format with a unique version: `20260910120000_branches.sql`.
- Do not edit `.env*` files.
- Commit format: `feat(branches): ...`, `test(branches): ...`, `docs(branches): ...`.
- Run after every task: `npx tsc --noEmit` and `npm run lint`. Both must be clean before committing.

---

## File Structure

**Created:**

| File | Responsibility |
|---|---|
| `supabase/migrations/20260910120000_branches.sql` | Tables, columns, backfill, RLS, column guard |
| `docs/adr/0006-branches-are-a-table.md` | Decision record |
| `src/types/branches.ts` | `Branch`, `BranchOption`, `ProfileWithBranches` types |
| `src/lib/branches/branch-scope.ts` | `resolveBranchScope`, `isInBranchScope` (pure) |
| `src/lib/branches/arbox-branch-match.ts` | `matchArboxBranch` (pure) |
| `src/lib/branches/branch-change.ts` | `branchFieldChange` for the activity log (pure) |
| `src/lib/admin/branch-filter.ts` | Users table filter sentinels and matcher (pure) |
| `src/lib/branches/__tests__/*.test.ts`, `src/lib/admin/__tests__/branch-filter.test.ts` | Unit tests |
| `src/lib/validations/branch.ts` | Zod schema for branch create/update |
| `src/features/branches/lib/memberships.ts` | Service-role membership helpers (server-only, not `"use server"`) |
| `src/features/branches/lib/actions/admin-branches.ts` | Branch CRUD server actions |
| `src/features/branches/lib/actions/list-branches.ts` | Read-only branch lists for pickers |
| `src/features/branches/components/admin/BranchesClient.tsx` | CMS client island |
| `src/features/branches/components/BranchCheckboxGroup.tsx` | Checkbox group used by both user forms |
| `src/app/admin/branches/page.tsx` | Admin page |
| `src/lib/actions/admin-users-branches.ts` | `bulkAssignBranchAction` |
| `src/components/admin/users/BulkBranchAssignBar.tsx` | Selection bar above the users table |

**Modified:**

| File | Change |
|---|---|
| `src/types/database.ts` | `profiles.branches_set_by_admin_at`, `trainer_shifts.branch_id` |
| `src/lib/navigation/admin-nav.ts` | Add `/admin/branches` |
| `src/lib/validations/user-create.ts`, `user-edit.ts` | `branch_ids` field |
| `src/types/activity-log.ts` | `branches` field label |
| `src/lib/actions/admin-users-create.ts`, `admin-users-update.ts` | Persist branches, stamp admin edit, log change |
| `src/lib/actions/admin-users.ts` | Re-export bulk action |
| `src/components/admin/users/UserCreateForm.tsx`, `src/components/admin/UserEditForm.tsx` | Branch checkbox group |
| `src/app/admin/users/create/page.tsx`, `src/app/admin/users/[userId]/page.tsx` | Load branches, pass to forms |
| `src/app/admin/users/page.tsx` | Load memberships, branch filter param |
| `src/components/admin/users/UserDataTable.tsx`, `UserTableColumns.tsx`, `UserTableToolbar.tsx`, `UserExportButton.tsx` | Branch column, filter, export, selection |
| `src/lib/arbox/sync.ts` | Dormant Arbox branch fill |

---

### Task 1: Migration, types, and ADR

**Files:**
- Create: `supabase/migrations/20260910120000_branches.sql`
- Create: `docs/adr/0006-branches-are-a-table.md`
- Create: `src/types/branches.ts`
- Modify: `src/types/database.ts:23-96` (profiles Row/Insert/Update), `src/types/database.ts:1144-1187` (trainer_shifts Row/Insert/Update)

**Interfaces:**
- Produces: tables `branches`, `profile_branches`; columns `profiles.branches_set_by_admin_at`, `branch_id` on `weekly_schedule_bands`, `weekly_schedule_exceptions`, `daily_schedule_slots`, `trainer_shifts`; TS types `Branch`, `BranchOption`, `ProfileWithBranches`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260910120000_branches.sql`:

```sql
-- ===========================================
-- Branches: the academy now runs in two physical places.
--
-- branches is an admin-editable lookup table. profile_branches is the
-- many-to-many link: a trainer or trainee belongs to one branch or both.
-- Schedule bands, exceptions, slots and shifts each point at one branch.
--
-- This supersedes the inline note in 20260815120000_weekly_schedule.sql that
-- chose free text over a locations table. location_he stays: it names the
-- room or field ("סטודיו", "מגרש"), not the branch.
-- See docs/adr/0006-branches-are-a-table.md.
-- ===========================================

CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_he TEXT NOT NULL UNIQUE
    CHECK (char_length(name_he) BETWEEN 1 AND 60),
  -- Dormant Arbox hook. Null until Eden splits Arbox into two locations.
  arbox_location_name TEXT UNIQUE
    CHECK (arbox_location_name IS NULL OR char_length(arbox_location_name) BETWEEN 1 AND 120),
  is_active BOOLEAN NOT NULL DEFAULT true,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION set_branches_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER branches_set_updated_at
  BEFORE UPDATE ON branches
  FOR EACH ROW EXECUTE FUNCTION set_branches_updated_at();

INSERT INTO branches (name_he, order_index) VALUES
  ('חיפה', 0),
  ('קריית אתא', 1);

CREATE TABLE profile_branches (
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (profile_id, branch_id)
);
CREATE INDEX idx_profile_branches_branch ON profile_branches(branch_id);

-- Stamped whenever an admin or trainer sets a user's branches by hand.
-- The Arbox sync fills branches only while this is null.
ALTER TABLE profiles ADD COLUMN branches_set_by_admin_at TIMESTAMPTZ;

-- Nullable on purpose: legacy rows are backfilled below, and an offline
-- clock-in replayed later must never fail on a missing branch.
ALTER TABLE weekly_schedule_bands ADD COLUMN branch_id UUID REFERENCES branches(id);
ALTER TABLE weekly_schedule_exceptions ADD COLUMN branch_id UUID REFERENCES branches(id);
ALTER TABLE daily_schedule_slots ADD COLUMN branch_id UUID REFERENCES branches(id);
ALTER TABLE trainer_shifts ADD COLUMN branch_id UUID REFERENCES branches(id);

CREATE INDEX idx_weekly_bands_branch ON weekly_schedule_bands(branch_id);
CREATE INDEX idx_weekly_exceptions_branch ON weekly_schedule_exceptions(branch_id);
CREATE INDEX idx_schedule_slots_branch ON daily_schedule_slots(branch_id);
CREATE INDEX idx_trainer_shifts_branch ON trainer_shifts(branch_id);

-- ===========================================
-- Backfill: everything that exists today happened in חיפה.
-- Counts are raised as a NOTICE so the prior state is visible in the log.
-- ===========================================
DO $$
DECLARE
  v_haifa UUID;
  v_profiles INTEGER;
  v_bands INTEGER;
  v_exceptions INTEGER;
  v_slots INTEGER;
  v_shifts INTEGER;
BEGIN
  SELECT id INTO v_haifa FROM branches WHERE name_he = 'חיפה';

  INSERT INTO profile_branches (profile_id, branch_id)
  SELECT id, v_haifa FROM profiles
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_profiles = ROW_COUNT;

  UPDATE weekly_schedule_bands SET branch_id = v_haifa WHERE branch_id IS NULL;
  GET DIAGNOSTICS v_bands = ROW_COUNT;

  UPDATE weekly_schedule_exceptions SET branch_id = v_haifa WHERE branch_id IS NULL;
  GET DIAGNOSTICS v_exceptions = ROW_COUNT;

  UPDATE daily_schedule_slots SET branch_id = v_haifa WHERE branch_id IS NULL;
  GET DIAGNOSTICS v_slots = ROW_COUNT;

  UPDATE trainer_shifts SET branch_id = v_haifa WHERE branch_id IS NULL;
  GET DIAGNOSTICS v_shifts = ROW_COUNT;

  RAISE NOTICE 'branches backfill to חיפה: profiles=% bands=% exceptions=% slots=% shifts=%',
    v_profiles, v_bands, v_exceptions, v_slots, v_shifts;
END $$;

-- ===========================================
-- RLS
-- ===========================================
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "branches_select_authenticated" ON branches
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "branches_write_admin" ON branches
  FOR ALL TO authenticated
  USING (get_user_role((SELECT auth.uid())) = 'admin')
  WITH CHECK (get_user_role((SELECT auth.uid())) = 'admin');

ALTER TABLE profile_branches ENABLE ROW LEVEL SECURITY;

-- A user reads their own memberships; admins read all. Trainers read other
-- users' memberships through the service role inside gated server actions,
-- the same way schedule-options.ts reads the trainee list.
CREATE POLICY "profile_branches_select_own_or_admin" ON profile_branches
  FOR SELECT TO authenticated
  USING (
    profile_id = (SELECT auth.uid())
    OR get_user_role((SELECT auth.uid())) = 'admin'
  );

CREATE POLICY "profile_branches_write_admin" ON profile_branches
  FOR ALL TO authenticated
  USING (get_user_role((SELECT auth.uid())) = 'admin')
  WITH CHECK (get_user_role((SELECT auth.uid())) = 'admin');

-- ===========================================
-- Column guard: the owner of a profile must not move the admin stamp.
-- Full function body repeated because CREATE OR REPLACE replaces it whole.
-- ===========================================
CREATE OR REPLACE FUNCTION enforce_profile_column_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF get_user_role(auth.uid()) = 'admin' THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'role cannot be changed by its owner';
  END IF;
  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    RAISE EXCEPTION 'is_active cannot be changed by its owner';
  END IF;
  IF NEW.nutrition_appointment_status IS DISTINCT FROM OLD.nutrition_appointment_status THEN
    RAISE EXCEPTION 'nutrition_appointment_status cannot be changed by its owner';
  END IF;
  IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
    RAISE EXCEPTION 'deleted_at cannot be changed by its owner';
  END IF;
  IF NEW.arbox_user_id IS DISTINCT FROM OLD.arbox_user_id THEN
    RAISE EXCEPTION 'arbox_user_id cannot be changed by its owner';
  END IF;
  IF NEW.arbox_paid_training IS DISTINCT FROM OLD.arbox_paid_training THEN
    RAISE EXCEPTION 'arbox_paid_training cannot be changed by its owner';
  END IF;
  IF NEW.arbox_bought_course IS DISTINCT FROM OLD.arbox_bought_course THEN
    RAISE EXCEPTION 'arbox_bought_course cannot be changed by its owner';
  END IF;
  IF NEW.access_override IS DISTINCT FROM OLD.access_override THEN
    RAISE EXCEPTION 'access_override cannot be changed by its owner';
  END IF;
  IF NEW.branches_set_by_admin_at IS DISTINCT FROM OLD.branches_set_by_admin_at THEN
    RAISE EXCEPTION 'branches_set_by_admin_at cannot be changed by its owner';
  END IF;

  RETURN NEW;
END;
$$;
```

- [ ] **Step 2: Write the ADR**

Create `docs/adr/0006-branches-are-a-table.md`:

```markdown
# Branches are a table, not free text

The academy operates in two places, חיפה and קריית אתא. A branch is a real entity: `branches` is an admin-editable lookup table and `profile_branches` links each user to one branch or both. Schedule bands, exceptions, slots and shifts carry a `branch_id`.

This reverses the inline decision in `20260815120000_weekly_schedule.sql`, which kept `location_he` as free text rather than introduce a locations table. That was right when there was one academy and "location" meant the room. It stops being right once a trainer in קריית אתא must not see the חיפה roster, because a filter cannot be built on text someone typed.

`location_he` stays and keeps its old meaning: the room or field within a branch.

## Considered options

**An enum column on profiles.** Rejected. A user can belong to both branches, so a single column cannot express membership, and this codebase has no enums on profiles by convention.

**A `branch_ids uuid[]` array on profiles.** Rejected. No foreign key integrity, awkward filters, and no precedent. The `book_drill_muscles` join is the pattern the codebase already has.

**Enforcing trainer scope in RLS.** Rejected for now. The profiles policies already recursed once (42P17), and the staff pick-lists deliberately read through the service role, so RLS alone would not restrict those reads. Scope is applied in server queries through one helper, `resolveBranchScope`.

## Consequences

**Membership reads for other users need the service role.** `profile_branches` lets a user read only their own rows. Every trainer-facing list that needs another user's branches reads through `createAdminClient()` inside an action gated by `verifyAdminOrTrainer()`.

**Arbox can fill branches, but does not today.** All Arbox clients currently share one location name. `branches.arbox_location_name` is the hook; it is null until Eden splits Arbox, and the sync only fills a profile whose `branches_set_by_admin_at` is null.

**Deactivating a branch hides it, never deletes.** Memberships and history keep pointing at it.
```

- [ ] **Step 3: Add TS types**

Create `src/types/branches.ts`:

```ts
import type { Profile } from "@/types/database";

/** One physical academy location. Mirrors the branches table. */
export interface Branch {
  id: string;
  name_he: string;
  arbox_location_name: string | null;
  is_active: boolean;
  order_index: number;
  created_at: string;
  updated_at: string;
}

/** The subset pickers and badges need. */
export interface BranchOption {
  id: string;
  nameHe: string;
}

/** A profile row with its memberships resolved, for admin tables and exports. */
export type ProfileWithBranches = Profile & {
  branchIds: string[];
  branchNames: string[];
};

export const NO_BRANCH_LABEL_HE = "ללא סניף";

export function toBranchOption(branch: Branch): BranchOption {
  return { id: branch.id, nameHe: branch.name_he };
}
```

In `src/types/database.ts`, add to the `profiles` `Row` block (after `arbox_access_synced_at: string | null;`):

```ts
          branches_set_by_admin_at: string | null;
```

and to both `Insert` and `Update` blocks of `profiles`:

```ts
          branches_set_by_admin_at?: string | null;
```

In the `trainer_shifts` `Row` block add after `other_purpose_category: string | null;`:

```ts
          branch_id: string | null;
```

and to `trainer_shifts` `Insert` and `Update` blocks:

```ts
          branch_id?: string | null;
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Apply the migration to the linked project and verify the backfill**

Run: `supabase db push`
Expected: the migration applies and the log shows `branches backfill to חיפה: profiles=N bands=... shifts=...`.

Then run this verification script from the repo root (it reads the production env the same way the existing scripts do):

```bash
node -e '
const fs=require("fs");
const env=Object.fromEntries(fs.readFileSync(".env.local","utf8").split("\n").filter(l=>l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i),l.slice(i+1).replace(/^"|"$/g,"").replace(/\\n$/,"")]}));
const url=env.NEXT_PUBLIC_SUPABASE_URL, key=env.SUPABASE_SERVICE_ROLE_KEY;
const h={apikey:key,Authorization:"Bearer "+key,Prefer:"count=exact"};
async function count(path){const r=await fetch(url+"/rest/v1/"+path+"&limit=0",{headers:h});return r.headers.get("content-range").split("/")[1];}
(async()=>{
 console.log("profiles", await count("profiles?select=id"));
 console.log("profile_branches", await count("profile_branches?select=profile_id"));
 for (const t of ["weekly_schedule_bands","weekly_schedule_exceptions","daily_schedule_slots","trainer_shifts"]) {
   console.log(t+" null branch", await count(t+"?select=id&branch_id=is.null"));
 }
})();'
```

Expected: `profile_branches` equals `profiles`, and every `null branch` count is `0`.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/20260910120000_branches.sql docs/adr/0006-branches-are-a-table.md src/types/branches.ts src/types/database.ts
git commit -m "feat(branches): branches and profile_branches tables with backfill to חיפה

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Pure helpers with tests

**Files:**
- Create: `src/lib/branches/branch-scope.ts`
- Create: `src/lib/branches/arbox-branch-match.ts`
- Create: `src/lib/branches/branch-change.ts`
- Create: `src/lib/admin/branch-filter.ts`
- Test: `src/lib/branches/__tests__/branch-scope.test.ts`, `src/lib/branches/__tests__/arbox-branch-match.test.ts`, `src/lib/branches/__tests__/branch-change.test.ts`, `src/lib/admin/__tests__/branch-filter.test.ts`

**Interfaces:**
- Produces:
  - `type BranchScope = { kind: "all" } | { kind: "branches"; ids: readonly string[] }`
  - `resolveBranchScope(role: string, memberBranchIds: readonly string[]): BranchScope`
  - `isInBranchScope(scope: BranchScope, memberBranchIds: readonly string[]): boolean`
  - `matchArboxBranch(locationName: string | null, branches: readonly Branch[]): Branch | null`
  - `branchFieldChange(originalNames: readonly string[], updatedNames: readonly string[]): FieldChange | null`
  - `BRANCH_FILTER_ALL`, `BRANCH_FILTER_NONE`, `buildBranchFilterOptions(branches: readonly BranchOption[])`, `matchesBranchFilter(branchIds: readonly string[], filter: string | null | undefined): boolean`

- [ ] **Step 1: Write the failing tests**

`src/lib/branches/__tests__/branch-scope.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { resolveBranchScope, isInBranchScope } from "../branch-scope";

describe("resolveBranchScope", () => {
  it("gives admins everything regardless of memberships", () => {
    expect(resolveBranchScope("admin", ["b1"])).toEqual({ kind: "all" });
    expect(resolveBranchScope("admin", [])).toEqual({ kind: "all" });
  });

  it("scopes a trainer to their branches", () => {
    expect(resolveBranchScope("trainer", ["b1", "b2"])).toEqual({
      kind: "branches",
      ids: ["b1", "b2"],
    });
  });

  it("fails open for a trainer with no branch", () => {
    expect(resolveBranchScope("trainer", [])).toEqual({ kind: "all" });
  });
});

describe("isInBranchScope", () => {
  it("accepts anyone under an all scope", () => {
    expect(isInBranchScope({ kind: "all" }, [])).toBe(true);
    expect(isInBranchScope({ kind: "all" }, ["b9"])).toBe(true);
  });

  it("requires at least one shared branch under a branches scope", () => {
    const scope = { kind: "branches" as const, ids: ["b1", "b2"] };
    expect(isInBranchScope(scope, ["b2", "b3"])).toBe(true);
    expect(isInBranchScope(scope, ["b3"])).toBe(false);
    expect(isInBranchScope(scope, [])).toBe(false);
  });
});
```

`src/lib/branches/__tests__/arbox-branch-match.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { matchArboxBranch } from "../arbox-branch-match";
import type { Branch } from "@/types/branches";

function branch(overrides: Partial<Branch> & { id: string }): Branch {
  return {
    name_he: "x",
    arbox_location_name: null,
    is_active: true,
    order_index: 0,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

const haifa = branch({ id: "h", name_he: "חיפה", arbox_location_name: "גארדן חיפה" });
const kiryat = branch({ id: "k", name_he: "קריית אתא", arbox_location_name: "גארדן קריית אתא" });
const inactive = branch({ id: "i", name_he: "ישן", arbox_location_name: "ישן", is_active: false });

describe("matchArboxBranch", () => {
  it("matches an exact Arbox location name after trimming", () => {
    expect(matchArboxBranch(" גארדן חיפה ", [haifa, kiryat])).toBe(haifa);
  });

  it("returns null when nothing matches", () => {
    expect(matchArboxBranch("גארדן אוף עדן", [haifa, kiryat])).toBeNull();
  });

  it("ignores inactive branches", () => {
    expect(matchArboxBranch("ישן", [inactive, haifa])).toBeNull();
  });

  it("returns null for a null or empty location", () => {
    expect(matchArboxBranch(null, [haifa])).toBeNull();
    expect(matchArboxBranch("", [haifa])).toBeNull();
  });

  it("ignores branches with no Arbox name", () => {
    const bare = branch({ id: "b", name_he: "חיפה" });
    expect(matchArboxBranch("חיפה", [bare])).toBeNull();
  });
});
```

`src/lib/branches/__tests__/branch-change.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { branchFieldChange } from "../branch-change";

describe("branchFieldChange", () => {
  it("returns null when the sets are equal regardless of order", () => {
    expect(branchFieldChange(["חיפה", "קריית אתא"], ["קריית אתא", "חיפה"])).toBeNull();
    expect(branchFieldChange([], [])).toBeNull();
  });

  it("records a change with names joined by a comma", () => {
    expect(branchFieldChange(["חיפה"], ["חיפה", "קריית אתא"])).toEqual({
      field: "branches",
      old_value: "חיפה",
      new_value: "חיפה, קריית אתא",
    });
  });

  it("records an empty side as null", () => {
    expect(branchFieldChange([], ["חיפה"])).toEqual({
      field: "branches",
      old_value: null,
      new_value: "חיפה",
    });
  });
});
```

`src/lib/admin/__tests__/branch-filter.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  BRANCH_FILTER_ALL,
  BRANCH_FILTER_NONE,
  buildBranchFilterOptions,
  matchesBranchFilter,
} from "../branch-filter";

describe("matchesBranchFilter", () => {
  it("passes everything for null or ALL", () => {
    expect(matchesBranchFilter([], null)).toBe(true);
    expect(matchesBranchFilter(["b1"], BRANCH_FILTER_ALL)).toBe(true);
  });

  it("passes only unassigned users for NONE", () => {
    expect(matchesBranchFilter([], BRANCH_FILTER_NONE)).toBe(true);
    expect(matchesBranchFilter(["b1"], BRANCH_FILTER_NONE)).toBe(false);
  });

  it("passes users that belong to the selected branch, including dual-branch users", () => {
    expect(matchesBranchFilter(["b1", "b2"], "b1")).toBe(true);
    expect(matchesBranchFilter(["b1", "b2"], "b2")).toBe(true);
    expect(matchesBranchFilter(["b2"], "b1")).toBe(false);
    expect(matchesBranchFilter([], "b1")).toBe(false);
  });
});

describe("buildBranchFilterOptions", () => {
  it("wraps the branches with ALL first and NONE last", () => {
    expect(
      buildBranchFilterOptions([
        { id: "b1", nameHe: "חיפה" },
        { id: "b2", nameHe: "קריית אתא" },
      ]),
    ).toEqual([
      { value: BRANCH_FILTER_ALL, label: "כל הסניפים" },
      { value: "b1", label: "חיפה" },
      { value: "b2", label: "קריית אתא" },
      { value: BRANCH_FILTER_NONE, label: "ללא סניף" },
    ]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:run -- src/lib/branches src/lib/admin/__tests__/branch-filter.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement the helpers**

`src/lib/branches/branch-scope.ts`:

```ts
/**
 * Who a staff member may see, expressed as a set of branches.
 *
 * The rule lives here and only here. Every trainer-facing list applies it in
 * its server query, so the lists cannot drift from each other.
 */
export type BranchScope =
  | { kind: "all" }
  | { kind: "branches"; ids: readonly string[] };

export const ALL_BRANCHES_SCOPE: BranchScope = { kind: "all" };

/**
 * Admins see everything. A trainer sees their branches. A trainer with no
 * branch assigned yet also sees everything: failing open matches the access
 * tier convention, and an unassigned trainer staring at an empty academy
 * during rollout would be worse than a trainer seeing one extra branch.
 */
export function resolveBranchScope(
  role: string,
  memberBranchIds: readonly string[],
): BranchScope {
  if (role === "admin") return ALL_BRANCHES_SCOPE;
  if (memberBranchIds.length === 0) return ALL_BRANCHES_SCOPE;
  return { kind: "branches", ids: [...memberBranchIds] };
}

/** A user is in scope when they share at least one branch with the scope. */
export function isInBranchScope(
  scope: BranchScope,
  memberBranchIds: readonly string[],
): boolean {
  if (scope.kind === "all") return true;
  return memberBranchIds.some((id) => scope.ids.includes(id));
}
```

`src/lib/branches/arbox-branch-match.ts`:

```ts
import type { Branch } from "@/types/branches";

/**
 * The branch an Arbox location name maps to, or null.
 *
 * Exact match after trimming, active branches only. Today every Arbox client
 * carries the same location name and no branch claims it, so this returns
 * null for everyone; the hook wakes up the day Eden sets a branch's Arbox
 * name to match a second Arbox location.
 */
export function matchArboxBranch(
  locationName: string | null,
  branches: readonly Branch[],
): Branch | null {
  const wanted = locationName?.trim();
  if (!wanted) return null;

  return (
    branches.find(
      (branch) =>
        branch.is_active &&
        branch.arbox_location_name !== null &&
        branch.arbox_location_name.trim() === wanted,
    ) ?? null
  );
}
```

`src/lib/branches/branch-change.ts`:

```ts
import type { FieldChange } from "@/types/activity-log";

function joinNames(names: readonly string[]): string | null {
  return names.length === 0 ? null : [...names].sort().join(", ");
}

/**
 * The activity-log entry for a branch edit, or null when nothing moved.
 * Compares as sets so reordering is not a change.
 */
export function branchFieldChange(
  originalNames: readonly string[],
  updatedNames: readonly string[],
): FieldChange | null {
  const before = joinNames(originalNames);
  const after = joinNames(updatedNames);
  if (before === after) return null;
  return { field: "branches", old_value: before, new_value: after };
}
```

`src/lib/admin/branch-filter.ts`:

```ts
import type { BranchOption } from "@/types/branches";
import { NO_BRANCH_LABEL_HE } from "@/types/branches";

export const BRANCH_FILTER_ALL = "all";
export const BRANCH_FILTER_NONE = "none";

export interface BranchFilterOption {
  value: string;
  label: string;
}

export function buildBranchFilterOptions(
  branches: readonly BranchOption[],
): BranchFilterOption[] {
  return [
    { value: BRANCH_FILTER_ALL, label: "כל הסניפים" },
    ...branches.map((b) => ({ value: b.id, label: b.nameHe })),
    { value: BRANCH_FILTER_NONE, label: NO_BRANCH_LABEL_HE },
  ];
}

export function matchesBranchFilter(
  branchIds: readonly string[],
  filter: string | null | undefined,
): boolean {
  if (!filter || filter === BRANCH_FILTER_ALL) return true;
  if (filter === BRANCH_FILTER_NONE) return branchIds.length === 0;
  return branchIds.includes(filter);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:run -- src/lib/branches src/lib/admin/__tests__/branch-filter.test.ts`
Expected: PASS, 4 files.

- [ ] **Step 5: Commit**

```bash
git add src/lib/branches src/lib/admin/branch-filter.ts src/lib/admin/__tests__/branch-filter.test.ts
git commit -m "feat(branches): scope, Arbox match, filter and change helpers with tests

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Membership helpers, Zod schema, and branch server actions

**Files:**
- Create: `src/lib/validations/branch.ts`
- Create: `src/features/branches/lib/memberships.ts`
- Create: `src/features/branches/lib/actions/list-branches.ts`
- Create: `src/features/branches/lib/actions/admin-branches.ts`

**Interfaces:**
- Consumes: `Branch`, `BranchOption` from Task 1.
- Produces:
  - `branchSchema` and `BranchInput = { name_he: string; arbox_location_name?: string | null; is_active?: boolean }`
  - `loadBranchIdsByProfile(db, profileIds): Promise<Map<string, string[]>>`
  - `listProfileIdsInBranches(db, branchIds): Promise<string[]>`
  - `replaceProfileBranches(db, profileId, branchIds, { stampAdmin }): Promise<{ error: string | null }>`
  - `loadBranchOptions(db): Promise<BranchOption[]>` (active, ordered)
  - `listBranchesAction(): Promise<Branch[]>` (all, ordered; staff)
  - `listActiveBranchOptionsAction(): Promise<BranchOption[]>` (staff)
  - `createBranchAction(input)`, `updateBranchAction(id, input)`, `reorderBranchesAction(ids)` returning `{ success: true } | { error, fieldErrors? }`
  - `listBranchesWithCountsAction(): Promise<(Branch & { memberCount: number })[]>` (admin)

- [ ] **Step 1: Zod schema**

`src/lib/validations/branch.ts`:

```ts
import { z } from "zod";
import { UUID_REGEX } from "@/lib/validations/common";

/** Trims, then treats an empty string as "no value" so the DB stores NULL. */
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `הטקסט ארוך מדי (מקסימום ${max} תווים)`)
    .transform((v) => (v === "" ? null : v))
    .nullish()
    .transform((v) => v ?? null);

export const branchSchema = z.object({
  name_he: z.string().trim().min(1, "נדרש שם סניף").max(60, "שם ארוך מדי"),
  arbox_location_name: optionalText(120),
  is_active: z.boolean().default(true),
});

export type BranchInput = z.input<typeof branchSchema>;

export const branchIdListSchema = z
  .array(z.string().regex(UUID_REGEX, "מזהה סניף לא תקין"))
  .max(20, "יותר מדי סניפים");

export const reorderBranchesSchema = z.object({
  ids: branchIdListSchema.min(1, "אין סניפים לסדר"),
});
```

- [ ] **Step 2: Membership helpers (service-role, server-only)**

`src/features/branches/lib/memberships.ts`:

```ts
import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { typedFrom } from "@/lib/supabase/helpers";
import type { Branch, BranchOption } from "@/types/branches";
import { toBranchOption } from "@/types/branches";

/**
 * Membership reads and writes that need the service role.
 *
 * profile_branches lets a user read only their own rows, so any staff surface
 * that needs another user's branches comes through here with an admin client.
 * Every caller must already be gated by verifyAdmin / verifyAdminOrTrainer;
 * this module trusts the client it is handed and checks nothing itself.
 */

interface MembershipRow {
  profile_id: string;
  branch_id: string;
}

export async function loadBranchIdsByProfile(
  db: SupabaseClient,
  profileIds: readonly string[],
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  if (profileIds.length === 0) return result;

  const { data, error } = (await typedFrom(db, "profile_branches")
    .select("profile_id, branch_id")
    .in("profile_id", [...profileIds])) as {
    data: MembershipRow[] | null;
    error: { message: string } | null;
  };

  if (error) {
    console.error("loadBranchIdsByProfile error:", error);
    return result;
  }

  for (const row of data ?? []) {
    const existing = result.get(row.profile_id) ?? [];
    result.set(row.profile_id, [...existing, row.branch_id]);
  }
  return result;
}

/** Profile ids that belong to at least one of the given branches. */
export async function listProfileIdsInBranches(
  db: SupabaseClient,
  branchIds: readonly string[],
): Promise<string[]> {
  if (branchIds.length === 0) return [];

  const { data, error } = (await typedFrom(db, "profile_branches")
    .select("profile_id")
    .in("branch_id", [...branchIds])) as {
    data: { profile_id: string }[] | null;
    error: { message: string } | null;
  };

  if (error) {
    console.error("listProfileIdsInBranches error:", error);
    return [];
  }

  return Array.from(new Set((data ?? []).map((row) => row.profile_id)));
}

/**
 * Replaces a user's memberships wholesale. Delete then insert: the form always
 * submits the complete list and a membership row carries no state of its own.
 * stampAdmin marks the profile as hand-edited so the Arbox sync leaves it alone.
 */
export async function replaceProfileBranches(
  db: SupabaseClient,
  profileId: string,
  branchIds: readonly string[],
  options: { stampAdmin: boolean },
): Promise<{ error: string | null }> {
  const { error: deleteError } = await typedFrom(db, "profile_branches")
    .delete()
    .eq("profile_id", profileId);

  if (deleteError) {
    console.error("replaceProfileBranches delete error:", deleteError);
    return { error: "שגיאה בעדכון הסניפים" };
  }

  if (branchIds.length > 0) {
    const { error: insertError } = await typedFrom(db, "profile_branches").insert(
      branchIds.map((branchId) => ({ profile_id: profileId, branch_id: branchId })),
    );
    if (insertError) {
      console.error("replaceProfileBranches insert error:", insertError);
      return { error: "שגיאה בעדכון הסניפים" };
    }
  }

  if (options.stampAdmin) {
    const { error: stampError } = await db
      .from("profiles")
      .update({ branches_set_by_admin_at: new Date().toISOString() })
      .eq("id", profileId);
    if (stampError) {
      console.error("replaceProfileBranches stamp error:", stampError);
      return { error: "שגיאה בעדכון הסניפים" };
    }
  }

  return { error: null };
}

/** Active branches in display order, as picker options. */
export async function loadBranchOptions(db: SupabaseClient): Promise<BranchOption[]> {
  const { data, error } = (await typedFrom(db, "branches")
    .select("*")
    .eq("is_active", true)
    .order("order_index")) as { data: Branch[] | null; error: { message: string } | null };

  if (error) {
    console.error("loadBranchOptions error:", error);
    return [];
  }
  return (data ?? []).map(toBranchOption);
}

/** Every branch, active or not, in display order. */
export async function loadAllBranches(db: SupabaseClient): Promise<Branch[]> {
  const { data, error } = (await typedFrom(db, "branches")
    .select("*")
    .order("order_index")) as { data: Branch[] | null; error: { message: string } | null };

  if (error) {
    console.error("loadAllBranches error:", error);
    return [];
  }
  return data ?? [];
}

/** Resolves ids to Hebrew names in the order given; unknown ids are dropped. */
export function branchNamesFor(
  branchIds: readonly string[],
  branches: readonly BranchOption[],
): string[] {
  const byId = new Map(branches.map((b) => [b.id, b.nameHe]));
  return branchIds.flatMap((id) => {
    const name = byId.get(id);
    return name ? [name] : [];
  });
}
```

Check that the `server-only` package is available: run `ls node_modules/server-only`. If missing, run `npm install server-only`.

- [ ] **Step 3: Read-only list actions**

`src/features/branches/lib/actions/list-branches.ts`:

```ts
"use server";

import { cache } from "react";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Branch, BranchOption } from "@/types/branches";
import { loadAllBranches, loadBranchOptions } from "../memberships";

/** Every branch, for admin tables that must still name a deactivated one. */
export const listBranchesAction = cache(async (): Promise<Branch[]> => {
  const { error } = await verifyAdminOrTrainer();
  if (error) return [];
  return loadAllBranches(createAdminClient());
});

/** Active branches only, for pickers. */
export const listActiveBranchOptionsAction = cache(
  async (): Promise<BranchOption[]> => {
    const { error } = await verifyAdminOrTrainer();
    if (error) return [];
    return loadBranchOptions(createAdminClient());
  },
);
```

- [ ] **Step 4: Admin CRUD actions**

`src/features/branches/lib/actions/admin-branches.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { verifyAdmin } from "@/lib/actions/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { isValidUUID } from "@/lib/validations/common";
import {
  branchSchema,
  reorderBranchesSchema,
  type BranchInput,
} from "@/lib/validations/branch";
import type { Branch } from "@/types/branches";
import { loadAllBranches } from "../memberships";

export type { BranchInput } from "@/lib/validations/branch";

type ActionResult =
  | { success: true }
  | { error: string; fieldErrors?: Record<string, string[]> };

export type BranchWithCount = Branch & { memberCount: number };

const UNIQUE_VIOLATION = "23505";

function revalidateBranchSurfaces(): void {
  revalidatePath("/admin/branches");
  revalidatePath("/admin/users");
}

/** Branches plus how many users each one has, for the CMS page. */
export async function listBranchesWithCountsAction(): Promise<BranchWithCount[]> {
  const { error } = await verifyAdmin();
  if (error) return [];

  const db = createAdminClient();
  const [branches, membershipsResult] = await Promise.all([
    loadAllBranches(db),
    typedFrom(db, "profile_branches").select("branch_id") as Promise<{
      data: { branch_id: string }[] | null;
    }>,
  ]);

  const counts = new Map<string, number>();
  for (const row of membershipsResult.data ?? []) {
    counts.set(row.branch_id, (counts.get(row.branch_id) ?? 0) + 1);
  }

  return branches.map((branch) => ({
    ...branch,
    memberCount: counts.get(branch.id) ?? 0,
  }));
}

export async function createBranchAction(input: BranchInput): Promise<ActionResult> {
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };

  const validated = branchSchema.safeParse(input);
  if (!validated.success) {
    return {
      error: "אימות נתונים נכשל",
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const db = createAdminClient();

  const { data: maxOrder } = (await typedFrom(db, "branches")
    .select("order_index")
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle()) as { data: { order_index: number } | null };

  const { error } = await typedFrom(db, "branches").insert({
    name_he: validated.data.name_he,
    arbox_location_name: validated.data.arbox_location_name,
    is_active: validated.data.is_active,
    order_index: (maxOrder?.order_index ?? -1) + 1,
  });

  if (error) {
    if (error.code === UNIQUE_VIOLATION) return { error: "כבר קיים סניף בשם הזה" };
    console.error("createBranch error:", error);
    return { error: "שגיאה ביצירת סניף" };
  }

  revalidateBranchSurfaces();
  return { success: true };
}

export async function updateBranchAction(
  id: string,
  input: BranchInput,
): Promise<ActionResult> {
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };

  if (!isValidUUID(id)) return { error: "מזהה סניף לא תקין" };

  const validated = branchSchema.safeParse(input);
  if (!validated.success) {
    return {
      error: "אימות נתונים נכשל",
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const db = createAdminClient();

  // .update().eq() on a missing row returns no error and updates nothing.
  const { data: existing } = (await typedFrom(db, "branches")
    .select("id")
    .eq("id", id)
    .maybeSingle()) as { data: { id: string } | null };
  if (!existing) return { error: "הסניף לא נמצא" };

  const { error } = await typedFrom(db, "branches")
    .update({
      name_he: validated.data.name_he,
      arbox_location_name: validated.data.arbox_location_name,
      is_active: validated.data.is_active,
    })
    .eq("id", id);

  if (error) {
    if (error.code === UNIQUE_VIOLATION) return { error: "כבר קיים סניף בשם הזה" };
    console.error("updateBranch error:", error);
    return { error: "שגיאה בעדכון סניף" };
  }

  revalidateBranchSurfaces();
  return { success: true };
}

/** Sets order_index from the position of each id in the list. */
export async function reorderBranchesAction(ids: string[]): Promise<ActionResult> {
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };

  const validated = reorderBranchesSchema.safeParse({ ids });
  if (!validated.success) return { error: "רשימת סניפים לא תקינה" };

  const db = createAdminClient();

  for (const [index, id] of validated.data.ids.entries()) {
    const { error } = await typedFrom(db, "branches")
      .update({ order_index: index })
      .eq("id", id);
    if (error) {
      console.error("reorderBranches error:", error);
      return { error: "שגיאה בסידור הסניפים" };
    }
  }

  revalidateBranchSurfaces();
  return { success: true };
}
```

- [ ] **Step 5: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 6: Commit**

```bash
git add src/lib/validations/branch.ts src/features/branches
git commit -m "feat(branches): membership helpers and branch server actions

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Branches admin page and navigation

**Files:**
- Create: `src/features/branches/components/admin/BranchesClient.tsx`
- Create: `src/app/admin/branches/page.tsx`
- Modify: `src/lib/navigation/admin-nav.ts:1-19,61-66`

**Interfaces:**
- Consumes: `listBranchesWithCountsAction`, `createBranchAction`, `updateBranchAction`, `reorderBranchesAction`, `BranchWithCount`, `BranchInput` from Task 3.

- [ ] **Step 1: Client island**

`src/features/branches/components/admin/BranchesClient.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowDown, ArrowUp, Loader2, Pencil, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  createBranchAction,
  reorderBranchesAction,
  updateBranchAction,
  type BranchInput,
  type BranchWithCount,
} from "@/features/branches/lib/actions/admin-branches";

interface BranchDialogProps {
  open: boolean;
  branch?: BranchWithCount;
  onClose: () => void;
  onSaved: () => void;
}

function BranchDialog({ open, branch, onClose, onSaved }: BranchDialogProps) {
  const [pending, startTransition] = useTransition();
  const [nameHe, setNameHe] = useState(branch?.name_he ?? "");
  const [arboxName, setArboxName] = useState(branch?.arbox_location_name ?? "");
  const [isActive, setIsActive] = useState(branch?.is_active ?? true);

  const isEdit = Boolean(branch);

  const handleSave = () => {
    const input: BranchInput = {
      name_he: nameHe.trim(),
      arbox_location_name: arboxName.trim() || null,
      is_active: isActive,
    };

    startTransition(async () => {
      const result =
        isEdit && branch
          ? await updateBranchAction(branch.id, input)
          : await createBranchAction(input);

      if ("error" in result) {
        toast.error(result.error);
        return;
      }

      toast.success(isEdit ? "הסניף עודכן" : "הסניף נוצר");
      onSaved();
      onClose();
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent dir="rtl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "עריכת סניף" : "סניף חדש"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <Label htmlFor="branch-name">שם הסניף</Label>
            <Input
              id="branch-name"
              value={nameHe}
              onChange={(e) => setNameHe(e.target.value)}
              placeholder="למשל: קריית אתא"
              disabled={pending}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="branch-arbox">שם המיקום ב-Arbox (אופציונלי)</Label>
            <Input
              id="branch-arbox"
              value={arboxName}
              onChange={(e) => setArboxName(e.target.value)}
              placeholder="כפי שמופיע בדוח הלקוחות של Arbox"
              disabled={pending}
            />
            <p className="text-xs text-muted-foreground">
              כשהשם תואם, הסנכרון הלילי משייך מתאמנים חדשים לסניף הזה אוטומטית.
            </p>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="branch-active">סניף פעיל</Label>
              <p className="text-xs text-muted-foreground">
                סניף לא פעיל לא מופיע בבחירה, אבל השיוכים וההיסטוריה נשמרים.
              </p>
            </div>
            <Switch
              id="branch-active"
              checked={isActive}
              onCheckedChange={setIsActive}
              disabled={pending}
            />
          </div>
        </div>
        <DialogFooter className="flex-row-reverse gap-2">
          <Button onClick={handleSave} disabled={pending || !nameHe.trim()}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin ms-2" /> : null}
            שמור
          </Button>
          <Button variant="outline" onClick={onClose} disabled={pending}>
            ביטול
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface BranchesClientProps {
  initialBranches: BranchWithCount[];
}

export function BranchesClient({ initialBranches }: BranchesClientProps) {
  const router = useRouter();
  const [addOpen, setAddOpen] = useState(false);
  const [editBranch, setEditBranch] = useState<BranchWithCount | null>(null);
  const [reordering, startReorder] = useTransition();

  const refresh = () => router.refresh();

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= initialBranches.length) return;
    const ids = initialBranches.map((b) => b.id);
    const reordered = ids.map((id, i) => {
      if (i === index) return ids[target];
      if (i === target) return ids[index];
      return id;
    });
    startReorder(async () => {
      const result = await reorderBranchesAction(reordered);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      refresh();
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{initialBranches.length} סניפים</p>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="h-4 w-4 ms-2" />
          סניף חדש
        </Button>
      </div>

      <BranchDialog open={addOpen} onClose={() => setAddOpen(false)} onSaved={refresh} />

      {editBranch && (
        <BranchDialog
          key={editBranch.id}
          open={true}
          branch={editBranch}
          onClose={() => setEditBranch(null)}
          onSaved={refresh}
        />
      )}

      {initialBranches.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          אין סניפים עדיין.
        </div>
      ) : (
        <div className="border rounded-lg divide-y">
          {initialBranches.map((branch, index) => (
            <div
              key={branch.id}
              className="flex items-center justify-between gap-4 px-4 py-3"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="font-medium truncate">{branch.name_he}</span>
                {!branch.is_active && <Badge variant="outline">לא פעיל</Badge>}
                <span className="text-xs text-muted-foreground">
                  {branch.memberCount} משתמשים
                </span>
                {branch.arbox_location_name && (
                  <span className="text-xs text-muted-foreground truncate">
                    Arbox: {branch.arbox_location_name}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => move(index, -1)}
                  disabled={reordering || index === 0}
                  aria-label={`העבר למעלה ${branch.name_he}`}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => move(index, 1)}
                  disabled={reordering || index === initialBranches.length - 1}
                  aria-label={`העבר למטה ${branch.name_he}`}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setEditBranch(branch)}
                  aria-label={`ערוך סניף ${branch.name_he}`}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Page**

`src/app/admin/branches/page.tsx`:

```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { verifyAdmin } from "@/lib/actions/shared";
import { listBranchesWithCountsAction } from "@/features/branches/lib/actions/admin-branches";
import { BranchesClient } from "@/features/branches/components/admin/BranchesClient";

export const metadata: Metadata = {
  title: "ניהול סניפים | Garden of Eden",
};

export default async function AdminBranchesPage() {
  const { error } = await verifyAdmin();
  if (error) redirect("/admin");

  const branches = await listBranchesWithCountsAction();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold mb-2">ניהול סניפים</h1>
        <p className="text-muted-foreground">
          הסניפים שהאקדמיה פועלת בהם. כל מאמן ומתאמן משויך לסניף אחד או לשניהם.
        </p>
      </div>

      <BranchesClient initialBranches={branches} />
    </div>
  );
}
```

- [ ] **Step 3: Navigation entry**

In `src/lib/navigation/admin-nav.ts`, add `MapPin` to the lucide import list (alphabetically after `ListChecks`), and add a new section at the end of `ADMIN_NAV_SECTIONS` (after the `שיווק ולקוחות` section):

```ts
  {
    label: "הגדרות",
    items: [
      { href: "/admin/branches", label: "סניפים", icon: MapPin, mobileOrder: 9 },
    ],
  },
```

The page itself redirects non-admins, so a trainer who taps the link lands back on `/admin`. Check `src/lib/navigation/types.ts` for an `adminOnly` flag on `NavItem`; if one exists, set `adminOnly: true` on this item instead of relying on the redirect alone.

- [ ] **Step 4: Type-check, lint, and smoke test**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

Run `npm run dev`, sign in as admin, open `/admin/branches`. Expected: two rows, חיפה with the full user count, קריית אתא with 0. Create a test branch, rename it, move it, deactivate it. Then delete the test row directly:

```sql
DELETE FROM branches WHERE name_he = '<the test name>';
```

- [ ] **Step 5: Commit**

```bash
git add src/features/branches/components src/app/admin/branches src/lib/navigation/admin-nav.ts
git commit -m "feat(branches): admin branches page

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Branch checkboxes on the user create and edit forms

**Files:**
- Create: `src/features/branches/components/BranchCheckboxGroup.tsx`
- Modify: `src/lib/validations/user-create.ts`, `src/lib/validations/user-edit.ts`
- Modify: `src/types/activity-log.ts:59-67` (FIELD_LABELS_HE)
- Modify: `src/lib/actions/admin-users-create.ts`, `src/lib/actions/admin-users-update.ts`
- Modify: `src/components/admin/users/UserCreateForm.tsx`, `src/components/admin/UserEditForm.tsx`
- Modify: `src/app/admin/users/create/page.tsx`, `src/app/admin/users/[userId]/page.tsx`

**Interfaces:**
- Consumes: `branchIdListSchema`, `replaceProfileBranches`, `loadBranchIdsByProfile`, `loadBranchOptions`, `branchNamesFor`, `branchFieldChange`, `listActiveBranchOptionsAction`.
- Produces: `userCreateSchema.branch_ids`, `userEditSchema.branch_ids`; `getUserEditDefaults(profile, branchIds)`; `BranchCheckboxGroup` component; `createUserAction`/`updateUserAction` persist branches.

- [ ] **Step 1: Validation schemas**

In `src/lib/validations/user-create.ts`, add the import and field:

```ts
import { branchIdListSchema } from "@/lib/validations/branch";
```

Inside `userCreateSchema` after `role`:

```ts
  branch_ids: branchIdListSchema.default([]),
```

In `src/lib/validations/user-edit.ts`, add the same import, and inside `userEditSchema` after `is_active`:

```ts
  branch_ids: branchIdListSchema.default([]),
```

Change `getUserEditDefaults` to take the memberships:

```ts
export function getUserEditDefaults(
  profile: Profile,
  branchIds: readonly string[] = [],
): UserEditFormData {
  return {
    full_name: profile.full_name || "",
    phone: profile.phone || "",
    birthdate: profile.birthdate || "",
    club: profile.club || "",
    role: profile.role,
    is_active: profile.is_active,
    branch_ids: [...branchIds],
  };
}
```

`getFieldChanges` is unchanged: the branch change is computed separately with `branchFieldChange` because it needs names, not ids.

In `src/types/activity-log.ts`, add to `FIELD_LABELS_HE`:

```ts
  club: "מועדון",
  branches: "סניפים",
```

- [ ] **Step 2: Checkbox group component**

`src/features/branches/components/BranchCheckboxGroup.tsx`:

```tsx
"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { BranchOption } from "@/types/branches";

interface BranchCheckboxGroupProps {
  branches: readonly BranchOption[];
  value: readonly string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  idPrefix?: string;
}

/**
 * One checkbox per active branch. Zero, one or all may be checked: a user
 * with no branch is legitimate during rollout, and a dual-branch user is the
 * whole reason this is not a select.
 */
export function BranchCheckboxGroup({
  branches,
  value,
  onChange,
  disabled = false,
  idPrefix = "branch",
}: BranchCheckboxGroupProps) {
  const toggle = (branchId: string, checked: boolean) => {
    const without = value.filter((id) => id !== branchId);
    onChange(checked ? [...without, branchId] : without);
  };

  if (branches.length === 0) {
    return <p className="text-sm text-muted-foreground">אין סניפים פעילים</p>;
  }

  return (
    <div className="flex flex-wrap gap-4">
      {branches.map((branch) => {
        const id = `${idPrefix}-${branch.id}`;
        return (
          <div key={branch.id} className="flex items-center gap-2">
            <Checkbox
              id={id}
              checked={value.includes(branch.id)}
              onCheckedChange={(checked) => toggle(branch.id, checked === true)}
              disabled={disabled}
            />
            <Label htmlFor={id} className="cursor-pointer">
              {branch.nameHe}
            </Label>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 3: Create action persists branches**

In `src/lib/actions/admin-users-create.ts`:

Add imports:

```ts
import { replaceProfileBranches, loadBranchOptions, branchNamesFor } from "@/features/branches/lib/memberships";
```

Change the destructure line to:

```ts
  const { full_name, phone, branch_ids } = validated.data;
```

After the profile update block (step 5) and before the activity log (step 6), add:

```ts
    // 5b. Branch memberships. An explicit choice on create counts as a
    // hand-edit, so the Arbox sync will not overwrite it.
    let branchNames: string[] = [];
    if (branch_ids.length > 0) {
      const { error: branchError } = await replaceProfileBranches(
        adminClient,
        authData.user.id,
        branch_ids,
        { stampAdmin: true },
      );
      if (branchError) {
        console.error("Create user branch error:", branchError);
      } else {
        branchNames = branchNamesFor(branch_ids, await loadBranchOptions(adminClient));
      }
    }
```

In the activity log `changes` array, append:

```ts
        ...(branchNames.length > 0
          ? [{ field: "branches", old_value: null, new_value: branchNames.join(", ") }]
          : []),
```

- [ ] **Step 4: Update action persists branches and logs the change**

In `src/lib/actions/admin-users-update.ts`:

Add imports:

```ts
import {
  branchNamesFor,
  loadBranchIdsByProfile,
  loadBranchOptions,
  replaceProfileBranches,
} from "@/features/branches/lib/memberships";
import { branchFieldChange } from "@/lib/branches/branch-change";
```

Change the destructure to include `branch_ids`:

```ts
  const { full_name, phone, birthdate, club, role, is_active, branch_ids } = validated.data;
```

Replace step 7 (change detection) with:

```ts
    // 7. Detect changes, including branch memberships
    const [membershipMap, branchOptions] = await Promise.all([
      loadBranchIdsByProfile(adminClient, [userId]),
      loadBranchOptions(adminClient),
    ]);
    const originalBranchIds = membershipMap.get(userId) ?? [];
    const branchChange = branchFieldChange(
      branchNamesFor(originalBranchIds, branchOptions),
      branchNamesFor(branch_ids, branchOptions),
    );

    const changes = [
      ...getFieldChanges(targetProfile, validated.data),
      ...(branchChange ? [branchChange] : []),
    ];
    if (changes.length === 0) {
      return { success: true, message: "לא בוצעו שינויים" };
    }
```

After step 9 (profile update) and before step 10 (activity log), add:

```ts
    // 9b. Branch memberships. Trainers may set these on trainees (the
    // trainer-edits-trainee rule in step 5 already holds here).
    if (branchChange) {
      const { error: branchError } = await replaceProfileBranches(
        adminClient,
        userId,
        branch_ids,
        { stampAdmin: true },
      );
      if (branchError) return { error: branchError };
    }
```

- [ ] **Step 5: Edit form**

In `src/components/admin/UserEditForm.tsx`:

Add imports:

```ts
import { BranchCheckboxGroup } from "@/features/branches/components/BranchCheckboxGroup";
import type { BranchOption } from "@/types/branches";
```

Extend props:

```ts
interface UserEditFormProps {
  user: Profile;
  currentUserRole: UserRole;
  branches: BranchOption[];
  initialBranchIds: string[];
}
```

Change the signature and defaults:

```ts
export function UserEditForm({ user, currentUserRole, branches, initialBranchIds }: UserEditFormProps) {
  ...
  const form = useForm<UserEditFormData>({
    resolver: zodResolver(userEditSchema),
    defaultValues: getUserEditDefaults(user, initialBranchIds),
  });
```

Insert a new field after the Club field and before the Role field:

```tsx
        {/* Branches */}
        <FormField
          control={form.control}
          name="branch_ids"
          render={({ field }) => (
            <FormItem>
              <FormLabel>סניפים</FormLabel>
              <FormControl>
                <BranchCheckboxGroup
                  branches={branches}
                  value={field.value ?? []}
                  onChange={field.onChange}
                  disabled={loading}
                  idPrefix="edit-branch"
                />
              </FormControl>
              <FormDescription>אפשר לבחור סניף אחד או את שניהם</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
```

- [ ] **Step 6: Create form**

In `src/components/admin/users/UserCreateForm.tsx`:

Add imports:

```ts
import { BranchCheckboxGroup } from "@/features/branches/components/BranchCheckboxGroup";
import type { BranchOption } from "@/types/branches";
```

Extend props and defaults:

```ts
interface UserCreateFormProps {
  isAdmin?: boolean;
  branches: BranchOption[];
}

export function UserCreateForm({ isAdmin = true, branches }: UserCreateFormProps) {
  ...
    defaultValues: {
      full_name: "",
      phone: "",
      role: "trainee",
      branch_ids: [],
    },
```

Insert after the Phone field:

```tsx
        {/* Branches */}
        <FormField
          control={form.control}
          name="branch_ids"
          render={({ field }) => (
            <FormItem>
              <FormLabel>סניפים</FormLabel>
              <FormControl>
                <BranchCheckboxGroup
                  branches={branches}
                  value={field.value ?? []}
                  onChange={field.onChange}
                  disabled={loading}
                  idPrefix="create-branch"
                />
              </FormControl>
              <FormDescription>אפשר לבחור סניף אחד או את שניהם</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
```

- [ ] **Step 7: Pages load the branch lists**

In `src/app/admin/users/create/page.tsx`, add the import and load:

```ts
import { listActiveBranchOptionsAction } from "@/features/branches/lib/actions/list-branches";
```

After `const isAdmin = ...`:

```ts
  const branches = await listActiveBranchOptionsAction();
```

Change the form usage to `<UserCreateForm isAdmin={isAdmin} branches={branches} />`.

In `src/app/admin/users/[userId]/page.tsx`, add imports:

```ts
import { listActiveBranchOptionsAction } from "@/features/branches/lib/actions/list-branches";
import { loadBranchIdsByProfile } from "@/features/branches/lib/memberships";
import { createAdminClient } from "@/lib/supabase/admin";
```

After the `userToEdit` null check and the trainer redirect, add:

```ts
  // Memberships read through the service role: a trainer cannot read another
  // user's profile_branches rows through RLS, and this page is already gated.
  const [branches, membershipMap] = await Promise.all([
    listActiveBranchOptionsAction(),
    loadBranchIdsByProfile(createAdminClient(), [userId]),
  ]);
  const initialBranchIds = membershipMap.get(userId) ?? [];
```

Change the form usage to:

```tsx
              <UserEditForm
                user={userToEdit}
                currentUserRole={currentProfile?.role as UserRole}
                branches={branches}
                initialBranchIds={initialBranchIds}
              />
```

- [ ] **Step 8: Type-check, lint, and verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

Run the dev server. As admin, open a trainee, tick קריית אתא, save. Expected: toast "המשתמש עודכן בהצלחה!", the activity log at the bottom shows a `סניפים` row `חיפה -> חיפה, קריית אתא`, and this SQL shows two rows and a non-null stamp:

```sql
SELECT branch_id FROM profile_branches WHERE profile_id = '<id>';
SELECT branches_set_by_admin_at FROM profiles WHERE id = '<id>';
```

Save again with no change. Expected: toast "לא בוצעו שינויים". Untick both and save. Expected: zero rows.

- [ ] **Step 9: Commit**

```bash
git add src/lib/validations/user-create.ts src/lib/validations/user-edit.ts src/types/activity-log.ts src/lib/actions/admin-users-create.ts src/lib/actions/admin-users-update.ts src/components/admin/UserEditForm.tsx src/components/admin/users/UserCreateForm.tsx src/features/branches/components/BranchCheckboxGroup.tsx "src/app/admin/users/create/page.tsx" "src/app/admin/users/[userId]/page.tsx"
git commit -m "feat(branches): assign branches from the user create and edit forms

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Branch column, filter, and export on the users list

**Files:**
- Modify: `src/app/admin/users/page.tsx`
- Modify: `src/components/admin/users/UserDataTable.tsx`
- Modify: `src/components/admin/users/UserTableColumns.tsx`
- Modify: `src/components/admin/users/UserTableToolbar.tsx`
- Modify: `src/components/admin/users/UserExportButton.tsx`

**Interfaces:**
- Consumes: `ProfileWithBranches`, `BranchOption`, `loadBranchIdsByProfile`, `loadAllBranches`, `buildBranchFilterOptions`, `matchesBranchFilter`, `BRANCH_FILTER_ALL`.
- Produces: `UserDataTable` props gain `branches: BranchOption[]` and `initialBranch: string | null`; `data` becomes `ProfileWithBranches[]`; `UserTableToolbar` gains `onBranchChange` and `branchOptions`; `UserExportButton.users` becomes `ProfileWithBranches[]`.

- [ ] **Step 1: Page attaches memberships**

In `src/app/admin/users/page.tsx`:

Add imports:

```ts
import { createAdminClient } from "@/lib/supabase/admin";
import { loadAllBranches, loadBranchIdsByProfile, branchNamesFor } from "@/features/branches/lib/memberships";
import { toBranchOption, type ProfileWithBranches } from "@/types/branches";
```

Add `branch?: string;` to the `searchParams` type.

After `const typedUsers = (users || []) as Profile[];`, replace the rest of the data prep with:

```ts
  // Memberships through the service role: the page is gated above, and a
  // trainer cannot read other users' profile_branches rows through RLS.
  const adminClient = createAdminClient();
  const [allBranches, membershipMap] = await Promise.all([
    loadAllBranches(adminClient),
    loadBranchIdsByProfile(adminClient, typedUsers.map((u) => u.id)),
  ]);
  // Inactive branches still resolve to a name so a deactivated branch is
  // shown on the users that keep it; pickers get active ones only.
  const allBranchOptions = allBranches.map(toBranchOption);
  const activeBranchOptions = allBranches.filter((b) => b.is_active).map(toBranchOption);

  const usersWithBranches: ProfileWithBranches[] = typedUsers.map((user) => {
    const branchIds = membershipMap.get(user.id) ?? [];
    return { ...user, branchIds, branchNames: branchNamesFor(branchIds, allBranchOptions) };
  });

  const params = await searchParams;
  const activeUserCount = usersWithBranches.filter((u) => !u.deleted_at).length;
```

Change the export button to `<UserExportButton users={usersWithBranches.filter((u) => !u.deleted_at)} />` and the table to:

```tsx
          <UserDataTable
            data={usersWithBranches}
            branches={activeBranchOptions}
            initialSearch={params.q || ""}
            initialRole={params.role || null}
            initialStatus={params.status || null}
            initialPosition={params.position || null}
            initialBranch={params.branch || null}
            initialShowDeleted={params.deleted === "true"}
            isAdmin={isAdmin}
          />
```

- [ ] **Step 2: Columns**

In `src/components/admin/users/UserTableColumns.tsx`:

Replace the `Profile` import with:

```ts
import type { ProfileWithBranches } from "@/types/branches";
import { NO_BRANCH_LABEL_HE } from "@/types/branches";
```

Change `export const columns: ColumnDef<Profile>[]` to `ColumnDef<ProfileWithBranches>[]`, and insert a branch column after the `role` column and before `is_active`:

```ts
  {
    id: "branches",
    header: "סניף",
    cell: ({ row }) =>
      row.original.branchNames.length === 0 ? (
        <span className="text-xs text-muted-foreground">{NO_BRANCH_LABEL_HE}</span>
      ) : (
        <div className="flex flex-wrap gap-1">
          {row.original.branchNames.map((name) => (
            <Badge key={name} variant="secondary" className="text-xs">
              {name}
            </Badge>
          ))}
        </div>
      ),
    enableSorting: false,
  },
```

- [ ] **Step 3: Toolbar**

In `src/components/admin/users/UserTableToolbar.tsx`:

Add imports:

```ts
import { BRANCH_FILTER_ALL, buildBranchFilterOptions } from "@/lib/admin/branch-filter";
import type { BranchOption } from "@/types/branches";
```

Extend props:

```ts
  onBranchChange: (value: string | null) => void;
  branchOptions: BranchOption[];
```

Destructure `onBranchChange` and `branchOptions`. Add the URL state after `position`:

```ts
  const [branch, setBranch] = useQueryState("branch", parseAsString);
```

Add the sync effect after the position effect:

```ts
  useEffect(() => {
    onBranchChange(branch);
  }, [branch, onBranchChange]);
```

Add the handler after `handlePositionChange`:

```ts
  const handleBranchChange = (value: string) => {
    const next = value === BRANCH_FILTER_ALL ? null : value;
    setBranch(next);
    onBranchChange(next);
  };
```

Insert the select after the Position select:

```tsx
        {/* Branch Filter */}
        <Select value={branch || BRANCH_FILTER_ALL} onValueChange={handleBranchChange}>
          <SelectTrigger className="w-full md:w-40">
            <SelectValue placeholder="סניף" />
          </SelectTrigger>
          <SelectContent>
            {buildBranchFilterOptions(branchOptions).map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
```

- [ ] **Step 4: Data table**

In `src/components/admin/users/UserDataTable.tsx`:

Replace the `Profile` type import with:

```ts
import type { ProfileWithBranches, BranchOption } from "@/types/branches";
import { matchesBranchFilter } from "@/lib/admin/branch-filter";
```

Change the props:

```ts
interface UserDataTableProps {
  data: ProfileWithBranches[];
  branches: BranchOption[];
  initialSearch?: string;
  initialRole?: string | null;
  initialStatus?: string | null;
  initialPosition?: string | null;
  initialBranch?: string | null;
  initialShowDeleted?: boolean;
  isAdmin?: boolean;
}
```

Destructure `branches` and `initialBranch = null`. Add state after `positionFilter`:

```ts
  const [branchFilter, setBranchFilter] = useState<string | null>(initialBranch);
```

In the `filteredData` memo, after the position check:

```ts
      if (!matchesBranchFilter(user.branchIds, branchFilter)) return false;
```

and add `branchFilter` to the dependency array.

Add the callback:

```ts
  const handleBranchChange = useCallback((value: string | null) => {
    setBranchFilter(value);
  }, []);
```

Pass to the toolbar:

```tsx
        onBranchChange={handleBranchChange}
        branchOptions={branches}
```

In the mobile card list, after the `<RoleBadge role={user.role} />` line, add:

```tsx
                    {user.branchNames.map((name) => (
                      <Badge key={name} variant="secondary" className="text-[10px]">
                        {name}
                      </Badge>
                    ))}
```

and add `import { Badge } from "@/components/ui/badge";` at the top.

- [ ] **Step 5: Export**

In `src/components/admin/users/UserExportButton.tsx`, change the import and prop type to `ProfileWithBranches`:

```ts
import type { ProfileWithBranches } from "@/types/branches";
...
  users: ProfileWithBranches[];
```

Add to the row object after `"תפקיד"`:

```ts
      "סניף": user.branchNames.join(", "),
```

- [ ] **Step 6: Type-check, lint, verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

Dev server: `/admin/users` shows a סניף column with a חיפה badge on everyone; filter by קריית אתא shows the trainee edited in Task 5; filter "ללא סניף" shows nobody; the URL carries `?branch=`. Export downloads a CSV whose header row includes סניף.

- [ ] **Step 7: Commit**

```bash
git add src/app/admin/users/page.tsx src/components/admin/users/UserDataTable.tsx src/components/admin/users/UserTableColumns.tsx src/components/admin/users/UserTableToolbar.tsx src/components/admin/users/UserExportButton.tsx
git commit -m "feat(branches): branch column, filter and CSV column on the users list

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Bulk assign to branch

**Files:**
- Create: `src/lib/actions/admin-users-branches.ts`
- Create: `src/components/admin/users/BulkBranchAssignBar.tsx`
- Modify: `src/lib/actions/admin-users.ts` (barrel)
- Modify: `src/components/admin/users/UserTableColumns.tsx`, `src/components/admin/users/UserDataTable.tsx`

**Interfaces:**
- Produces: `bulkAssignBranchAction({ userIds, branchId }): Promise<{ success: true; assigned: number } | { error: string }>`; `getUserColumns({ selectable }): ColumnDef<ProfileWithBranches>[]` replaces the exported `columns` const.

- [ ] **Step 1: Server action**

`src/lib/actions/admin-users-branches.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { verifyAdmin } from "@/lib/actions/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { UUID_REGEX } from "@/lib/validations/common";

const MAX_BULK_ASSIGN = 200;

const bulkAssignSchema = z.object({
  userIds: z
    .array(z.string().regex(UUID_REGEX))
    .min(1, "לא נבחרו משתמשים")
    .max(MAX_BULK_ASSIGN, `ניתן לשייך עד ${MAX_BULK_ASSIGN} משתמשים בפעם אחת`),
  branchId: z.string().regex(UUID_REGEX, "מזהה סניף לא תקין"),
});

export type BulkAssignBranchInput = z.input<typeof bulkAssignSchema>;

type Result = { success: true; assigned: number } | { error: string };

/**
 * Adds one branch to every selected user without removing their other
 * branches. Additive on purpose: "move" would silently drop a dual-branch
 * user's second branch, and Eden can untick from the edit form when she
 * really means to remove one.
 */
export async function bulkAssignBranchAction(
  input: BulkAssignBranchInput,
): Promise<Result> {
  const { error: authError, user, adminProfile } = await verifyAdmin();
  if (authError) return { error: authError };

  const validated = bulkAssignSchema.safeParse(input);
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "אימות נתונים נכשל" };
  }

  const { userIds, branchId } = validated.data;
  const db = createAdminClient();

  const { data: branch } = (await typedFrom(db, "branches")
    .select("id, name_he, is_active")
    .eq("id", branchId)
    .maybeSingle()) as { data: { id: string; name_he: string; is_active: boolean } | null };

  if (!branch || !branch.is_active) return { error: "הסניף לא נמצא או אינו פעיל" };

  const { error: upsertError } = await typedFrom(db, "profile_branches").upsert(
    userIds.map((profileId) => ({ profile_id: profileId, branch_id: branchId })),
    { onConflict: "profile_id,branch_id", ignoreDuplicates: true },
  );

  if (upsertError) {
    console.error("bulkAssignBranch upsert error:", upsertError);
    return { error: "שגיאה בשיוך לסניף" };
  }

  const now = new Date().toISOString();
  const { error: stampError } = await db
    .from("profiles")
    .update({ branches_set_by_admin_at: now })
    .in("id", userIds);

  if (stampError) {
    console.error("bulkAssignBranch stamp error:", stampError);
    return { error: "שגיאה בשיוך לסניף" };
  }

  await db.from("activity_logs").insert(
    userIds.map((userId) => ({
      user_id: userId,
      action: "user_updated",
      actor_id: user!.id,
      actor_name: adminProfile?.full_name || "מנהל",
      changes: [{ field: "branches", old_value: null, new_value: `+ ${branch.name_he}` }],
    })),
  );

  revalidatePath("/admin/users");
  return { success: true, assigned: userIds.length };
}
```

In `src/lib/actions/admin-users.ts`, add:

```ts
export { bulkAssignBranchAction } from "./admin-users-branches";
export type { BulkAssignBranchInput } from "./admin-users-branches";
```

- [ ] **Step 2: Selection column**

In `src/components/admin/users/UserTableColumns.tsx`, add `import { Checkbox } from "@/components/ui/checkbox";` and replace `export const columns: ColumnDef<ProfileWithBranches>[] = [` with a factory. Keep every existing column definition inside the array unchanged, and put the selection column first:

```ts
const selectColumn: ColumnDef<ProfileWithBranches> = {
  id: "select",
  header: ({ table }) => (
    <Checkbox
      checked={table.getIsAllPageRowsSelected()}
      onCheckedChange={(value) => table.toggleAllPageRowsSelected(value === true)}
      aria-label="בחר את כל השורות בעמוד"
      onClick={(e) => e.stopPropagation()}
    />
  ),
  cell: ({ row }) => (
    <Checkbox
      checked={row.getIsSelected()}
      onCheckedChange={(value) => row.toggleSelected(value === true)}
      aria-label="בחר שורה"
      onClick={(e) => e.stopPropagation()}
    />
  ),
  enableSorting: false,
};

const baseColumns: ColumnDef<ProfileWithBranches>[] = [
  // ...the existing avatar, full_name, phone, role, branches, is_active, payment_status columns, unchanged
];

export function getUserColumns({ selectable }: { selectable: boolean }): ColumnDef<ProfileWithBranches>[] {
  return selectable ? [selectColumn, ...baseColumns] : baseColumns;
}
```

The `stopPropagation` matters: the row itself navigates on click.

- [ ] **Step 3: Bulk bar component**

`src/components/admin/users/BulkBranchAssignBar.tsx`:

```tsx
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { bulkAssignBranchAction } from "@/lib/actions/admin-users";
import type { BranchOption } from "@/types/branches";

interface BulkBranchAssignBarProps {
  selectedUserIds: string[];
  branches: BranchOption[];
  onDone: () => void;
}

export function BulkBranchAssignBar({
  selectedUserIds,
  branches,
  onDone,
}: BulkBranchAssignBarProps) {
  const router = useRouter();
  const [branchId, setBranchId] = useState("");
  const [pending, startTransition] = useTransition();

  if (selectedUserIds.length === 0) return null;

  const handleAssign = () => {
    if (!branchId) {
      toast.error("יש לבחור סניף");
      return;
    }
    startTransition(async () => {
      const result = await bulkAssignBranchAction({ userIds: selectedUserIds, branchId });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(`${result.assigned} משתמשים שויכו לסניף`);
      onDone();
      router.refresh();
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/40 px-4 py-3">
      <span className="text-sm font-medium">{selectedUserIds.length} נבחרו</span>
      <Select value={branchId} onValueChange={setBranchId} disabled={pending}>
        <SelectTrigger className="w-44">
          <SelectValue placeholder="בחר סניף" />
        </SelectTrigger>
        <SelectContent>
          {branches.map((b) => (
            <SelectItem key={b.id} value={b.id}>
              {b.nameHe}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button size="sm" onClick={handleAssign} disabled={pending || !branchId}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin ms-2" /> : <MapPin className="h-4 w-4 ms-2" />}
        שיוך לסניף
      </Button>
      <Button size="sm" variant="ghost" onClick={onDone} disabled={pending}>
        ביטול בחירה
      </Button>
    </div>
  );
}
```

- [ ] **Step 4: Wire selection into the table**

In `src/components/admin/users/UserDataTable.tsx`:

Change the columns import to `import { getUserColumns } from "./UserTableColumns";`, add `import { BulkBranchAssignBar } from "./BulkBranchAssignBar";`, and add `type RowSelectionState` to the TanStack import list.

Inside the component, after `sorting` state:

```ts
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
  const columns = useMemo(() => getUserColumns({ selectable: isAdmin }), [isAdmin]);
```

Update `useReactTable`:

```ts
  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting, rowSelection },
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    enableRowSelection: isAdmin,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    initialState: { pagination: { pageSize: 10 } },
  });

  const selectedUserIds = useMemo(
    () => Object.keys(rowSelection).filter((id) => rowSelection[id]),
    [rowSelection],
  );
```

Render the bar between the toolbar and the mobile list:

```tsx
      {isAdmin && (
        <BulkBranchAssignBar
          selectedUserIds={selectedUserIds}
          branches={branches}
          onDone={() => setRowSelection({})}
        />
      )}
```

`getRowId` returning the profile id is what makes `rowSelection` keys usable as user ids. `columns.length` is already used for the empty-state `colSpan`; it now reflects the memoized value.

- [ ] **Step 5: Type-check, lint, verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

Dev server as admin: tick three users, pick קריית אתא, press שיוך לסניף. Expected: toast with the count, the badges appear, and the users keep their existing חיפה badge. Sign in as a trainer: no checkbox column and no bar.

- [ ] **Step 6: Commit**

```bash
git add src/lib/actions/admin-users-branches.ts src/lib/actions/admin-users.ts src/components/admin/users/BulkBranchAssignBar.tsx src/components/admin/users/UserTableColumns.tsx src/components/admin/users/UserDataTable.tsx
git commit -m "feat(branches): bulk assign selected users to a branch

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Dormant Arbox branch fill

**Files:**
- Modify: `src/lib/arbox/sync.ts`

**Interfaces:**
- Consumes: `matchArboxBranch`, `loadAllBranches`, `replaceProfileBranches`.

- [ ] **Step 1: Add the fill**

In `src/lib/arbox/sync.ts`:

Add imports:

```ts
import { matchArboxBranch } from "@/lib/branches/arbox-branch-match";
import { loadAllBranches, replaceProfileBranches } from "@/features/branches/lib/memberships";
import type { Branch } from "@/types/branches";
```

Add a helper above `processArboxUser`:

```ts
/**
 * Fills a profile's branch from Arbox when nobody has set it by hand.
 *
 * Dormant today: every Arbox client carries the same location name and no
 * branch claims it, so matchArboxBranch returns null and nothing is written.
 * The day Eden splits Arbox and sets a branch's Arbox name, new signups land
 * in the right branch on the next nightly run. Hand-edited profiles
 * (branches_set_by_admin_at set) are never touched.
 */
async function applyArboxBranch(
  supabase: ReturnType<typeof createAdminClient>,
  profileId: string,
  setByAdminAt: string | null,
  locationName: string | null,
  branches: readonly Branch[],
): Promise<void> {
  if (setByAdminAt) return;
  const branch = matchArboxBranch(locationName, branches);
  if (!branch) return;

  const { error } = await replaceProfileBranches(supabase, profileId, [branch.id], {
    stampAdmin: false,
  });
  if (error) {
    console.error(`[Arbox Sync] Branch fill failed for profile ${profileId}:`, error);
  }
}
```

Change the `processArboxUser` signature to receive the branch list:

```ts
async function processArboxUser(
  supabase: ReturnType<typeof createAdminClient>,
  arboxUser: ArboxUser,
  branches: readonly Branch[],
): Promise<"created" | "updated" | "skipped" | "error"> {
```

Change the lookup select to include the stamp:

```ts
    .select("id, full_name, arbox_user_id, branches_set_by_admin_at")
```

In the `if (existing)` block, before `if (Object.keys(updates).length === 0) return "skipped";`, add:

```ts
    await applyArboxBranch(
      supabase,
      existing.id,
      existing.branches_set_by_admin_at ?? null,
      arboxUser.location_name,
      branches,
    );
```

After the new-profile enrichment succeeds (just before `return "created";`), add:

```ts
  await applyArboxBranch(supabase, authData.user.id, null, arboxUser.location_name, branches);
```

In `syncArboxUsers`, load the branches once and pass them:

```ts
  const branches = await loadAllBranches(supabase);
  ...
  for (const user of users) {
    const outcome = await processArboxUser(supabase, user, branches);
```

- [ ] **Step 2: Type-check, lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 3: Verify dormancy against production data**

Run the cron handler locally against the linked project by calling the sync directly:

```bash
npx tsx -e '
import "dotenv/config";
' 2>/dev/null; node -e '
const fs=require("fs");
for (const l of fs.readFileSync(".env.local","utf8").split("\n")) { const i=l.indexOf("="); if(i>0) process.env[l.slice(0,i)]=l.slice(i+1).replace(/^"|"$/g,"").replace(/\\n$/,""); }
require("child_process").execSync("npx tsx -e \"import { syncArboxUsers } from './src/lib/arbox/sync'; syncArboxUsers().then(r => console.log(r))\"", { stdio: "inherit", env: process.env });
'
```

Expected: the result object prints, and this query still returns the same count as before the run (no branch was filled because nothing matches):

```sql
SELECT count(*) FROM profile_branches;
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/arbox/sync.ts
git commit -m "feat(branches): Arbox sync fills a branch when a location name matches

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: Foundation wrap-up

- [ ] **Step 1: Full verification**

Run:

```bash
npx tsc --noEmit && npm run lint && npm run test:run && npm run build
```

Expected: all four clean.

- [ ] **Step 2: Update CLAUDE.md**

In `CLAUDE.md`, under "Shared Admin Components", add one line:

```markdown
- `BranchCheckboxGroup` from `src/features/branches/components/` — branch membership picker used by the user create and edit forms
```

Under "Gotchas", add:

```markdown
- **profile_branches is readable only by its owner and admins**: trainer-facing surfaces read memberships through `src/features/branches/lib/memberships.ts` with the service role, inside actions gated by `verifyAdminOrTrainer()`.
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(branches): note membership helpers and the checkbox group

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

Then continue with `docs/superpowers/plans/2026-09-10-branches-scoping-and-schedule.md`.
