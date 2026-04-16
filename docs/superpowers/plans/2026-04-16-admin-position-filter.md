# Admin Position Filter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Hebrew position filter dropdown to six admin pages (users, assessments, nutrition, retention, submissions, shift-reports) so admins can filter trainee lists by football position.

**Architecture:** One shared filter module (`src/lib/admin/position-filter.ts`) exposes the option list and a `matchesPositionFilter` predicate. Each page integrates the dropdown using its existing toolbar pattern (bespoke `UserTableToolbar` vs shared `TableToolbar` + `ToolbarSelect`). Filtering is client-side where pages already filter in-memo; server-side where pages already paginate via a server action (extend the action to accept a `position` param).

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript (strict), `nuqs` for URL state, Vitest for unit tests, Supabase Postgres (profiles.position column already exists).

**Spec:** [docs/superpowers/specs/2026-04-16-admin-position-filter-design.md](../specs/2026-04-16-admin-position-filter-design.md)

---

## Task 0: Shared position filter module (TDD)

**Files:**
- Create: `src/lib/admin/position-filter.ts`
- Create: `src/lib/admin/__tests__/position-filter.test.ts`

- [ ] **Step 1: Create the test directory and write failing tests**

Create `src/lib/admin/__tests__/position-filter.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  matchesPositionFilter,
  positionFilterOptions,
  POSITION_FILTER_ALL,
  POSITION_FILTER_NONE,
} from "../position-filter";

describe("matchesPositionFilter", () => {
  it("returns true when filter is null", () => {
    expect(matchesPositionFilter("ST", null)).toBe(true);
    expect(matchesPositionFilter(null, null)).toBe(true);
  });

  it("returns true when filter is the ALL sentinel", () => {
    expect(matchesPositionFilter("ST", POSITION_FILTER_ALL)).toBe(true);
    expect(matchesPositionFilter(null, POSITION_FILTER_ALL)).toBe(true);
  });

  it("matches only the exact position when a specific position is selected", () => {
    expect(matchesPositionFilter("ST", "ST")).toBe(true);
    expect(matchesPositionFilter("CF", "ST")).toBe(false);
    expect(matchesPositionFilter(null, "ST")).toBe(false);
    expect(matchesPositionFilter(undefined, "ST")).toBe(false);
  });

  it("matches only null/undefined when NONE is selected", () => {
    expect(matchesPositionFilter(null, POSITION_FILTER_NONE)).toBe(true);
    expect(matchesPositionFilter(undefined, POSITION_FILTER_NONE)).toBe(true);
    expect(matchesPositionFilter("ST", POSITION_FILTER_NONE)).toBe(false);
  });
});

describe("positionFilterOptions", () => {
  it("starts with ALL and ends with NONE", () => {
    expect(positionFilterOptions[0].value).toBe(POSITION_FILTER_ALL);
    expect(positionFilterOptions[positionFilterOptions.length - 1].value).toBe(
      POSITION_FILTER_NONE,
    );
  });

  it("contains all 11 positions with Hebrew labels", () => {
    const values = positionFilterOptions.map((o) => o.value);
    expect(values).toContain("GK");
    expect(values).toContain("ST");
    expect(values).toContain("CAM");
    expect(values).toHaveLength(13);
    const gkOption = positionFilterOptions.find((o) => o.value === "GK");
    expect(gkOption?.label).toBe("שוער");
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `npm run test:run -- src/lib/admin/__tests__/position-filter.test.ts`

Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the module**

Create `src/lib/admin/position-filter.ts`:

```ts
import {
  POSITIONS,
  POSITION_LABELS_HE,
  type PlayerPosition,
} from "@/types/player-stats";

export const POSITION_FILTER_ALL = "all";
export const POSITION_FILTER_NONE = "none";

export interface PositionFilterOption {
  value: string;
  label: string;
}

export const positionFilterOptions: PositionFilterOption[] = [
  { value: POSITION_FILTER_ALL, label: "כל העמדות" },
  ...POSITIONS.map((p) => ({ value: p, label: POSITION_LABELS_HE[p] })),
  { value: POSITION_FILTER_NONE, label: "ללא עמדה" },
];

export function matchesPositionFilter(
  userPosition: PlayerPosition | string | null | undefined,
  filter: string | null | undefined,
): boolean {
  if (!filter || filter === POSITION_FILTER_ALL) return true;
  if (filter === POSITION_FILTER_NONE) return !userPosition;
  return userPosition === filter;
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `npm run test:run -- src/lib/admin/__tests__/position-filter.test.ts`

Expected: PASS, all 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/lib/admin/position-filter.ts src/lib/admin/__tests__/position-filter.test.ts
git commit -m "feat(admin): add shared position filter module"
```

---

## Task 1: Users page position filter

**Files:**
- Modify: `src/components/admin/users/UserTableToolbar.tsx`
- Modify: `src/components/admin/users/UserDataTable.tsx`
- Modify: `src/app/admin/users/page.tsx`

- [ ] **Step 1: Add position dropdown to `UserTableToolbar.tsx`**

Open `src/components/admin/users/UserTableToolbar.tsx` and make these changes:

1. Add imports at the top (after the existing lucide import):

```ts
import { positionFilterOptions } from "@/lib/admin/position-filter";
```

2. Add `onPositionChange` to the `UserTableToolbarProps` interface, alongside the other `onXChange` props:

```ts
onPositionChange: (value: string | null) => void;
```

3. Inside the component, add a nuqs hook next to the existing ones:

```ts
const [position, setPosition] = useQueryState("position", parseAsString);
```

4. Add an effect to sync position changes to the parent (next to the other effects):

```ts
useEffect(() => {
  onPositionChange(position);
}, [position, onPositionChange]);
```

5. Add a handler:

```ts
const handlePositionChange = (value: string) => {
  const newPosition = value === "all" ? null : value;
  setPosition(newPosition);
  onPositionChange(newPosition);
};
```

6. Add `onPositionChange` to the function's destructured props:

```ts
export function UserTableToolbar({
  onSearchChange,
  onRoleChange,
  onStatusChange,
  onPositionChange,
  onShowDeletedChange,
  isAdmin = true,
}: UserTableToolbarProps) {
```

7. Inside the JSX, directly after the Status Filter `<Select>` block, add the position dropdown:

```tsx
{/* Position Filter */}
<Select value={position || "all"} onValueChange={handlePositionChange}>
  <SelectTrigger className="w-full md:w-40">
    <SelectValue placeholder="עמדה" />
  </SelectTrigger>
  <SelectContent>
    {positionFilterOptions.map((option) => (
      <SelectItem key={option.value} value={option.value}>
        {option.label}
      </SelectItem>
    ))}
  </SelectContent>
</Select>
```

- [ ] **Step 2: Wire the filter through `UserDataTable.tsx`**

Open `src/components/admin/users/UserDataTable.tsx`:

1. Add import at the top:

```ts
import { matchesPositionFilter } from "@/lib/admin/position-filter";
```

2. Add `initialPosition?: string | null` to `UserDataTableProps`:

```ts
interface UserDataTableProps {
  data: Profile[];
  initialSearch?: string;
  initialRole?: string | null;
  initialStatus?: string | null;
  initialPosition?: string | null;
  initialShowDeleted?: boolean;
  isAdmin?: boolean;
}
```

3. Destructure the new prop with default `null` and add a state hook next to the others:

```ts
const [positionFilter, setPositionFilter] = useState<string | null>(initialPosition);
```

4. Extend the `useMemo` filter body. After the status filter block, before `return true`, add:

```ts
// Position filter
if (!matchesPositionFilter(user.position, positionFilter)) return false;
```

5. Add `positionFilter` to the `useMemo` dependency array.

6. Add a memoized handler alongside the others:

```ts
const handlePositionChange = useCallback((value: string | null) => {
  setPositionFilter(value);
}, []);
```

7. Pass `onPositionChange={handlePositionChange}` into `<UserTableToolbar ...>`.

- [ ] **Step 3: Read the `position` search param in the page**

Open `src/app/admin/users/page.tsx`:

1. Add `position?: string;` to `searchParams` shape (inside the `PageProps` interface).

2. Pass `initialPosition={params.position || null}` to `<UserDataTable ... />`.

- [ ] **Step 4: Type-check and lint**

Run: `npx tsc --noEmit` and `npm run lint`

Expected: PASS, no new errors related to the position filter.

- [ ] **Step 5: Manual verification**

Run: `npm run dev`, log in as admin, visit `/admin/users`. Verify:

- Position dropdown appears after the status dropdown.
- Selecting a position (e.g., חלוץ) narrows the list and URL shows `?position=ST`.
- Selecting ללא עמדה shows users without a position set; URL shows `?position=none`.
- Selecting כל העמדות clears the filter and removes the `position` param.
- Browser back restores the previous filter.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/users/UserTableToolbar.tsx src/components/admin/users/UserDataTable.tsx src/app/admin/users/page.tsx
git commit -m "feat(admin): add position filter to users page"
```

---

## Task 2: Assessments page position filter

**Files:**
- Modify: `src/lib/actions/admin-assessments-list.ts`
- Modify: `src/components/admin/assessments/AssessmentsTable.tsx`

- [ ] **Step 1: Inspect the server action to confirm filter shape**

Open `src/lib/actions/admin-assessments-list.ts`. Find the `getAssessmentsPaginated` function and its params interface (similar to `SubmissionQueryParams` in `admin-submissions-list.ts`). Confirm it builds a Supabase query on `profiles`.

- [ ] **Step 2: Extend the server action to accept a `position` filter**

In `src/lib/actions/admin-assessments-list.ts`:

1. Add `position?: string` to the params interface used by `getAssessmentsPaginated`.

2. Import the constants:

```ts
import { POSITION_FILTER_NONE } from "@/lib/admin/position-filter";
```

3. After the existing search/age-group filter chains on the `profiles` query, add:

```ts
if (params.position) {
  if (params.position === POSITION_FILTER_NONE) {
    query = query.is("position", null);
  } else {
    query = query.eq("position", params.position);
  }
}
```

Use the actual query variable name from the file (it may be `query` or similar).

- [ ] **Step 3: Wire the filter into `AssessmentsTable.tsx`**

Open `src/components/admin/assessments/AssessmentsTable.tsx`:

1. Add imports:

```ts
import { positionFilterOptions, POSITION_FILTER_ALL } from "@/lib/admin/position-filter";
```

2. Add a nuqs hook next to the existing `ageGroup`:

```ts
const [position, setPosition] = useQueryState(
  "position",
  parseAsString.withDefault(POSITION_FILTER_ALL),
);
```

3. Update `fetchData` signature and usage to accept the new arg `newPosition: string`:

```ts
const fetchData = useCallback(
  (
    newPage: number,
    newSearch: string,
    newAgeGroup: string,
    newPosition: string,
  ) => {
    const currentRequestId = ++requestIdRef.current;
    startTransition(async () => {
      const result = await getAssessmentsPaginated({
        page: newPage,
        pageSize: PAGE_SIZE,
        search: newSearch || undefined,
        ageGroupId: newAgeGroup !== "all" ? newAgeGroup : undefined,
        position: newPosition !== "all" ? newPosition : undefined,
      });
      if (currentRequestId === requestIdRef.current) {
        setProfiles(result.profiles);
        setAssessmentsByUser(result.assessmentsByUser);
        setTotal(result.total);
      }
    });
  },
  [],
);
```

4. Update the existing `handleSearchChange`, `handleAgeGroupChange`, and `handlePageChange` calls to pass `position || POSITION_FILTER_ALL` as the new fourth argument:

```ts
const handleSearchChange = (value: string) => {
  setSearch(value || null);
  setPage(0);
  fetchData(0, value, ageGroup || "all", position || POSITION_FILTER_ALL);
};

const handleAgeGroupChange = (value: string) => {
  setAgeGroup(value === "all" ? null : value);
  setPage(0);
  fetchData(0, search, value, position || POSITION_FILTER_ALL);
};

const handlePageChange = (newPage: number) => {
  setPage(newPage);
  fetchData(newPage, search, ageGroup || "all", position || POSITION_FILTER_ALL);
};
```

5. Add a new handler:

```ts
const handlePositionChange = (value: string) => {
  setPosition(value === POSITION_FILTER_ALL ? null : value);
  setPage(0);
  fetchData(0, search, ageGroup || "all", value);
};
```

6. Inside the `<TableToolbar filters={...}>` prop, wrap the existing `<ToolbarSelect ...>` and the new one in a fragment:

```tsx
filters={
  <>
    <ToolbarSelect
      value={ageGroup || "all"}
      onValueChange={handleAgeGroupChange}
      options={ageGroupOptions}
      placeholder="קבוצת גיל"
    />
    <ToolbarSelect
      value={position || POSITION_FILTER_ALL}
      onValueChange={handlePositionChange}
      options={positionFilterOptions}
      placeholder="עמדה"
    />
  </>
}
```

7. Update the "no matches" empty-state condition to also consider the position filter:

```tsx
{search || (ageGroup && ageGroup !== "all") || (position && position !== POSITION_FILTER_ALL)
  ? "לא נמצאו שחקנים מתאימים"
  : "אין שחקנים רשומים"}
```

- [ ] **Step 4: Type-check and lint**

Run: `npx tsc --noEmit` and `npm run lint`

Expected: PASS.

- [ ] **Step 5: Manual verification**

Run: `npm run dev`, visit `/admin/assessments`. Confirm the position dropdown filters the list and the URL reflects the `position` param.

- [ ] **Step 6: Commit**

```bash
git add src/lib/actions/admin-assessments-list.ts src/components/admin/assessments/AssessmentsTable.tsx
git commit -m "feat(admin): add position filter to assessments page"
```

---

## Task 3: Nutrition page position filter

**Files:**
- Modify: `src/app/admin/nutrition/page.tsx`
- Modify: `src/components/admin/nutrition/NutritionTable.tsx`

- [ ] **Step 1: Ensure the page query selects `position`**

Open `src/app/admin/nutrition/page.tsx`. Locate the Supabase select for the trainees list (it fetches `{ id, full_name }` today). Change the select to include `position`:

```ts
// example shape
supabase
  .from("profiles")
  .select("id, full_name, position")
  .eq("role", "trainee")
```

Use the exact existing call pattern from the file.

- [ ] **Step 2: Extend `NutritionTable` types and filter logic**

Open `src/components/admin/nutrition/NutritionTable.tsx`:

1. Add imports:

```ts
import { useQueryState, parseAsString } from "nuqs";
import {
  positionFilterOptions,
  matchesPositionFilter,
  POSITION_FILTER_ALL,
} from "@/lib/admin/position-filter";
import type { PlayerPosition } from "@/types/player-stats";
```

2. Extend the `Trainee` interface:

```ts
interface Trainee {
  id: string;
  full_name: string | null;
  position: PlayerPosition | null;
}
```

3. Add a nuqs hook next to the other filter hooks:

```ts
const [position, setPosition] = useQueryState(
  "position",
  parseAsString.withDefault(POSITION_FILTER_ALL),
);
```

4. Extend the `filteredTrainees` memo. Before `return true`, add:

```ts
if (!matchesPositionFilter(trainee.position, position)) return false;
```

Add `position` to the dependency array of that `useMemo`.

5. Add a handler:

```ts
const handlePositionChange = (value: string) => {
  setPosition(value === POSITION_FILTER_ALL ? null : value);
  setPage(0);
};
```

6. Add a new `<ToolbarSelect>` inside the `<>...</>` of the `filters` prop:

```tsx
<ToolbarSelect
  value={position || POSITION_FILTER_ALL}
  onValueChange={handlePositionChange}
  options={positionFilterOptions}
  placeholder="עמדה"
/>
```

7. Update the empty-state condition to include position:

```tsx
{search ||
(planFilter && planFilter !== "all") ||
(recFilter && recFilter !== "all") ||
(position && position !== POSITION_FILTER_ALL)
  ? "לא נמצאו חניכים מתאימים"
  : "אין חניכים רשומים"}
```

- [ ] **Step 3: Type-check and lint**

Run: `npx tsc --noEmit` and `npm run lint`

Expected: PASS.

- [ ] **Step 4: Manual verification**

`npm run dev`, visit `/admin/nutrition`. Confirm the position dropdown filters correctly.

- [ ] **Step 5: Commit**

```bash
git add src/app/admin/nutrition/page.tsx src/components/admin/nutrition/NutritionTable.tsx
git commit -m "feat(admin): add position filter to nutrition page"
```

---

## Task 4: Retention page position filter

Retention entries come from Arbox (identified by `phone`); `position` lives on `profiles`. Resolve positions via a phone-keyed map built on the client from profile data passed down from the server.

**Files:**
- Modify: `src/components/admin/retention/RetentionPageClient.tsx`
- Modify: `src/components/admin/retention/RetentionTable.tsx`
- Modify: `src/app/admin/retention/page.tsx` (or the server source that feeds `RetentionPageClient` — grep to confirm)

- [ ] **Step 1: Identify the retention data flow**

Run: `grep -rn "RetentionPageClient\|RetentionTable" src/app/admin/retention src/components/admin/retention`

Find where `RetentionPageClient` is rendered and where `entries` are prepared. This is the source you will extend to include a `traineePositions` map (phone → position).

- [ ] **Step 2: Fetch trainee phone→position map on the server**

In the retention server component or loader (the page or data-fetching action that feeds `RetentionPageClient`), after the existing data fetch, add:

```ts
import { createClient } from "@/lib/supabase/server";

const supabase = await createClient();
const { data: traineeRows } = await supabase
  .from("profiles")
  .select("phone, position")
  .eq("role", "trainee")
  .not("phone", "is", null);

const traineePositions: Record<string, string | null> = {};
for (const row of traineeRows ?? []) {
  if (row.phone) traineePositions[row.phone] = row.position ?? null;
}
```

Pass `traineePositions` as a prop to `RetentionPageClient` and forward it into `RetentionTable`.

- [ ] **Step 3: Add the filter to `RetentionTable.tsx`**

Open `src/components/admin/retention/RetentionTable.tsx`:

1. Add imports:

```ts
import { useQueryState, parseAsString } from "nuqs";
import { TableToolbar, ToolbarSelect } from "@/components/admin/TableToolbar";
import {
  positionFilterOptions,
  matchesPositionFilter,
  POSITION_FILTER_ALL,
} from "@/lib/admin/position-filter";
```

(Replace the existing narrow `TableToolbar` import with this one if it's already there.)

2. Add `traineePositions: Readonly<Record<string, string | null>>` to `RetentionTableProps`:

```ts
interface RetentionTableProps {
  entries: readonly RetentionEntry[];
  monthKeys: readonly string[];
  notes: ReadonlyMap<string, RetentionNote>;
  traineePositions: Readonly<Record<string, string | null>>;
  onSaveNote: (
    traineePhone: string,
    traineeName: string,
    note: string,
  ) => Promise<void>;
}
```

Destructure `traineePositions` in the function signature.

3. Replace the `useState("")` for `search` with a nuqs-aware version alongside a new position hook:

```ts
const [search, setSearch] = useQueryState("q", parseAsString.withDefault(""));
const [position, setPosition] = useQueryState(
  "position",
  parseAsString.withDefault(POSITION_FILTER_ALL),
);
```

4. Replace the one-line `filtered` expression with a richer filter:

```ts
const filtered = entries.filter((e) => {
  if (search && !e.name.toLowerCase().includes(search.toLowerCase())) {
    return false;
  }
  const entryPosition = e.phone ? traineePositions[e.phone] ?? null : null;
  if (!matchesPositionFilter(entryPosition, position)) return false;
  return true;
});
```

5. Update the `TableToolbar` usage to pass the new filter:

```tsx
<TableToolbar
  searchValue={search}
  onSearchChange={(value) => setSearch(value || null)}
  searchPlaceholder="חיפוש לפי שם..."
  filters={
    <ToolbarSelect
      value={position || POSITION_FILTER_ALL}
      onValueChange={(value) =>
        setPosition(value === POSITION_FILTER_ALL ? null : value)
      }
      options={positionFilterOptions}
      placeholder="עמדה"
    />
  }
/>
```

- [ ] **Step 4: Propagate the prop through `RetentionPageClient.tsx`**

Open `src/components/admin/retention/RetentionPageClient.tsx`. Add `traineePositions` to its props, forward to `<RetentionTable traineePositions={traineePositions} ... />`. Leave other behavior unchanged.

- [ ] **Step 5: Type-check and lint**

Run: `npx tsc --noEmit` and `npm run lint`

Expected: PASS.

- [ ] **Step 6: Manual verification**

`npm run dev`, visit `/admin/retention`. Confirm:

- The dropdown is present next to the search input.
- Filtering by position hides entries whose linked profile has a different position.
- Entries without a phone, or phones with no matching trainee, appear under `ללא עמדה` when that option is selected.

- [ ] **Step 7: Commit**

```bash
git add src/app/admin/retention/page.tsx src/components/admin/retention/RetentionPageClient.tsx src/components/admin/retention/RetentionTable.tsx
git commit -m "feat(admin): add position filter to retention page"
```

---

## Task 5: Submissions page position filter (pre-workout, post-workout, nutrition)

Submissions actions already paginate server-side. Extend them to join `profiles` and filter on `profiles.position` via the existing `user_id` foreign key.

**Files:**
- Modify: `src/lib/actions/admin-submissions-list.ts`
- Modify: `src/components/admin/submissions/SubmissionsContent.tsx`

- [ ] **Step 1: Extend `SubmissionQueryParams` and all three submission actions**

Open `src/lib/actions/admin-submissions-list.ts`:

1. Extend the shared params interface:

```ts
export interface SubmissionQueryParams {
  page: number;
  pageSize: number;
  search?: string;
  startDate?: string;
  endDate?: string;
  position?: string;
}
```

2. Add import:

```ts
import { POSITION_FILTER_NONE } from "@/lib/admin/position-filter";
```

3. In each of `getPreWorkoutPaginated`, `getPostWorkoutPaginated`, `getNutritionPaginated`:

- Change the `select("*", ...)` call to include the profile join:

```ts
.select("*, profile:profiles!inner(position)", { count: "exact" })
```

- After the existing filter chain and before the `.range(...)` call, add:

```ts
if (params.position) {
  if (params.position === POSITION_FILTER_NONE) {
    query = query.is("profile.position", null);
  } else {
    query = query.eq("profile.position", params.position);
  }
}
```

Note: confirm the foreign-key relationship name by grepping for existing FK hints (e.g., `pre_workout_forms` likely has `user_id` referencing `profiles.id`). If the FK name must be explicit, use `profile:profiles!pre_workout_forms_user_id_fkey(position)` etc. If in doubt, run a local `npx tsc --noEmit` after editing to surface any type errors.

- [ ] **Step 2: Add position state and the new dropdown to all three tab components in `SubmissionsContent.tsx`**

Open `src/components/admin/submissions/SubmissionsContent.tsx`. For each of `PreWorkoutContent`, `PostWorkoutContent`, and `NutritionContent`:

1. Add imports at the top of the file:

```ts
import { useQueryState, parseAsString } from "nuqs";
import { ToolbarSelect } from "@/components/admin/TableToolbar";
import {
  positionFilterOptions,
  POSITION_FILTER_ALL,
} from "@/lib/admin/position-filter";
```

2. Add nuqs state inside each component alongside the existing `useState` values:

```ts
const [position, setPosition] = useQueryState(
  "position",
  parseAsString.withDefault(POSITION_FILTER_ALL),
);
```

3. Extend each component's `fetchData` signature and its body. For `PreWorkoutContent`:

```ts
const fetchData = useCallback(
  (
    newPage: number,
    newSearch: string,
    newStartDate: string,
    newEndDate: string,
    newPosition: string,
  ) => {
    const currentRequestId = ++requestIdRef.current;
    startTransition(async () => {
      const params: SubmissionQueryParams = {
        page: newPage,
        pageSize: PAGE_SIZE,
        search: newSearch || undefined,
        startDate: newStartDate || undefined,
        endDate: newEndDate || undefined,
        position: newPosition !== POSITION_FILTER_ALL ? newPosition : undefined,
      };
      const result = await getPreWorkoutPaginated(params);
      if (currentRequestId === requestIdRef.current) {
        setItems(result.items);
        setTotal(result.total);
      }
    });
  },
  [],
);
```

Repeat the same shape for `PostWorkoutContent` (calling `getPostWorkoutPaginated`) and `NutritionContent` (calling `getNutritionPaginated`).

4. Update every existing call site of `fetchData` to pass `position || POSITION_FILTER_ALL` as the new argument.

5. Add a new handler in each component:

```ts
const handlePositionChange = (value: string) => {
  setPosition(value === POSITION_FILTER_ALL ? null : value);
  setPage(0);
  fetchData(0, search, startDate, endDate, value);
};
```

6. In each component's `<TableToolbar filters={...}>` prop, add the dropdown alongside the existing `ToolbarDateRange`:

```tsx
filters={
  <>
    <ToolbarSelect
      value={position || POSITION_FILTER_ALL}
      onValueChange={handlePositionChange}
      options={positionFilterOptions}
      placeholder="עמדה"
    />
    <ToolbarDateRange
      startDate={startDate}
      endDate={endDate}
      onStartDateChange={handleStartDateChange}
      onEndDateChange={handleEndDateChange}
    />
  </>
}
```

- [ ] **Step 3: Type-check and lint**

Run: `npx tsc --noEmit` and `npm run lint`

Expected: PASS. If the Supabase join raises a type error about unknown foreign-key relationships, adjust the hint string to the explicit FK constraint name (grep `pre_workout_forms_.*_fkey` in `src/types/database.ts`).

- [ ] **Step 4: Manual verification**

`npm run dev`, visit `/admin/submissions`. Cycle through all three tabs. Confirm the position filter narrows each list server-side and the URL reflects `position=`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/admin-submissions-list.ts src/components/admin/submissions/SubmissionsContent.tsx
git commit -m "feat(admin): add position filter to submissions page"
```

---

## Task 6: Shift-reports page position filter

Shift reports are one row per trainer-shift, not per trainee. The spec includes shift-reports in scope; the correct interpretation is "filter which shift reports to show based on the position of at least one trainee mentioned in the report." If the schema does not support this cleanly, document and skip.

**Files:**
- Read-only investigation: `src/types/database.ts`, `src/lib/actions/admin-submissions-list.ts`, `supabase/migrations/` (for `trainer_shift_reports` columns)
- Conditionally modify: `src/lib/actions/admin-submissions-list.ts`, `src/components/admin/submissions/ShiftReportContent.tsx`

- [ ] **Step 1: Investigate the shift-report schema**

Run:

```bash
grep -n "trainer_shift_reports\|TrainerShiftReport" src/types/database.ts
```

And:

```bash
grep -rn "trainer_shift_reports" supabase/migrations/
```

Determine whether a shift report has:
- (a) a `trainee_ids uuid[]` / per-trainee JSONB column — a position filter can be expressed by checking that any referenced trainee has the requested position, OR
- (b) no structured trainee reference — position filtering is not meaningful; skip this task with a note.

- [ ] **Step 2: If (a), extend `getShiftReportsPaginated`**

In `src/lib/actions/admin-submissions-list.ts`, add `position?: string` to the shift-report call site and filter accordingly:

- If the report references trainees by an array column of UUIDs (e.g., `trainee_ids uuid[]`), filter via:

```ts
if (params.position && params.position !== POSITION_FILTER_NONE) {
  const { data: matchingProfiles } = await supabase
    .from("profiles")
    .select("id")
    .eq("position", params.position);
  const ids = (matchingProfiles ?? []).map((p) => p.id);
  if (ids.length === 0) {
    return { items: [], total: 0 };
  }
  query = query.overlaps("trainee_ids", ids);
}
```

Adjust the column name to match the actual schema.

- [ ] **Step 3: If (a), wire the dropdown into `ShiftReportContent.tsx`**

Apply the same pattern as Task 5, Step 2 (imports, nuqs hook, extended `fetchData`, dropdown in `<TableToolbar filters={...}>`, handler). The dropdown is the `ללא עמדה` option should be hidden on this page (position-none isn't a meaningful query for shift reports); filter `positionFilterOptions` locally:

```ts
const shiftReportPositionOptions = positionFilterOptions.filter(
  (o) => o.value !== POSITION_FILTER_NONE,
);
```

Bind the `<ToolbarSelect ... options={shiftReportPositionOptions}>`.

- [ ] **Step 4: If (b), skip with a note**

Stop. Do **not** add the dropdown. In the spec file `docs/superpowers/specs/2026-04-16-admin-position-filter-design.md`, update the Scope section to record:

> `/admin/submissions/shift-reports` — skipped: shift reports are trainer-level records with no structured trainee reference. Revisit if per-trainee shift breakdowns are added.

Commit that doc update with `docs(admin): mark shift-reports out of scope for position filter`.

- [ ] **Step 5: Type-check and lint (only if (a))**

Run: `npx tsc --noEmit` and `npm run lint`

Expected: PASS.

- [ ] **Step 6: Manual verification (only if (a))**

`npm run dev`, visit `/admin/submissions/shift-reports`. Confirm the position dropdown filters shift reports that touch trainees at that position.

- [ ] **Step 7: Commit (if (a))**

```bash
git add src/lib/actions/admin-submissions-list.ts src/components/admin/submissions/ShiftReportContent.tsx
git commit -m "feat(admin): add position filter to shift-reports page"
```

---

## Task 7: Final verification

- [ ] **Step 1: Run the full Vitest suite**

Run: `npm run test:run`

Expected: PASS. No regressions.

- [ ] **Step 2: Lint the project**

Run: `npm run lint`

Expected: PASS.

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`

Expected: PASS, no errors.

- [ ] **Step 4: Smoke-test each page once more**

Visit each of the six pages (users, assessments, nutrition, retention, submissions — all three tabs, shift-reports if Task 6 path (a)). For each:
- Dropdown appears in the toolbar.
- Selecting a position narrows the list.
- URL param updates to `?position=<code>`.
- Back button restores the prior filter.

- [ ] **Step 5: Commit any final fixes (if needed)**

If any smoke-test reveals a small bug, fix it in-place and commit with a message like `fix(admin): <specific fix>`. Do not amend existing commits.
