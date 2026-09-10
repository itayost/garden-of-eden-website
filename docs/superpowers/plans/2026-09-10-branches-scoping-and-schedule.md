# Branches Scoping, Schedule, Shifts and Rankings Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a user's branch matter: trainers see only their branch, the schedule and shifts are tagged and filtered by branch, and rankings are computed within a branch.

**Architecture:** One request-scoped server action, `getBranchScopeAction`, resolves the caller's `BranchScope`; every trainer-facing list narrows its profile query with it. The schedule pages carry the current branch in `?branch=`, resolve it server-side with `resolveRequestedBranch`, and hand it to client dialogs through a small React context so no dialog needs new props threaded through six layers. Shifts, rankings and retention read the same scope.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Supabase, Zod 4, nuqs, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-10-branches-design.md` (Sections 3, 4, 5, 6, 7). Requires Plan 1 (`2026-09-10-branches-foundation.md`) to be complete.

## Global Constraints

- All user-facing text in Hebrew; logical CSS properties only.
- No emojis in code, comments, or docs. No em dashes in user-facing copy.
- Immutability: never mutate objects or arrays.
- Admin actions call `verifyAdmin()`; staff actions call `verifyAdminOrTrainer()`.
- Validate every id with `isValidUUID()` or `UUID_REGEX`.
- `createAdminClient()` only inside server code gated by a verify call.
- No mock-based tests. Unit tests cover pure functions only.
- The Hebrew error for an out-of-scope trainee is exactly `המתאמן אינו בסניף שלך`.
- Files 200-400 lines typical, 800 max.
- Run after every task: `npx tsc --noEmit` and `npm run lint`. Both must be clean before committing.
- Commit format: `feat(branches): ...`, `test(branches): ...`.

---

## File Structure

**Created:**

| File | Responsibility |
|---|---|
| `src/lib/actions/shared/branch-scope.ts` | `getBranchScopeAction()` (request-cached) |
| `src/lib/actions/shared/assert-branch.ts` | `assertBranchWritable(branchId)` for mutations |
| `src/lib/branches/resolve-branch.ts` | `resolveRequestedBranch` (pure) |
| `src/lib/branches/clock-in-branch.ts` | `pickClockInBranch` (pure) |
| `src/lib/branches/__tests__/resolve-branch.test.ts`, `clock-in-branch.test.ts` | Unit tests |
| `src/features/branches/components/BranchContext.tsx` | `BranchProvider`, `useCurrentBranch` |
| `src/features/branches/components/BranchSwitcher.tsx` | URL-backed switcher for the schedule pages |
| `src/features/branches/components/BranchUrlFilter.tsx` | Admin `?branch=` select for server-rendered lists |
| `src/features/rankings/components/BranchFilter.tsx` | Select next to the age-group filter |

**Modified:**

| File | Change |
|---|---|
| `src/features/branches/lib/memberships.ts` | `scopedProfileIds`, `loadMemberBranchOptions` |
| `src/lib/actions/shared/index.ts` | Re-export the scope action |
| `src/app/admin/users/page.tsx` | Trainer scoping |
| `src/lib/actions/admin-assessments-list.ts`, `admin-assessments-month.ts` | Scope + `branchId` param |
| `src/components/admin/assessments/AssessmentsTable.tsx`, `AssessmentsMonthView.tsx`, `AssessmentsContent.tsx`, `src/app/admin/assessments/page.tsx` | Branch select |
| `src/lib/actions/admin-submissions-list.ts`, `src/app/admin/submissions/page.tsx`, `src/components/admin/submissions/SubmissionsContent.tsx` | Scope + `branchId` |
| `src/lib/actions/schedule-options.ts` | Pick lists per branch |
| `src/lib/actions/admin-users-update.ts`, `src/features/player-assessments/lib/actions/record-assessment.ts` | Write-side scope checks |
| `src/types/schedule.ts`, `src/types/weekly-schedule.ts` | `branch_id` |
| `src/lib/validations/schedule.ts`, `weekly-schedule.ts` | `branchId` in every schema |
| `src/lib/actions/daily-schedule-list.ts`, `daily-schedule-mutate.ts`, `daily-schedule-build.ts`, `weekly-schedule-list.ts`, `weekly-schedule-mutate.ts` | Branch filter and column |
| `src/app/admin/schedule/page.tsx`, `src/app/admin/weekly-schedule/page.tsx` | Resolve branch, provider |
| `src/components/admin/schedule/ScheduleDayView.tsx`, `SlotFormDialog.tsx`, `BuildDayButton.tsx`, `DuplicateDayButton.tsx`, `week/WeeklySchedulePageClient.tsx`, `week/BandFormDialog.tsx`, `week/ExceptionFormDialog.tsx`, `week/BuildWeekButton.tsx` | Read branch from context |
| `src/lib/actions/trainer-shifts.ts`, `src/app/api/shifts/sync/route.ts`, `src/lib/offline/shift-queue.ts`, `src/hooks/use-shift-queue-sync.ts`, `public/sw.js` | `branchId` through clock-in |
| `src/components/admin/shifts/ShiftStatusCard.tsx`, `ShiftFormDialog.tsx`, `TrainerShiftsView.tsx`, `src/app/admin/page.tsx`, `src/app/admin/shifts/page.tsx` | Branch choice, select, badge, filter |
| `src/features/rankings/lib/actions/get-rankings.ts`, `components/RankingsView.tsx`, `src/app/dashboard/rankings/page.tsx` | Per-branch rankings |
| `src/app/admin/retention/page.tsx`, `src/components/admin/retention/RetentionPageClient.tsx` | Trainer scoping by phone |

---

### Task 10: Scope action, pure resolvers, and the branch context

**Files:**
- Create: `src/lib/actions/shared/branch-scope.ts`
- Create: `src/lib/actions/shared/assert-branch.ts`
- Create: `src/lib/branches/resolve-branch.ts`
- Create: `src/lib/branches/clock-in-branch.ts`
- Create: `src/features/branches/components/BranchContext.tsx`
- Create: `src/features/branches/components/BranchSwitcher.tsx`
- Create: `src/features/branches/components/BranchUrlFilter.tsx`
- Modify: `src/features/branches/lib/memberships.ts`
- Modify: `src/lib/actions/shared/index.ts`
- Test: `src/lib/branches/__tests__/resolve-branch.test.ts`, `src/lib/branches/__tests__/clock-in-branch.test.ts`

**Interfaces:**
- Consumes: `BranchScope`, `resolveBranchScope`, `isInBranchScope` (Plan 1 Task 2); `listProfileIdsInBranches`, `loadBranchOptions`, `loadBranchIdsByProfile` (Plan 1 Task 3).
- Produces:
  - `getBranchScopeAction(): Promise<{ success: true; data: { scope: BranchScope; memberBranchIds: string[] } } | { error: string }>`
  - `assertBranchWritable(branchId: string): Promise<{ error: string | null }>`
  - `scopedProfileIds(db, scope): Promise<string[] | null>` (null means no restriction)
  - `loadMemberBranchOptions(db, profileId): Promise<BranchOption[]>` (active branches the user belongs to, ordered)
  - `resolveRequestedBranch({ requested, scope, branches }): string | null`
  - `pickClockInBranch(memberBranchIds, requested): { ok: true; branchId: string | null } | { ok: false }`
  - `BranchProvider`, `useCurrentBranch(): { branchId: string; branches: BranchOption[]; canSwitch: boolean }`
  - `BranchSwitcher` (no props), `BranchUrlFilter({ branches, paramName? })`

- [ ] **Step 1: Failing tests**

`src/lib/branches/__tests__/resolve-branch.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { resolveRequestedBranch } from "../resolve-branch";

const branches = [
  { id: "h", nameHe: "חיפה" },
  { id: "k", nameHe: "קריית אתא" },
];

describe("resolveRequestedBranch", () => {
  it("honours a valid request inside an all scope", () => {
    expect(
      resolveRequestedBranch({ requested: "k", scope: { kind: "all" }, branches }),
    ).toBe("k");
  });

  it("falls back to the first branch when the request is unknown", () => {
    expect(
      resolveRequestedBranch({ requested: "zzz", scope: { kind: "all" }, branches }),
    ).toBe("h");
    expect(
      resolveRequestedBranch({ requested: undefined, scope: { kind: "all" }, branches }),
    ).toBe("h");
  });

  it("ignores a request outside the caller's scope", () => {
    const scope = { kind: "branches" as const, ids: ["k"] };
    expect(resolveRequestedBranch({ requested: "h", scope, branches })).toBe("k");
  });

  it("defaults to the caller's first branch in display order", () => {
    const scope = { kind: "branches" as const, ids: ["k", "h"] };
    expect(resolveRequestedBranch({ requested: null, scope, branches })).toBe("h");
  });

  it("returns null when no branch is allowed", () => {
    expect(resolveRequestedBranch({ requested: "h", scope: { kind: "all" }, branches: [] })).toBeNull();
    const scope = { kind: "branches" as const, ids: ["gone"] };
    expect(resolveRequestedBranch({ requested: null, scope, branches })).toBeNull();
  });
});
```

`src/lib/branches/__tests__/clock-in-branch.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { pickClockInBranch } from "../clock-in-branch";

describe("pickClockInBranch", () => {
  it("uses the only branch when the trainer has one", () => {
    expect(pickClockInBranch(["h"], null)).toEqual({ ok: true, branchId: "h" });
    expect(pickClockInBranch(["h"], undefined)).toEqual({ ok: true, branchId: "h" });
  });

  it("uses the requested branch when the trainer belongs to it", () => {
    expect(pickClockInBranch(["h", "k"], "k")).toEqual({ ok: true, branchId: "k" });
  });

  it("rejects a requested branch the trainer does not belong to", () => {
    expect(pickClockInBranch(["h"], "k")).toEqual({ ok: false });
  });

  it("records no branch when a dual-branch trainer did not choose", () => {
    expect(pickClockInBranch(["h", "k"], null)).toEqual({ ok: true, branchId: null });
  });

  it("records no branch for an unassigned trainer", () => {
    expect(pickClockInBranch([], null)).toEqual({ ok: true, branchId: null });
    expect(pickClockInBranch([], "h")).toEqual({ ok: false });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm run test:run -- src/lib/branches/__tests__/resolve-branch.test.ts src/lib/branches/__tests__/clock-in-branch.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Pure resolvers**

`src/lib/branches/resolve-branch.ts`:

```ts
import type { BranchScope } from "@/lib/branches/branch-scope";
import type { BranchOption } from "@/types/branches";

interface ResolveInput {
  /** The ?branch= value, if any. */
  requested: string | null | undefined;
  scope: BranchScope;
  /** Active branches in display order. */
  branches: readonly BranchOption[];
}

/**
 * Which branch a schedule page should show.
 *
 * A valid, in-scope request wins. Anything else falls back silently to the
 * first branch the caller may see, in display order, the way a bad ?date=
 * falls back to today. Null means there is nothing to show at all.
 */
export function resolveRequestedBranch({
  requested,
  scope,
  branches,
}: ResolveInput): string | null {
  const allowed =
    scope.kind === "all"
      ? branches
      : branches.filter((branch) => scope.ids.includes(branch.id));

  if (allowed.length === 0) return null;
  if (requested && allowed.some((branch) => branch.id === requested)) return requested;
  return allowed[0].id;
}

/** The branches a caller may switch between, in display order. */
export function allowedBranches(
  scope: BranchScope,
  branches: readonly BranchOption[],
): BranchOption[] {
  return scope.kind === "all"
    ? [...branches]
    : branches.filter((branch) => scope.ids.includes(branch.id));
}
```

`src/lib/branches/clock-in-branch.ts`:

```ts
export type ClockInBranchPick =
  | { ok: true; branchId: string | null }
  | { ok: false };

/**
 * The branch a clock-in is recorded under.
 *
 * One branch: use it, no question asked. A request the trainer is not a
 * member of is refused. A dual-branch trainer who did not choose, or an
 * unassigned trainer, clocks in with no branch: the queue replays offline
 * clock-ins later and losing one over a missing branch is the worse outcome.
 */
export function pickClockInBranch(
  memberBranchIds: readonly string[],
  requested: string | null | undefined,
): ClockInBranchPick {
  if (requested) {
    return memberBranchIds.includes(requested)
      ? { ok: true, branchId: requested }
      : { ok: false };
  }
  if (memberBranchIds.length === 1) return { ok: true, branchId: memberBranchIds[0] };
  return { ok: true, branchId: null };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:run -- src/lib/branches`
Expected: PASS.

- [ ] **Step 5: Membership additions**

Append to `src/features/branches/lib/memberships.ts`:

```ts
import type { BranchScope } from "@/lib/branches/branch-scope";

/**
 * The profile ids a scope may see, or null for no restriction.
 * An empty array is a real answer: the scope's branches have no members.
 */
export async function scopedProfileIds(
  db: SupabaseClient,
  scope: BranchScope,
): Promise<string[] | null> {
  if (scope.kind === "all") return null;
  return listProfileIdsInBranches(db, scope.ids);
}

/** Active branches one user belongs to, in display order. */
export async function loadMemberBranchOptions(
  db: SupabaseClient,
  profileId: string,
): Promise<BranchOption[]> {
  const [options, memberships] = await Promise.all([
    loadBranchOptions(db),
    loadBranchIdsByProfile(db, [profileId]),
  ]);
  const ids = memberships.get(profileId) ?? [];
  return options.filter((option) => ids.includes(option.id));
}
```

Move the `import type { BranchScope }` line up with the other imports.

- [ ] **Step 6: Scope action and write-side assertion**

`src/lib/actions/shared/branch-scope.ts`:

```ts
"use server";

import { cache } from "react";
import { verifyAdminOrTrainer } from "@/lib/actions/shared/verify-admin";
import { ALL_BRANCHES_SCOPE, resolveBranchScope, type BranchScope } from "@/lib/branches/branch-scope";
import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";

export interface BranchScopeData {
  scope: BranchScope;
  /** The caller's own memberships, whatever their role. */
  memberBranchIds: string[];
}

type BranchScopeResult = { success: true; data: BranchScopeData } | { error: string };

/**
 * The caller's branch scope, memoized per request.
 *
 * Reads the caller's own profile_branches rows through the user client, which
 * RLS allows. Admins skip the read entirely: their scope is "all" and the
 * membership list only matters for the schedule switcher's default.
 */
export const getBranchScopeAction = cache(async (): Promise<BranchScopeResult> => {
  const { error, user, profile } = await verifyAdminOrTrainer();
  if (error) return { error };

  const supabase = await createClient();
  const { data, error: readError } = (await typedFrom(supabase, "profile_branches")
    .select("branch_id")
    .eq("profile_id", user!.id)) as {
    data: { branch_id: string }[] | null;
    error: { message: string } | null;
  };

  if (readError) {
    console.error("getBranchScopeAction read error:", readError);
    return { error: "שגיאה בטעינת הסניפים" };
  }

  const memberBranchIds = (data ?? []).map((row) => row.branch_id);
  const scope =
    profile!.role === "admin"
      ? ALL_BRANCHES_SCOPE
      : resolveBranchScope(profile!.role, memberBranchIds);

  return { success: true, data: { scope, memberBranchIds } };
});
```

`src/lib/actions/shared/assert-branch.ts` (plain module, no `"use server"`):

```ts
import { getBranchScopeAction } from "@/lib/actions/shared/branch-scope";
import { isInBranchScope } from "@/lib/branches/branch-scope";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";

/**
 * A mutation may write to a branch only when it is active and, for trainers,
 * one of theirs. Callers are already gated by a verify call.
 */
export async function assertBranchWritable(
  branchId: string,
): Promise<{ error: string | null }> {
  const scopeResult = await getBranchScopeAction();
  if ("error" in scopeResult) return { error: scopeResult.error };

  if (!isInBranchScope(scopeResult.data.scope, [branchId])) {
    return { error: "הסניף אינו בסניפים שלך" };
  }

  const { data, error } = (await typedFrom(createAdminClient(), "branches")
    .select("id")
    .eq("id", branchId)
    .eq("is_active", true)
    .maybeSingle()) as { data: { id: string } | null; error: { message: string } | null };

  if (error) {
    console.error("assertBranchWritable error:", error);
    return { error: "שגיאה באימות הסניף" };
  }
  if (!data) return { error: "הסניף לא נמצא או אינו פעיל" };
  return { error: null };
}
```

In `src/lib/actions/shared/index.ts`, add:

```ts
export { getBranchScopeAction } from "./branch-scope";
export type { BranchScopeData } from "./branch-scope";
```

- [ ] **Step 7: Context, switcher, URL filter**

`src/features/branches/components/BranchContext.tsx`:

```tsx
"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { BranchOption } from "@/types/branches";

export interface BranchContextValue {
  /** The branch every dialog on this page writes to. */
  branchId: string;
  /** Branches the caller may switch between, in display order. */
  branches: BranchOption[];
  canSwitch: boolean;
}

const BranchContext = createContext<BranchContextValue | null>(null);

export function BranchProvider({
  value,
  children,
}: {
  value: BranchContextValue;
  children: ReactNode;
}) {
  return <BranchContext.Provider value={value}>{children}</BranchContext.Provider>;
}

/**
 * The page's current branch. Throws outside a provider so a dialog mounted
 * on a page that forgot the provider fails loudly instead of writing to
 * nothing.
 */
export function useCurrentBranch(): BranchContextValue {
  const value = useContext(BranchContext);
  if (!value) throw new Error("useCurrentBranch must be used inside BranchProvider");
  return value;
}

export function branchNameFor(branches: readonly BranchOption[], branchId: string): string {
  return branches.find((b) => b.id === branchId)?.nameHe ?? "";
}
```

`src/features/branches/components/BranchSwitcher.tsx`:

```tsx
"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { branchNameFor, useCurrentBranch } from "./BranchContext";

/**
 * Switches the page's branch through ?branch=. A single-branch trainer sees
 * a label, not a control: there is nothing for them to switch to.
 */
export function BranchSwitcher() {
  const { branchId, branches, canSwitch } = useCurrentBranch();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  if (!canSwitch) {
    return (
      <Badge variant="secondary" className="gap-1">
        <MapPin className="h-3 w-3" />
        {branchNameFor(branches, branchId)}
      </Badge>
    );
  }

  const handleChange = (next: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("branch", next);
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex items-center gap-2">
      <MapPin className="h-4 w-4 text-muted-foreground" />
      <Select value={branchId} onValueChange={handleChange}>
        <SelectTrigger className="w-40" aria-label="סניף">
          <SelectValue placeholder="סניף" />
        </SelectTrigger>
        <SelectContent>
          {branches.map((branch) => (
            <SelectItem key={branch.id} value={branch.id}>
              {branch.nameHe}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
```

`src/features/branches/components/BranchUrlFilter.tsx` (admin lists that render server-side from `searchParams`):

```tsx
"use client";

import { useQueryState, parseAsString } from "nuqs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BRANCH_FILTER_ALL } from "@/lib/admin/branch-filter";
import type { BranchOption } from "@/types/branches";

interface BranchUrlFilterProps {
  branches: BranchOption[];
  className?: string;
}

/** "All branches" plus one entry per active branch, persisted as ?branch=. */
export function BranchUrlFilter({ branches, className = "w-full md:w-40" }: BranchUrlFilterProps) {
  const [branch, setBranch] = useQueryState(
    "branch",
    parseAsString.withDefault(BRANCH_FILTER_ALL).withOptions({ shallow: false }),
  );

  return (
    <Select
      value={branch}
      onValueChange={(v) => setBranch(v === BRANCH_FILTER_ALL ? null : v)}
    >
      <SelectTrigger className={className} aria-label="סניף">
        <SelectValue placeholder="סניף" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={BRANCH_FILTER_ALL}>כל הסניפים</SelectItem>
        {branches.map((b) => (
          <SelectItem key={b.id} value={b.id}>
            {b.nameHe}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

`shallow: false` makes nuqs trigger a server re-render, which is what a server-rendered list needs.

- [ ] **Step 8: Type-check, lint, commit**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

```bash
git add src/lib/actions/shared src/lib/branches src/features/branches
git commit -m "feat(branches): scope action, branch resolvers, context and switcher

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 11: Trainer scoping and admin branch filter on the lists

**Files:**
- Modify: `src/app/admin/users/page.tsx`
- Modify: `src/lib/actions/admin-assessments-list.ts`, `src/lib/actions/admin-assessments-month.ts`
- Modify: `src/components/admin/assessments/AssessmentsTable.tsx`, `AssessmentsMonthView.tsx`, `AssessmentsContent.tsx`, `src/app/admin/assessments/page.tsx`
- Modify: `src/lib/actions/admin-submissions-list.ts`, `src/app/admin/submissions/page.tsx`, `src/components/admin/submissions/SubmissionsContent.tsx`
- Modify: `src/lib/actions/schedule-options.ts`

**Interfaces:**
- Consumes: `getBranchScopeAction`, `scopedProfileIds`, `listProfileIdsInBranches`, `listActiveBranchOptionsAction`, `BranchUrlFilter`, `buildBranchFilterOptions`, `BRANCH_FILTER_ALL`.
- Produces: `AssessmentQueryParams.branchId?: string`, `AssessmentMonthParams.branchId?: string`, `SubmissionQueryParams.branchId?: string`; `getSlotFormOptionsAction(branchId: string)`.

The rule for every list: compute `scope`, then `ids = await scopedProfileIds(admin, scope)`. When an admin picked a branch filter, intersect: `ids = ids === null ? branchMembers : ids.filter(id => branchMembers.includes(id))`. Then `.in("id", ids)` (profiles) or `.in("user_id", ids)` (forms) whenever `ids !== null`.

- [ ] **Step 1: Shared narrowing helper**

Append to `src/features/branches/lib/memberships.ts`:

```ts
/**
 * The profile ids a list may show: the caller's scope, intersected with an
 * optional admin-picked branch. Null means no restriction at all.
 */
export async function visibleProfileIds(
  db: SupabaseClient,
  scope: BranchScope,
  filterBranchId: string | undefined,
): Promise<string[] | null> {
  const scoped = await scopedProfileIds(db, scope);
  if (!filterBranchId) return scoped;

  const members = await listProfileIdsInBranches(db, [filterBranchId]);
  if (scoped === null) return members;
  return scoped.filter((id) => members.includes(id));
}
```

- [ ] **Step 2: Users page**

In `src/app/admin/users/page.tsx`, add imports:

```ts
import { getBranchScopeAction } from "@/lib/actions/shared";
import { scopedProfileIds } from "@/features/branches/lib/memberships";
```

Replace the query block (`let query = supabase.from("profiles").select("*"); ... const { data: users, error } = await query.order(...)`) with:

```ts
  // Trainers see trainees in their branches. Admins see everyone; the branch
  // filter on the table narrows client-side like the other filters.
  const scopeResult = await getBranchScopeAction();
  const scope = "success" in scopeResult ? scopeResult.data.scope : { kind: "all" as const };
  const scopedIds = isAdmin ? null : await scopedProfileIds(createAdminClient(), scope);

  let query = supabase.from("profiles").select("*");
  if (!isAdmin) {
    query = query.eq("role", "trainee");
  }
  if (scopedIds !== null) {
    query = query.in("id", scopedIds);
  }
  const { data: users, error } = await query.order("created_at", {
    ascending: false,
  });
```

`createAdminClient` is already imported from Plan 1 Task 6. Move the `const adminClient = createAdminClient();` line above this block and reuse it.

- [ ] **Step 3: Assessments list action**

In `src/lib/actions/admin-assessments-list.ts`:

Add imports:

```ts
import { getBranchScopeAction } from "@/lib/actions/shared/branch-scope";
import { createAdminClient } from "@/lib/supabase/admin";
import { visibleProfileIds } from "@/features/branches/lib/memberships";
```

Add `branchId?: string;` to `AssessmentQueryParams`.

After `const { error } = await verifyAdminOrTrainer(); if (error) return empty;`, add:

```ts
  const scopeResult = await getBranchScopeAction();
  if ("error" in scopeResult) return empty;
  const visibleIds = await visibleProfileIds(
    createAdminClient(),
    scopeResult.data.scope,
    params.branchId,
  );
  if (visibleIds !== null && visibleIds.length === 0) return empty;
```

Then, on both `profileQuery` and `ageGroupQuery`, immediately after the `applyPositionFilter(...)` line, add:

```ts
  if (visibleIds !== null) {
    profileQuery = profileQuery.in("id", visibleIds);
  }
```

(and the same with `ageGroupQuery`).

The two counts (`totalAssessmentsCount`, `traineesWithAssessmentsData`) stay academy-wide for admins but must not leak for trainers. Wrap both with the same narrowing: change the two `player_assessments` reads in the `Promise.all` to build on a base and add `.in("user_id", visibleIds)` when `visibleIds !== null`:

```ts
  const totalQuery = supabase
    .from("player_assessments")
    .select("*", { count: "exact", head: true })
    .is("deleted_at", null);
  const usersQuery = supabase
    .from("player_assessments")
    .select("user_id")
    .is("deleted_at", null);

  const [testMatchedIds, totalAssessmentsCount, traineesWithAssessmentsData] =
    await Promise.all([
      params.test ? getUserIdsWithSection(supabase, params.test) : Promise.resolve(null),
      visibleIds === null ? totalQuery : totalQuery.in("user_id", visibleIds),
      visibleIds === null ? usersQuery : usersQuery.in("user_id", visibleIds),
    ]);
```

- [ ] **Step 4: Assessments month action**

In `src/lib/actions/admin-assessments-month.ts`, add the same three imports, add `branchId?: string;` to `AssessmentMonthParams`, and after the verify check add:

```ts
  const scopeResult = await getBranchScopeAction();
  if ("error" in scopeResult) return empty;
  const visibleIds = await visibleProfileIds(
    createAdminClient(),
    scopeResult.data.scope,
    params.branchId,
  );
  if (visibleIds !== null && visibleIds.length === 0) return empty;
```

After the `if (params.search) { ... }` block on `profileQuery`, add:

```ts
    if (visibleIds !== null) {
      profileQuery = profileQuery.in("id", visibleIds);
    }
```

- [ ] **Step 5: Assessments UI branch select**

In `src/app/admin/assessments/page.tsx`, add:

```ts
import { listActiveBranchOptionsAction } from "@/features/branches/lib/actions/list-branches";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
```

Inside the component, before `initialData`:

```ts
  const { profile } = await verifyAdminOrTrainer();
  const isAdmin = profile?.role === "admin";
  const branches = isAdmin ? await listActiveBranchOptionsAction() : [];
  const branchParam = typeof params.branch === "string" ? params.branch : undefined;
```

Pass `branchId: branchParam` into `getAssessmentsPaginated({ page: 0, pageSize: PAGE_SIZE, branchId: branchParam })` and render `<AssessmentsContent initialData={initialData} branches={branches} />`.

In `AssessmentsContent.tsx`, add `branches: BranchOption[]` to the props (import the type from `@/types/branches`) and pass `branches={branches}` to both `<AssessmentsMonthView ... />` and `<AssessmentsTable ... />`.

In `AssessmentsTable.tsx`:

Add imports:

```ts
import { BRANCH_FILTER_ALL, buildBranchFilterOptions } from "@/lib/admin/branch-filter";
import type { BranchOption } from "@/types/branches";
```

Add `branches: BranchOption[];` to `AssessmentsTableProps` and `branch: string;` to `FilterValues`. Destructure `branches`. Add the URL state after `test`:

```ts
  const [branch, setBranch] = useQueryState(
    "branch",
    parseAsString.withDefault(BRANCH_FILTER_ALL),
  );
```

Add `branch` to `currentFilters`. In `fetchData`, add to the params object:

```ts
        branchId: filters.branch !== BRANCH_FILTER_ALL ? filters.branch : undefined,
```

Add the handler after `handleTestChange`:

```ts
  const handleBranchChange = (value: string) => {
    setBranch(value === BRANCH_FILTER_ALL ? null : value);
    setPage(0);
    fetchData({ ...currentFilters, page: 0, branch: value });
  };
```

Render, after the test `ToolbarSelect`, only when there are branches to pick (trainers get an empty list and no control):

```tsx
            {branches.length > 0 && (
              <ToolbarSelect
                value={branch || BRANCH_FILTER_ALL}
                onValueChange={handleBranchChange}
                options={buildBranchFilterOptions(branches).filter(
                  (o) => o.value !== "none",
                )}
                placeholder="סניף"
              />
            )}
```

The "ללא סניף" option is dropped here on purpose: an assessment list of unassigned trainees is not a question anyone asks.

In `AssessmentsMonthView.tsx`: add the same two imports, add `branches: BranchOption[];` to `AssessmentsMonthViewProps`, destructure it, add the URL state after `astatus`:

```ts
  const [branch, setBranch] = useQueryState(
    "branch",
    parseAsString.withDefault(BRANCH_FILTER_ALL),
  );
```

Add `branchId: branch !== BRANCH_FILTER_ALL ? branch : undefined,` to the `getAssessmentsByMonth` call and `branch` to the `useCallback` dependency array. Add the handler:

```ts
  const handleBranchChange = (v: string) => {
    void setBranch(v === BRANCH_FILTER_ALL ? null : v);
    setPage(0);
  };
```

Change the `filters` prop of the toolbar from a single element to a fragment holding the age select plus:

```tsx
                {branches.length > 0 && (
                  <ToolbarSelect
                    value={branch || BRANCH_FILTER_ALL}
                    onValueChange={handleBranchChange}
                    options={buildBranchFilterOptions(branches).filter(
                      (o) => o.value !== "none",
                    )}
                    placeholder="סניף"
                  />
                )}
```

- [ ] **Step 6: Submissions**

In `src/lib/actions/admin-submissions-list.ts`:

Add imports:

```ts
import { getBranchScopeAction } from "@/lib/actions/shared/branch-scope";
import { visibleProfileIds } from "@/features/branches/lib/memberships";
```

Add `branchId?: string;` to `SubmissionQueryParams`. Add one helper above the first exported function:

```ts
/** User ids the caller may see for these params, or null for no restriction. */
async function visibleUserIdsFor(
  supabase: ReturnType<typeof createAdminClient>,
  branchId: string | undefined,
): Promise<{ ids: string[] | null } | { blocked: true }> {
  const scopeResult = await getBranchScopeAction();
  if ("error" in scopeResult) return { blocked: true };
  const ids = await visibleProfileIds(supabase, scopeResult.data.scope, branchId);
  if (ids !== null && ids.length === 0) return { blocked: true };
  return { ids };
}
```

In each of `getPreWorkoutPaginated`, `getPostWorkoutPaginated`, `getNutritionPaginated`, `getMentalPaginated`, right after `const from = params.page * params.pageSize;`, add:

```ts
  const visible = await visibleUserIdsFor(supabase, params.branchId);
  if ("blocked" in visible) return { items: [], total: 0 };
```

and right after the `applyPositionFilter(...)` line in each:

```ts
  if (visible.ids !== null) {
    query = query.in("user_id", visible.ids);
  }
```

In `src/app/admin/submissions/page.tsx`:

Add imports:

```ts
import { getBranchScopeAction } from "@/lib/actions/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { visibleProfileIds } from "@/features/branches/lib/memberships";
import { listActiveBranchOptionsAction } from "@/features/branches/lib/actions/list-branches";
import { BranchUrlFilter } from "@/features/branches/components/BranchUrlFilter";
```

Change `searchParams` to `Promise<{ tab?: string; branch?: string }>` and destructure `branch`. Before the `Promise.all`, add:

```ts
  const scopeResult = await getBranchScopeAction();
  const scope = "success" in scopeResult ? scopeResult.data.scope : { kind: "all" as const };
  // An unassigned trainer also resolves to "all" and gets the filter: that is
  // the fail-open rule, applied consistently.
  const showBranchFilter = scope.kind === "all";
  const visibleIds = await visibleProfileIds(createAdminClient(), scope, branch);
  const branches = showBranchFilter ? await listActiveBranchOptionsAction() : [];
  const narrow = <T,>(q: T): T =>
    visibleIds === null ? q : (q as { in: (c: string, v: string[]) => T }).in("user_id", visibleIds);
```

Wrap the first four queries (pre, post, nutrition, mental) with `narrow(...)`, applied before `.order(...)`. Example for the first:

```ts
    narrow(
      supabase
        .from("pre_workout_forms")
        .select("*", { count: "exact" }),
    )
      .order("submitted_at", { ascending: false })
      .range(0, PAGE_SIZE - 1) as unknown as { data: PreWorkoutForm[] | null; count: number | null },
```

Shift reports stay unscoped: they are written by trainers, not trainees.

In the JSX, after the `<p className="text-muted-foreground">` paragraph inside the header `div`, render the filter for admins:

```tsx
        {showBranchFilter && (
          <div className="mt-4">
            <BranchUrlFilter branches={branches} />
          </div>
        )}
```

Pass `branchId={branch}` to each of `PreWorkoutContent`, `PostWorkoutContent`, `NutritionContent`, `MentalContent`.

In `SubmissionsContent.tsx`, for each of the four components: add `branchId?: string;` to the props type and destructure it, and in each component's `fetchData` params object add:

```ts
          branchId,
```

and add `branchId` to that `useCallback`'s dependency array (`[branchId]`).

- [ ] **Step 7: Schedule pick lists per branch**

Replace the body of `src/lib/actions/schedule-options.ts` so the action takes a branch:

```ts
"use server";

import { cache } from "react";

import type { TrainerOption } from "@/lib/actions/admin-trainers-list";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { isValidUUID } from "@/lib/validations/common";
import { createAdminClient } from "@/lib/supabase/admin";
import { listProfileIdsInBranches } from "@/features/branches/lib/memberships";

interface SlotFormOptions {
  trainers: TrainerOption[];
  trainees: TrainerOption[];
}

type OptionsResult =
  | { success: true; data: SlotFormOptions }
  | { error: string };

/**
 * The two pick-lists the slot form needs, limited to one branch: who can take
 * a slot there, and who can be on its roster.
 *
 * Admin client on purpose. The profiles SELECT policies let a trainer read
 * only their own row and active trainer rows, and profile_branches lets them
 * read only their own memberships, so under a trainer session the user client
 * would return an empty trainee list. Safe because verifyAdminOrTrainer()
 * gates above and the projection is (id, full_name).
 */
export const getSlotFormOptionsAction = cache(
  async (branchId: string): Promise<OptionsResult> => {
    const { error: authError } = await verifyAdminOrTrainer();
    if (authError) return { error: authError };
    if (!isValidUUID(branchId)) return { error: "מזהה סניף לא תקין" };

    const supabase = createAdminClient();
    const memberIds = await listProfileIdsInBranches(supabase, [branchId]);
    if (memberIds.length === 0) {
      return { success: true, data: { trainers: [], trainees: [] } };
    }

    const [trainersResult, traineesResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", memberIds)
        .in("role", ["trainer", "admin"])
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("full_name", { ascending: true }),
      supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", memberIds)
        .eq("role", "trainee")
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("full_name", { ascending: true }),
    ]);

    if (trainersResult.error || traineesResult.error) {
      console.error(
        "Get slot form options error:",
        trainersResult.error ?? traineesResult.error,
      );
      return { error: "שגיאה בטעינת רשימות המאמנים והמתאמנים" };
    }

    return {
      success: true,
      data: {
        trainers: (trainersResult.data as TrainerOption[]) ?? [],
        trainees: (traineesResult.data as TrainerOption[]) ?? [],
      },
    };
  },
);
```

The two callers (`src/app/admin/schedule/page.tsx`, `src/app/admin/weekly-schedule/page.tsx`) will fail type-check until Task 14 passes a branch. To keep this task green, temporarily pass a placeholder in both pages:

```ts
      getSlotFormOptionsAction(""),
```

Task 14 replaces it. Do not commit Task 14 with the placeholder still present.

- [ ] **Step 8: Type-check, lint, verify, commit**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

Dev server, as a trainer in קריית אתא only (use the branches page and the users table to set that up): `/admin/users` shows only the קריית אתא trainees; `/admin/assessments` shows the same set with no branch select; `/admin/submissions` shows only their forms. As admin, the branch select on assessments and submissions narrows the lists and the URL carries `?branch=`.

```bash
git add src/app/admin/users/page.tsx src/lib/actions/admin-assessments-list.ts src/lib/actions/admin-assessments-month.ts src/components/admin/assessments src/app/admin/assessments/page.tsx src/lib/actions/admin-submissions-list.ts src/app/admin/submissions/page.tsx src/components/admin/submissions/SubmissionsContent.tsx src/lib/actions/schedule-options.ts src/features/branches/lib/memberships.ts src/app/admin/schedule/page.tsx src/app/admin/weekly-schedule/page.tsx
git commit -m "feat(branches): trainers see only their branch; admins filter lists by branch

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 12: Write-side scope checks

**Files:**
- Modify: `src/lib/actions/admin-users-update.ts`
- Modify: `src/features/player-assessments/lib/actions/record-assessment.ts`

**Interfaces:**
- Consumes: `getBranchScopeAction`, `isInBranchScope`, `loadBranchIdsByProfile`.

Delete-user and delete-assessment are admin-only already, so they need no check.

- [ ] **Step 1: Shared trainee check**

Append to `src/features/branches/lib/memberships.ts`:

```ts
import { isInBranchScope } from "@/lib/branches/branch-scope";

export const OUT_OF_SCOPE_TRAINEE_ERROR = "המתאמן אינו בסניף שלך";

/** True when the caller's scope covers this trainee. */
export async function isTraineeInScope(
  db: SupabaseClient,
  scope: BranchScope,
  traineeId: string,
): Promise<boolean> {
  if (scope.kind === "all") return true;
  const memberships = await loadBranchIdsByProfile(db, [traineeId]);
  return isInBranchScope(scope, memberships.get(traineeId) ?? []);
}
```

Move the import up with the others.

- [ ] **Step 2: User update**

In `src/lib/actions/admin-users-update.ts`, add imports:

```ts
import { getBranchScopeAction } from "@/lib/actions/shared";
import { isTraineeInScope, OUT_OF_SCOPE_TRAINEE_ERROR } from "@/features/branches/lib/memberships";
```

Inside the `if (callerProfile?.role === "trainer") { ... }` block (step 5), after the existing two checks, add:

```ts
      const scopeResult = await getBranchScopeAction();
      if ("error" in scopeResult) return { error: scopeResult.error };
      if (!(await isTraineeInScope(adminClient, scopeResult.data.scope, userId))) {
        return { error: OUT_OF_SCOPE_TRAINEE_ERROR };
      }
```

- [ ] **Step 3: Assessment writes**

In `src/features/player-assessments/lib/actions/record-assessment.ts`, add imports:

```ts
import { getBranchScopeAction } from "@/lib/actions/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { isTraineeInScope, OUT_OF_SCOPE_TRAINEE_ERROR } from "@/features/branches/lib/memberships";
```

Add a helper above `recordAssessment`:

```ts
/** Trainers may write assessments only for trainees in their branches. */
async function assertTraineeInScope(traineeId: string): Promise<string | null> {
  const scopeResult = await getBranchScopeAction();
  if ("error" in scopeResult) return scopeResult.error;
  const inScope = await isTraineeInScope(createAdminClient(), scopeResult.data.scope, traineeId);
  return inScope ? null : OUT_OF_SCOPE_TRAINEE_ERROR;
}
```

In `recordAssessment`, after the auth check:

```ts
  const scopeError = await assertTraineeInScope(input.user_id);
  if (scopeError) return { success: false, error: scopeError };
```

In `updateAssessment`, after the auth check, look the row up first so the check uses the stored owner, not the patch:

```ts
  const supabase = await createClient();
  const { data: existing } = (await typedFrom(supabase, "player_assessments")
    .select("user_id")
    .eq("id", assessmentId)
    .maybeSingle()) as { data: { user_id: string } | null };
  if (!existing) return { success: false, error: "מבדק לא נמצא" };

  const scopeError = await assertTraineeInScope(existing.user_id);
  if (scopeError) return { success: false, error: scopeError };
```

and remove the later duplicate `const supabase = await createClient();` in that function.

- [ ] **Step 4: Type-check, lint, verify, commit**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

As a קריית אתא trainer, open `/admin/users/<id of a חיפה-only trainee>` by URL and save the form. Expected: toast `המתאמן אינו בסניף שלך`.

```bash
git add src/features/branches/lib/memberships.ts src/lib/actions/admin-users-update.ts src/features/player-assessments/lib/actions/record-assessment.ts
git commit -m "feat(branches): trainers cannot write to trainees outside their branch

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 13: Schedule data layer carries the branch

**Files:**
- Modify: `src/types/schedule.ts`, `src/types/weekly-schedule.ts`
- Modify: `src/lib/validations/schedule.ts`, `src/lib/validations/weekly-schedule.ts`
- Modify: `src/lib/actions/daily-schedule-list.ts`, `daily-schedule-mutate.ts`, `daily-schedule-build.ts`, `weekly-schedule-list.ts`, `weekly-schedule-mutate.ts`

**Interfaces:**
- Consumes: `assertBranchWritable`.
- Produces: `ScheduleSlot.branch_id`, `WeeklyBand.branch_id`, `WeeklyException.branch_id` (all `string | null`); every schema gains `branchId`; list actions gain a required `branchId` argument: `getScheduleAction(date, branchId)`, `getSlotsForWeekAction(weekStart, branchId)`, `getBandsAction(branchId)`, `getWeeklyScheduleAction(from, to, branchId)`, `getOnDutyAction(date, branchId)`, `getExceptionsInRangeAction(from, to, branchId)`.

- [ ] **Step 1: Types**

In `src/types/schedule.ts`, add to `ScheduleSlot` after `location_he`:

```ts
  branch_id: string | null;
```

In `src/types/weekly-schedule.ts`, add `branch_id: string | null;` to both `WeeklyBand` (after `location_he`) and `WeeklyException` (after `location_he`).

- [ ] **Step 2: Schemas**

In `src/lib/validations/schedule.ts`, add `branchId: uuidSchema,` as the first field of `slotSchema` and of `duplicateDaySchema`'s object.

In `src/lib/validations/weekly-schedule.ts`, add `branchId: uuidSchema,` as the first field of `bandSchema`, `bandUpdateSchema`, `exceptionSchema`, `buildDaySchema`, and `buildWeekSchema`.

- [ ] **Step 3: List actions filter by branch**

In `src/lib/actions/daily-schedule-list.ts`, add `import { isValidUUID } from "@/lib/validations/common";` (extend the existing import), change both signatures to take `branchId: string`, validate it right after the date check:

```ts
  if (!isValidUUID(branchId)) return { error: "מזהה סניף לא תקין" };
```

and add `.eq("branch_id", branchId)` to both queries right after `.select(SLOT_SELECT_WITH_TRAINEES)`.

In `src/lib/actions/weekly-schedule-list.ts`, do the same for all four functions: add the `branchId: string` parameter (last), validate it with `isValidUUID`, and add `.eq("branch_id", branchId)` after every `.select("*")` on `weekly_schedule_bands` and `weekly_schedule_exceptions`.

- [ ] **Step 4: Mutations validate and write the branch**

In `src/lib/actions/daily-schedule-mutate.ts`:

Add `import { assertBranchWritable } from "@/lib/actions/shared/assert-branch";`.

In `createSlotAction`, destructure `branchId` too, and after the roster check add:

```ts
  const branchCheck = await assertBranchWritable(branchId);
  if (branchCheck.error) return { error: branchCheck.error };
```

Add `branch_id: branchId,` to the insert object. In `updateSlotAction`, do the same (destructure, assert after the roster check, add `branch_id: branchId` to the update object). In `duplicateDayAction`, destructure `branchId`, assert after validation, add `.eq("branch_id", branchId)` to both the target-existing check and the source read, add `branch_id: branchId` to the insert, and add `.eq("branch_id", branchId)` to the `wipeTargetDay` delete.

In `src/lib/actions/daily-schedule-build.ts`:

Add the same import. Change `slotRowsFor(date, onDuty, userId)` to `slotRowsFor(date, onDuty, userId, branchId: string)` and add `branch_id: branchId,` to the returned row. In `buildDayFromWeeklyScheduleAction`, destructure `branchId`, assert, add `.eq("branch_id", branchId)` to the existing-slots check and to both the bands and exceptions reads, and pass `branchId` to `slotRowsFor`. In `buildWeekFromWeeklyScheduleAction`, do the same on the slots, bands, and exceptions reads and in the `flatMap`.

In `src/lib/actions/weekly-schedule-mutate.ts`:

Add the import. In `createBandAction`, `updateBandAction`, and `createExceptionAction`: destructure `branchId`, call `assertBranchWritable(branchId)` right after the trainer name resolves, and add `branch_id: branchId,` to the insert or update object.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: errors only in the two schedule pages and the dialogs and buttons (the callers), which Task 14 fixes. If any other file errors, fix it here.

- [ ] **Step 6: Commit**

```bash
git add src/types/schedule.ts src/types/weekly-schedule.ts src/lib/validations/schedule.ts src/lib/validations/weekly-schedule.ts src/lib/actions/daily-schedule-list.ts src/lib/actions/daily-schedule-mutate.ts src/lib/actions/daily-schedule-build.ts src/lib/actions/weekly-schedule-list.ts src/lib/actions/weekly-schedule-mutate.ts
git commit -m "feat(branches): schedule reads and writes are per branch

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 14: Schedule pages and dialogs use the current branch

**Files:**
- Modify: `src/app/admin/schedule/page.tsx`, `src/app/admin/weekly-schedule/page.tsx`
- Modify: `src/components/admin/schedule/ScheduleDayView.tsx`, `SlotFormDialog.tsx`, `BuildDayButton.tsx`, `DuplicateDayButton.tsx`
- Modify: `src/components/admin/schedule/week/WeeklySchedulePageClient.tsx`, `BandFormDialog.tsx`, `ExceptionFormDialog.tsx`, `BuildWeekButton.tsx`

**Interfaces:**
- Consumes: `getBranchScopeAction`, `listActiveBranchOptionsAction`, `resolveRequestedBranch`, `allowedBranches`, `BranchProvider`, `useCurrentBranch`, `BranchSwitcher`.

- [ ] **Step 1: Daily board page**

In `src/app/admin/schedule/page.tsx`:

Add imports:

```ts
import { Card, CardContent } from "@/components/ui/card";
import { BranchProvider } from "@/features/branches/components/BranchContext";
import { listActiveBranchOptionsAction } from "@/features/branches/lib/actions/list-branches";
import { getBranchScopeAction } from "@/lib/actions/shared";
import { allowedBranches, resolveRequestedBranch } from "@/lib/branches/resolve-branch";
```

Change `searchParams` to `Promise<{ date?: string; branch?: string }>`. After `const date = ...`, add:

```ts
  const [scopeResult, branchOptions] = await Promise.all([
    getBranchScopeAction(),
    listActiveBranchOptionsAction(),
  ]);
  if ("error" in scopeResult) redirect("/dashboard");
  const scope = scopeResult.data.scope;
  const branches = allowedBranches(scope, branchOptions);
  const branchId = resolveRequestedBranch({ requested: params.branch, scope, branches: branchOptions });

  if (!branchId) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          אין סניפים פעילים לתצוגה
        </CardContent>
      </Card>
    );
  }
```

Pass the branch to the reads:

```ts
      getScheduleAction(date, branchId),
      getSessionSummariesAction(date),
      getSlotFormOptionsAction(branchId),
      getOnDutyAction(date, branchId),
```

Wrap the view:

```tsx
  return (
    <BranchProvider value={{ branchId, branches, canSwitch: branches.length > 1 }}>
      <ScheduleDayView
        date={date}
        today={israelToday()}
        slots={slots}
        sessionSummaries={sessionSummaries}
        loadError={loadError}
        isAdmin={isAdmin}
        currentUserId={user!.id}
        trainers={options.trainers}
        trainees={options.trainees}
        onDuty={onDuty}
      />
    </BranchProvider>
  );
```

- [ ] **Step 2: Weekly page**

In `src/app/admin/weekly-schedule/page.tsx`, add the same imports (`Card`, `CardContent`, `BranchProvider`, `listActiveBranchOptionsAction`, `getBranchScopeAction`, `allowedBranches`, `resolveRequestedBranch`), extend `searchParams` with `branch?: string`, add the same scope-and-resolve block after `weekEnd` is computed (returning the same "אין סניפים פעילים לתצוגה" card when `branchId` is null), and pass the branch:

```ts
      getSlotsForWeekAction(weekStart, branchId),
      getWeeklyScheduleAction(panelFromDate, panelToDate, branchId),
      getExceptionsInRangeAction(weekStart, weekEnd, branchId),
      getSlotFormOptionsAction(branchId),
```

Wrap `<WeeklySchedulePageClient ... />` in the same `<BranchProvider>`.

- [ ] **Step 3: Switcher in both headers**

In `ScheduleDayView.tsx`, add `import { BranchSwitcher } from "@/features/branches/components/BranchSwitcher";` and render `<BranchSwitcher />` inside the date-navigation `div`, right after the `{date !== today && (...)}` block.

Also update the two day-navigation links so the branch survives paging. Add `import { useCurrentBranch } from "@/features/branches/components/BranchContext";`, read `const { branchId } = useCurrentBranch();` at the top of the component, and change the three hrefs:

```tsx
<Link href={`/admin/schedule?date=${addDays(date, -1)}&branch=${branchId}`}>
<Link href={`/admin/schedule?date=${addDays(date, 1)}&branch=${branchId}`}>
<Link href={`/admin/schedule?branch=${branchId}`}>חזרה להיום</Link>
```

In `WeeklySchedulePageClient.tsx`, add the `BranchSwitcher` import and render `<BranchSwitcher />` next to the title, inside the first inner `div` after the `<span className="font-display text-xl">לוח שבועי</span>`. Also, in `DatedWeekView.tsx`, find the week-arrow `Link`s (they build `/admin/weekly-schedule?week=...`) and append `&branch=${branchId}`, reading `branchId` from `useCurrentBranch()`. Likewise the `ללוח היומי` link in `WeeklySchedulePageClient.tsx` becomes `/admin/schedule?branch=${branchId}`.

- [ ] **Step 4: Dialogs and buttons send the branch**

In each of these files add `import { useCurrentBranch } from "@/features/branches/components/BranchContext";`, read `const { branchId } = useCurrentBranch();` inside the component, and add `branchId` to the action input:

- `SlotFormDialog.tsx`: add `branchId,` as the first key of `payload`.
- `week/BandFormDialog.tsx`: add `branchId,` as the first key of `payload`.
- `week/ExceptionFormDialog.tsx`: add `branchId,` as the first key of the `createExceptionAction({...})` argument.
- `BuildDayButton.tsx`: `buildDayFromWeeklyScheduleAction({ date: targetDate, branchId })`.
- `week/BuildWeekButton.tsx`: `buildWeekFromWeeklyScheduleAction({ weekStart, branchId })`.
- `DuplicateDayButton.tsx`: `duplicateDayAction({ fromDate, toDate: targetDate, branchId })`.

`WeekDayColumn.tsx` renders `BuildDayButton` inside the provider tree, so it needs no change.

- [ ] **Step 5: Type-check, lint, verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean, and `grep -rn 'getSlotFormOptionsAction("")' src` returns nothing.

Dev server as admin: `/admin/schedule` shows a branch select defaulting to חיפה with the existing slots. Switch to קריית אתא: an empty day. Create a slot there, and confirm the trainee picker offers only קריית אתא trainees. Switch back: the slot is gone from view, and this SQL shows its branch:

```sql
SELECT schedule_date, branch_id FROM daily_schedule_slots ORDER BY created_at DESC LIMIT 1;
```

As a single-branch trainer: the header shows a badge, not a select, and the day arrows keep the branch.

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/schedule/page.tsx src/app/admin/weekly-schedule/page.tsx src/components/admin/schedule
git commit -m "feat(branches): schedule pages switch between branches

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 15: Shifts carry a branch

**Files:**
- Modify: `src/lib/actions/trainer-shifts.ts:27-75,246-320,321-404`
- Modify: `src/app/api/shifts/sync/route.ts`
- Modify: `src/lib/offline/shift-queue.ts`, `src/hooks/use-shift-queue-sync.ts`, `public/sw.js`
- Modify: `src/components/admin/shifts/ShiftStatusCard.tsx`, `ShiftFormDialog.tsx`, `TrainerShiftsView.tsx`
- Modify: `src/app/admin/page.tsx`, `src/app/admin/shifts/page.tsx`

**Interfaces:**
- Consumes: `pickClockInBranch`, `loadMemberBranchOptions`, `loadBranchOptions`, `BranchUrlFilter`.
- Produces: `clockInAction(clientTimestamp?, branchId?)`; `adminCreateShiftAction({ ..., branchId?: string | null })`; `adminEditShiftAction({ ..., branchId?: string | null })`; `QueuedShiftAction.branchId?: string | null`; `enqueueShiftAction(type, clientTimestamp, branchId?)`; `ShiftStatusCard` prop `branchOptions: BranchOption[]`; `ShiftFormDialog` prop `branches: BranchOption[]`; `TrainerShiftsView` prop `branchNames: Record<string, string>`.

- [ ] **Step 1: Server-side clock-in**

In `src/lib/actions/trainer-shifts.ts`, add imports:

```ts
import { pickClockInBranch } from "@/lib/branches/clock-in-branch";
import { typedFrom } from "@/lib/supabase/helpers";
```

(keep the existing `typedFrom` import if one is already there). Add a helper above `clockInAction`:

```ts
/** The caller's own memberships, readable through RLS with the user client. */
async function loadOwnBranchIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<string[]> {
  const { data } = (await typedFrom(supabase, "profile_branches")
    .select("branch_id")
    .eq("profile_id", userId)) as { data: { branch_id: string }[] | null };
  return (data ?? []).map((row) => row.branch_id);
}
```

Change the signature to `clockInAction(clientTimestamp?: string, branchId?: string | null)`. After the existing-shift check and before the timestamp resolve, add:

```ts
  if (branchId && !isValidUUID(branchId)) return { error: "מזהה סניף לא תקין" };
  const pick = pickClockInBranch(await loadOwnBranchIds(supabase, user.id), branchId);
  if (!pick.ok) return { error: "הסניף אינו בסניפים שלך" };
```

Add `branch_id: pick.branchId,` to the insert.

In `adminCreateShiftAction` and `adminEditShiftAction`, add `branchId?: string | null;` to the `data` type. After the id validation at the top of each, add:

```ts
  if (data.branchId && !isValidUUID(data.branchId)) return { error: "מזהה סניף לא תקין" };
```

Add `branch_id: data.branchId ?? null,` to the create insert. In the edit update, add `...(data.branchId !== undefined && { branch_id: data.branchId }),` so an omitted value leaves the column alone.

- [ ] **Step 2: Sync route**

In `src/app/api/shifts/sync/route.ts`, add imports:

```ts
import { pickClockInBranch } from "@/lib/branches/clock-in-branch";
import { isValidUUID } from "@/lib/validations/common";
```

Extend `SyncAction` with `branchId?: string | null;`. After the role check and before the loop, load memberships once:

```ts
  const { data: membershipRows } = (await typedFrom(supabase, "profile_branches")
    .select("branch_id")
    .eq("profile_id", user.id)) as { data: { branch_id: string }[] | null };
  const ownBranchIds = (membershipRows ?? []).map((row) => row.branch_id);
```

In the `clock_in` branch, before the insert:

```ts
      const requestedBranch =
        typeof action.branchId === "string" && isValidUUID(action.branchId)
          ? action.branchId
          : null;
      const pick = pickClockInBranch(ownBranchIds, requestedBranch);
      // A replayed clock-in must never be dropped over its branch: record it
      // without one rather than lose the hours.
      const branchId = pick.ok ? pick.branchId : null;
```

Add `branch_id: branchId,` to the insert.

- [ ] **Step 3: Offline queue**

In `src/lib/offline/shift-queue.ts`, add `branchId?: string | null;` to `QueuedShiftAction`, change `enqueueShiftAction` to `enqueueShiftAction(type, clientTimestamp, branchId: string | null = null)` and set `branchId` on the action object. In `sendBeaconSync`, add `branchId: a.branchId ?? null,` to the mapped payload.

In `src/hooks/use-shift-queue-sync.ts`, change the clock-in call to `clockInAction(action.clientTimestamp, action.branchId ?? null)`.

In `public/sw.js`, in the `fetch("/api/shifts/sync"` body, add `branchId: a.branchId ?? null,` to the mapped action.

- [ ] **Step 4: Clock-in card**

In `src/app/admin/page.tsx`, add imports:

```ts
import { createAdminClient } from "@/lib/supabase/admin";
import { loadMemberBranchOptions } from "@/features/branches/lib/memberships";
```

After the `activeShift` read, add:

```ts
  const branchOptions =
    user && (profile?.role === "trainer" || profile?.role === "admin")
      ? await loadMemberBranchOptions(createAdminClient(), user.id)
      : [];
```

Change the card to `<ShiftStatusCard initialShift={activeShift || null} branchOptions={branchOptions} />`.

In `ShiftStatusCard.tsx`:

Add imports:

```ts
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { BranchOption } from "@/types/branches";
```

Add `branchOptions: BranchOption[];` to the props and destructure it. Add state after `pendingClockOut`:

```ts
  // A dual-branch trainer must say where they are; one branch needs no choice.
  const [branchId, setBranchId] = useState<string | null>(
    branchOptions.length === 1 ? branchOptions[0].id : null,
  );
  const needsBranchChoice = branchOptions.length > 1;
```

In `handleClockIn`, at the very top:

```ts
    if (needsBranchChoice && !branchId) {
      toast.error("יש לבחור סניף לפני תחילת המשמרת");
      return;
    }
```

Change both `enqueueShiftAction("clock_in", clientTimestamp)` calls to `enqueueShiftAction("clock_in", clientTimestamp, branchId)` and the online call to `clockInAction(clientTimestamp, branchId)`. Add `branchId, needsBranchChoice` to the `useCallback` dependency array.

In the JSX, wrap the clock-in `Button` (the non-Saturday, no-active-shift case) so the select sits above it:

```tsx
                <div className="flex flex-col items-stretch gap-2">
                  {needsBranchChoice && (
                    <Select value={branchId ?? ""} onValueChange={setBranchId}>
                      <SelectTrigger className="min-w-[140px]" aria-label="סניף">
                        <SelectValue placeholder="בחר סניף" />
                      </SelectTrigger>
                      <SelectContent>
                        {branchOptions.map((b) => (
                          <SelectItem key={b.id} value={b.id}>
                            {b.nameHe}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Button
                    onClick={handleClockIn}
                    disabled={loading || isSyncing || (needsBranchChoice && !branchId)}
                    size="lg"
                    className="min-w-[140px]"
                  >
                    {loading ? (
                      <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                    ) : (
                      <PlayCircle className="h-4 w-4 ml-2" />
                    )}
                    התחל משמרת
                  </Button>
                </div>
```

- [ ] **Step 5: Admin shift form, badge, and filter**

In `ShiftFormDialog.tsx`: add `import type { BranchOption } from "@/types/branches";`, add `branches: BranchOption[];` to the props, destructure it, add state `const [branchId, setBranchId] = useState<string>(editShift?.branch_id ?? "");`, reset it in `resetForm` (`setBranchId("")`), pass `branchId: branchId || null` to both action calls, and render after the trainer field:

```tsx
          <div className="space-y-2">
            <Label>סניף</Label>
            <Select value={branchId || "none"} onValueChange={(v) => setBranchId(v === "none" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="ללא סניף" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">ללא סניף</SelectItem>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.nameHe}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
```

In `TrainerShiftsView.tsx`: add `branches?: BranchOption[];` and `branchNames: Record<string, string>;` to the props (import the type), destructure them, pass `branches={branches ?? []}` to both `ShiftFormDialog`s, and in both places where the `בוקר` badge is rendered (the mobile expanded list and the desktop table row), add right after it:

```tsx
                              {shift.branch_id && branchNames[shift.branch_id] && (
                                <Badge variant="secondary" className="text-xs">
                                  {branchNames[shift.branch_id]}
                                </Badge>
                              )}
```

In `src/app/admin/shifts/page.tsx`: add imports:

```ts
import { createAdminClient } from "@/lib/supabase/admin";
import { loadAllBranches } from "@/features/branches/lib/memberships";
import { toBranchOption } from "@/types/branches";
import { BranchUrlFilter } from "@/features/branches/components/BranchUrlFilter";
import { isValidUUID } from "@/lib/validations/common";
```

Extend `searchParams` with `branch?: string`, destructure it as `branchParam`. After `shiftsQuery` is built, add for admins only:

```ts
  if (isAdmin && branchParam && isValidUUID(branchParam)) {
    shiftsQuery = shiftsQuery.eq("branch_id", branchParam);
  }
```

Load the branches alongside the other fetches (add to the `Promise.all` array and its destructure):

```ts
    loadAllBranches(createAdminClient()),
```

and compute:

```ts
  const branchNames: Record<string, string> = Object.fromEntries(
    allBranches.map((b) => [b.id, b.name_he]),
  );
  const activeBranchOptions = allBranches.filter((b) => b.is_active).map(toBranchOption);
```

Pass `branches={isAdmin ? activeBranchOptions : undefined}` and `branchNames={branchNames}` to `TrainerShiftsView`. Render the filter for admins above the tabs, after the failed-syncs banner:

```tsx
      {isAdmin && (
        <div className="max-w-xs">
          <BranchUrlFilter branches={activeBranchOptions} />
        </div>
      )}
```

- [ ] **Step 6: Type-check, lint, verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

Dev server as a dual-branch trainer: the dashboard card shows a branch select; clock-in is disabled until a branch is picked; after clock-in, `SELECT branch_id FROM trainer_shifts ORDER BY created_at DESC LIMIT 1` shows it. As a single-branch trainer: no select, and the shift still carries the branch. As admin: create a shift with a branch in the dialog, the row shows the branch badge, and the filter narrows the list.

- [ ] **Step 7: Commit**

```bash
git add src/lib/actions/trainer-shifts.ts src/app/api/shifts/sync/route.ts src/lib/offline/shift-queue.ts src/hooks/use-shift-queue-sync.ts public/sw.js src/components/admin/shifts src/app/admin/page.tsx src/app/admin/shifts/page.tsx
git commit -m "feat(branches): shifts record the branch they were worked in

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 16: Rankings per branch

**Files:**
- Create: `src/features/rankings/components/BranchFilter.tsx`
- Modify: `src/features/rankings/lib/actions/get-rankings.ts`
- Modify: `src/features/rankings/components/RankingsView.tsx`
- Modify: `src/app/dashboard/rankings/page.tsx`

**Interfaces:**
- Consumes: `listProfileIdsInBranches`, `loadBranchOptions`, `loadBranchIdsByProfile`.
- Produces: `getRankingsData(ageGroupId, category, branchId)` where `branchId` is a uuid or `"all"`; `RankingsData.selectedBranch: string`; `RankingsView` props `branchOptions: BranchOption[]`, `showAllBranchesOption: boolean`.

- [ ] **Step 1: Action**

In `src/features/rankings/lib/actions/get-rankings.ts`:

Add imports:

```ts
import { createAdminClient } from "@/lib/supabase/admin";
import { listProfileIdsInBranches } from "@/features/branches/lib/memberships";
import { isValidUUID } from "@/lib/validations/common";
```

Add `selectedBranch: string;` to `RankingsData`. Add the constant `export const ALL_BRANCHES = "all";` after the imports.

Change the signature:

```ts
export async function getRankingsData(
  ageGroupId: string = "all",
  category: RankingCategory = "sprint",
  branchId: string = ALL_BRANCHES,
): Promise<RankingsData> {
```

Replace the profiles read with a branch-aware version:

```ts
  // A branch slices the trainee set before anything is ranked. An unknown
  // branch, or one with no members, falls back to the whole academy so nobody
  // sees an empty page during rollout.
  let memberIds: string[] | null = null;
  if (branchId !== ALL_BRANCHES && isValidUUID(branchId)) {
    const ids = await listProfileIdsInBranches(createAdminClient(), [branchId]);
    memberIds = ids.length > 0 ? ids : null;
  }
  const effectiveBranch = memberIds === null ? ALL_BRANCHES : branchId;

  let profilesQuery = supabase
    .from("profiles")
    .select("id, full_name, birthdate")
    .eq("role", "trainee");
  if (memberIds !== null) {
    profilesQuery = profilesQuery.in("id", memberIds);
  }
  const { data: profiles, error: profilesError } = (await profilesQuery) as {
    data: { id: string; full_name: string | null; birthdate: string | null }[] | null;
    error: Error | null;
  };
```

Change every `createEmptyRankingsData(category, ageGroupId)` call to `createEmptyRankingsData(category, ageGroupId, effectiveBranch)` (the first two, before `effectiveBranch` exists, pass `ALL_BRANCHES`), and add `selectedBranch: effectiveBranch,` to the returned object. Update `createEmptyRankingsData(category, ageGroupId, branchId: string)` to set `selectedBranch: branchId`.

- [ ] **Step 2: Filter component**

`src/features/rankings/components/BranchFilter.tsx`:

```tsx
"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MapPin } from "lucide-react";
import type { BranchOption } from "@/types/branches";
import { ALL_BRANCHES } from "../lib/actions/get-rankings";

interface BranchFilterProps {
  selectedBranch: string;
  options: BranchOption[];
  showAllOption: boolean;
  onBranchChange: (branchId: string) => void;
}

export function BranchFilter({
  selectedBranch,
  options,
  showAllOption,
  onBranchChange,
}: BranchFilterProps) {
  return (
    <div className="flex items-center gap-2">
      <MapPin className="h-4 w-4 text-muted-foreground" />
      <Select value={selectedBranch} onValueChange={onBranchChange}>
        <SelectTrigger className="w-full sm:w-[160px]" aria-label="סניף">
          <SelectValue placeholder="סניף" />
        </SelectTrigger>
        <SelectContent>
          {showAllOption && <SelectItem value={ALL_BRANCHES}>כל הסניפים</SelectItem>}
          {options.map((b) => (
            <SelectItem key={b.id} value={b.id}>
              {b.nameHe}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
```

Importing a constant from a `"use server"` module into a client component is fine only for non-function exports; if the bundler complains, move `ALL_BRANCHES` to `src/features/rankings/lib/config/branches.ts` and import it from there in both files.

- [ ] **Step 3: View**

In `RankingsView.tsx`, add imports:

```ts
import { BranchFilter } from "./BranchFilter";
import type { BranchOption } from "@/types/branches";
```

Add props:

```ts
  /** Branches this viewer may pick. A trainee gets their own branches only. */
  branchOptions: BranchOption[];
  /** Staff may also rank the whole academy. */
  showAllBranchesOption: boolean;
```

Destructure them. Update both existing handlers to carry the branch: `getRankingsData(ageGroupId, data.selectedCategory, data.selectedBranch)` and `getRankingsData(data.selectedAgeGroup, category, data.selectedBranch)`. Add:

```ts
  const handleBranchChange = (branchId: string) => {
    const currentRequestId = ++requestIdRef.current;
    startTransition(async () => {
      const newData = await getRankingsData(data.selectedAgeGroup, data.selectedCategory, branchId);
      if (currentRequestId === requestIdRef.current) {
        setData(newData);
      }
    });
  };
```

In the header's right-hand `div`, before the `{isTrainee ? (...) : (...)}` block, render the branch filter whenever there is a choice to make:

```tsx
          {(branchOptions.length > 1 || showAllBranchesOption) && (
            <BranchFilter
              selectedBranch={data.selectedBranch}
              options={branchOptions}
              showAllOption={showAllBranchesOption}
              onBranchChange={handleBranchChange}
            />
          )}
```

- [ ] **Step 4: Page**

In `src/app/dashboard/rankings/page.tsx`, add imports:

```ts
import { createAdminClient } from "@/lib/supabase/admin";
import { loadBranchIdsByProfile, loadBranchOptions } from "@/features/branches/lib/memberships";
import { ALL_BRANCHES } from "@/features/rankings/lib/actions/get-rankings";
```

After `isTrainee` is known, add:

```ts
  // Own memberships through the service role: the page is behind login and
  // reads only the viewer's rows plus the branch list.
  const adminClient = createAdminClient();
  const [allOptions, membershipMap] = await Promise.all([
    loadBranchOptions(adminClient),
    loadBranchIdsByProfile(adminClient, [user.id]),
  ]);
  const ownBranchIds = membershipMap.get(user.id) ?? [];
  const ownOptions = allOptions.filter((o) => ownBranchIds.includes(o.id));
  const isAdmin = userRole === "admin";

  // Trainee: own branch, or the whole academy when unassigned.
  // Trainer: first own branch. Admin: first branch in display order.
  const branchOptions = isTrainee ? ownOptions : allOptions;
  const initialBranch = isTrainee
    ? (ownOptions[0]?.id ?? ALL_BRANCHES)
    : isAdmin
      ? (allOptions[0]?.id ?? ALL_BRANCHES)
      : (ownOptions[0]?.id ?? allOptions[0]?.id ?? ALL_BRANCHES);
```

Change the data call to `getRankingsData(initialAgeGroup, "sprint", initialBranch)` and pass `branchOptions={branchOptions}` and `showAllBranchesOption={!isTrainee}` to `RankingsView`.

- [ ] **Step 5: Type-check, lint, verify**

Run: `npx tsc --noEmit && npm run lint && npm run test:run -- src/features/rankings`
Expected: clean; existing ranking tests still pass.

Dev server as a trainee in חיפה: the page shows חיפה rankings with no branch control. As a dual-branch trainee: a select with the two branches. As admin: a select with "כל הסניפים" plus both branches, defaulting to חיפה, and the player count changes when switching.

- [ ] **Step 6: Commit**

```bash
git add src/features/rankings src/app/dashboard/rankings/page.tsx
git commit -m "feat(branches): rankings are computed within a branch

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 17: Retention scoped for trainers

**Files:**
- Modify: `src/app/admin/retention/page.tsx`
- Modify: `src/components/admin/retention/RetentionPageClient.tsx`

**Interfaces:**
- Consumes: `getBranchScopeAction`, `scopedProfileIds`, `normalizePhone`.
- Produces: `RetentionPageClient` prop `visiblePhones: readonly string[] | null` (null means no restriction).

Retention rows come from Arbox keyed by phone, not profile id, so scoping maps the caller's visible trainees to phones and filters the entries on the client.

- [ ] **Step 1: Page**

In `src/app/admin/retention/page.tsx`, add imports:

```ts
import { getBranchScopeAction } from "@/lib/actions/shared";
import { scopedProfileIds } from "@/features/branches/lib/memberships";
```

Change the trainee rows read to include the id:

```ts
  const traineeRowsPromise = adminClient
    .from("profiles")
    .select("id, phone, position")
    .eq("role", "trainee")
    .not("phone", "is", null);
```

After `traineeRows` is available, add:

```ts
  const scopeResult = await getBranchScopeAction();
  const scope = "success" in scopeResult ? scopeResult.data.scope : { kind: "all" as const };
  const scopedIds = await scopedProfileIds(adminClient, scope);
  const visiblePhones =
    scopedIds === null
      ? null
      : (traineeRows ?? [])
          .filter((row) => scopedIds.includes(row.id))
          .map((row) => normalizePhone(row.phone))
          .filter((phone): phone is string => phone !== null);
```

Pass `visiblePhones={visiblePhones}` to `RetentionPageClient`.

- [ ] **Step 2: Client**

In `RetentionPageClient.tsx`, add `import { normalizePhone } from "@/lib/arbox/normalize-phone";`, add `visiblePhones: readonly string[] | null;` to the props, destructure it, and add a memo near the top of the component body:

```ts
  const visibleSet = useMemo(
    () => (visiblePhones === null ? null : new Set(visiblePhones)),
    [visiblePhones],
  );
  const inScope = useCallback(
    (entry: RetentionEntry) => {
      if (visibleSet === null) return true;
      const phone = normalizePhone(entry.phone);
      return phone !== null && visibleSet.has(phone);
    },
    [visibleSet],
  );
```

(Import `useMemo` and `useCallback` from react if not already, and `RetentionEntry` from `@/lib/arbox/retention`.) Change the tab count labels and the table's `entries` prop to use the filtered list:

```tsx
            מנוי חודשי{data ? ` (${data.monthly.filter(inScope).length})` : ""}
            ...
            מנוי PRO{data ? ` (${data.pro.filter(inScope).length})` : ""}
            ...
            כרטיסת אימונים{data ? ` (${data.training_card.filter(inScope).length})` : ""}
```

and

```tsx
                  <RetentionTable
                    entries={data[category].filter(inScope)}
```

If `initialChurned` is also rendered as a list of people, apply `inScope` to it the same way; if it is keyed by a different shape, leave it and note that in the commit message.

- [ ] **Step 3: Type-check, lint, verify, commit**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

As a קריית אתא trainer, `/admin/retention` lists only trainees whose phone belongs to a קריית אתא profile. As admin, everything.

```bash
git add src/app/admin/retention/page.tsx src/components/admin/retention/RetentionPageClient.tsx
git commit -m "feat(branches): retention lists only the trainer's branch

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 18: Wrap-up

- [ ] **Step 1: Full verification**

Run:

```bash
npx tsc --noEmit && npm run lint && npm run test:run && npm run build
```

Expected: all four clean.

- [ ] **Step 2: Manual pass on a preview deployment**

Deploy a preview with `vercel` and walk the three personas from the spec's Section 7:

1. A trainer in one branch: users, assessments, submissions, schedule, shifts, retention all show that branch only; the schedule header shows a badge, not a select; clock-in needs no choice.
2. A trainer in both: the schedule and rankings offer a switch; clock-in asks for a branch.
3. Eden: every list has a branch filter; the branches page edits and reorders; bulk assign works.

- [ ] **Step 3: CLAUDE.md**

Under "Architecture" add a short subsection:

```markdown
### Branches

`branches` + `profile_branches` (many-to-many). Trainer scope comes from `getBranchScopeAction()` in `src/lib/actions/shared/` and is applied in server queries through `visibleProfileIds()`; never rely on RLS for it. Schedule pages carry the branch in `?branch=` and hand it to dialogs through `BranchProvider` / `useCurrentBranch()`. Shifts store `branch_id`; rankings take a branch id. See `docs/adr/0006-branches-are-a-table.md`.
```

- [ ] **Step 4: Commit and open the PR**

```bash
git add CLAUDE.md
git commit -m "docs(branches): architecture note for branch scoping

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

Then follow the project's PR workflow (`git diff main...HEAD`, conventional summary, test plan listing the three personas).
