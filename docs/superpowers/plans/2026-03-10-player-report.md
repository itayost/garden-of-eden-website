# Player Summary Report Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enable trainers/admins to generate professional PDF player summary reports with details, assessments, charts, strengths/weaknesses, social skills, and trainer-written summaries.

**Architecture:** Feature module at `src/features/player-report/` with a dedicated editor page. Data aggregated from profiles, assessments, shift report notes, Arbox attendance API, and a new `trainee_summaries` table. PDF generated client-side via `@react-pdf/renderer` with chart snapshots via `html-to-image`.

**Tech Stack:** Next.js 16 App Router, Recharts (RadarChart), `@react-pdf/renderer`, `html-to-image`, Supabase (Postgres + RLS), Arbox Reports API.

**Spec:** `docs/superpowers/specs/2026-03-10-player-report-design.md`

---

## Chunk 1: Database Migrations, Types & Dependencies

### Task 1.1: Install `html-to-image` dependency

**Files:**

- Modify: `package.json`

- [ ] **Step 1: Install the package**

```bash
npm install html-to-image
```

- [ ] **Step 2: Verify installation**

```bash
npm ls html-to-image
```

Expected: `html-to-image@x.x.x`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add html-to-image dependency for chart snapshots"
```

---

### Task 1.2: Create database migration for `profiles.club`, social skills columns, and `trainee_summaries` table

**Files:**

- Create: `supabase/migrations/20260310120000_player_report_schema.sql`

**Context:** Migrations use Supabase timestamp format. The `update_updated_at_column()` trigger function already exists (used by other tables). RLS must be explicit -- silent insert rejection otherwise.

- [ ] **Step 1: Create the migration file**

```sql
-- Add club field to profiles
ALTER TABLE profiles ADD COLUMN club TEXT NULL;

-- Add social skills columns to trainer_shift_reports
ALTER TABLE trainer_shift_reports
  ADD COLUMN has_social_skills BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN social_skills_trainee_ids UUID[] DEFAULT '{}',
  ADD COLUMN social_skills_details TEXT;

-- Create trainee_summaries table
CREATE TABLE trainee_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_trainee_summaries_user_id ON trainee_summaries(user_id);

-- Auto-update updated_at
CREATE TRIGGER set_trainee_summaries_updated_at
  BEFORE UPDATE ON trainee_summaries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE trainee_summaries ENABLE ROW LEVEL SECURITY;

-- Admins: full access
CREATE POLICY "admins_full_access_trainee_summaries"
  ON trainee_summaries FOR ALL
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Trainers: read all summaries
CREATE POLICY "trainers_select_trainee_summaries"
  ON trainee_summaries FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'trainer')
  );

-- Trainers: insert own authored summaries
CREATE POLICY "trainers_insert_trainee_summaries"
  ON trainee_summaries FOR INSERT
  WITH CHECK (
    auth.uid() = author_id
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'trainer')
  );

-- Trainers: update own authored summaries
CREATE POLICY "trainers_update_trainee_summaries"
  ON trainee_summaries FOR UPDATE
  USING (
    auth.uid() = author_id
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'trainer')
  );
```

- [ ] **Step 2: Push migration to Supabase**

```bash
supabase db push
```

Expected: Migration applied successfully.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260310120000_player_report_schema.sql
git commit -m "feat(db): add club field, social skills columns, and trainee_summaries table"
```

---

### Task 1.3: Update TypeScript types

**Files:**

- Modify: `src/types/database.ts`

**Context:** Types are generated from Supabase schema but also have manual additions. `Profile` is aliased from `Database["public"]["Tables"]["profiles"]["Row"]`. `TrainerShiftReport` is a manual type. Add the new fields to match the migration.

- [ ] **Step 1: Regenerate Supabase types**

```bash
npx supabase gen types typescript --project-id "$(cat supabase/.temp/project-ref)" > src/types/supabase.ts
```

If this fails (no local Supabase CLI setup), manually add the fields:

- [ ] **Step 2: Add `club` to Profile type**

In `src/types/database.ts`, find the `profiles` table Row type and verify `club: string | null` is present after type generation. If using manual types, add it.

- [ ] **Step 3: Add social skills fields to TrainerShiftReport type**

Find the `TrainerShiftReport` type (or equivalent) and add:

```typescript
has_social_skills: boolean;
social_skills_trainee_ids: string[];
social_skills_details: string | null;
```

- [ ] **Step 4: Add TraineeSummary type**

```typescript
export interface TraineeSummary {
  readonly id: string;
  readonly user_id: string;
  readonly author_id: string;
  readonly summary: string;
  readonly created_at: string;
  readonly updated_at: string;
}
```

- [ ] **Step 5: Run type check**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/types/
git commit -m "feat(types): add club, social skills, and trainee summary types"
```

---

## Chunk 2: Social Skills & Club Field Integration

### Task 2.1: Add social skills to shift report Zod schema

**Files:**

- Modify: `src/lib/validations/shift-report.ts`

**Context:** File is 136 lines. Uses `z.object()` with boolean flags + UUID arrays + text details for each category. Follow the exact pattern of existing fields like `has_discipline`, `discipline_trainee_ids`, `discipline_details`.

- [ ] **Step 1: Add social skills fields to the Zod schema**

Add after the `pro_candidates` fields (near the end of the schema):

```typescript
has_social_skills: z.boolean().default(false),
social_skills_trainee_ids: z.array(z.string().uuid()).default([]),
social_skills_details: z.string().max(MAX_TEXT).optional().or(z.literal("")),
```

- [ ] **Step 2: Add default values**

In the `defaultValues` export (or wherever form defaults are defined), add:

```typescript
has_social_skills: false,
social_skills_trainee_ids: [],
social_skills_details: "",
```

- [ ] **Step 3: Add empty-string-to-null conversion in ShiftReportForm**

In `src/components/admin/shift-report/ShiftReportForm.tsx`, the `saveStep` function (around line 122) builds `reportData` with explicit null conversions for text fields. Add after `pro_candidates_details`:

```typescript
social_skills_details: data.social_skills_details || null,
```

This is needed because the form spreads `...data` but text fields need empty string converted to null.

- [ ] **Step 4: Run type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 5: Commit**

```bash
git add src/lib/validations/shift-report.ts src/components/admin/shift-report/ShiftReportForm.tsx
git commit -m "feat(shift-report): add social skills fields to validation schema and form submit"
```

---

### Task 2.2: Add social skills question to end-of-shift form Step 3

**Files:**

- Modify: `src/components/admin/shift-report/ShiftReportStepContent.tsx`

**Context:** File is 591 lines. Step 3 renders questions using `YesNoWithTrainees` helper (lines 44-131). Each question is a `<YesNoWithTrainees>` call with `fieldPrefix`, `label`, and `traineeOptions`. Add social skills after the `pro_candidates` question.

- [ ] **Step 1: Add social skills question to Step 3**

Find the Step 3 section (look for `case 3:` or the component rendering Step 3 questions). After the last question (pro_candidates), add:

```tsx
<YesNoWithTrainees
  form={form}
  fieldPrefix="social_skills"
  label="האם יש שחקנים שהפגינו כישורים חברתיים בולטים?"
  traineeOptions={traineeOptions}
/>
```

- [ ] **Step 2: Verify form renders correctly**

```bash
npm run dev
```

Navigate to `/admin/end-of-shift`, go to Step 3, verify the new question appears after pro candidates with the same yes/no + trainee select + details pattern.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/shift-report/ShiftReportStepContent.tsx
git commit -m "feat(shift-report): add social skills question to Step 3"
```

---

### Task 2.3: Add social skills to trainee notes utilities

**Files:**

- Modify: `src/lib/utils/trainee-notes.ts`

**Context:** File is 152 lines. Has `NoteCategoryType` union type, `NOTE_CATEGORY_LABELS`, `NOTE_CATEGORY_VARIANT`, and `CATEGORY_COLUMNS` array. Each new category needs an entry in all four.

- [ ] **Step 1: Add `social_skills` to `NoteCategoryType`**

```typescript
export type NoteCategoryType =
  | "new_trainee"
  | "discipline"
  | "injuries"
  | "limitations"
  | "achievements"
  | "mental_state"
  | "complaints"
  | "insufficient_attention"
  | "pro_candidates"
  | "social_skills";  // Add this
```

- [ ] **Step 2: Add to `NOTE_CATEGORY_LABELS`**

```typescript
social_skills: "כישורים חברתיים",
```

- [ ] **Step 3: Add to `NOTE_CATEGORY_VARIANT`**

Add a new entry (it's a `Record<NoteCategoryType, string>` where each key maps to a variant):

```typescript
social_skills: "info",
```

- [ ] **Step 4: Add to `CATEGORY_COLUMNS`**

```typescript
{
  type: "social_skills" as const,
  traineeIdsKey: "social_skills_trainee_ids",
  detailsKey: "social_skills_details",
},
```

- [ ] **Step 5: Update `ShiftReportForNotes` type**

Add the new Pick fields so the type includes `has_social_skills`, `social_skills_trainee_ids`, `social_skills_details`.

- [ ] **Step 6: Add social skills color to `TraineeNotesCard.tsx`**

In `src/components/admin/users/TraineeNotesCard.tsx`, the `CATEGORY_COLORS` record (line 30) is defined locally. Add:

```typescript
social_skills: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
```

- [ ] **Step 7: Run type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 8: Commit**

```bash
git add src/lib/utils/trainee-notes.ts src/components/admin/users/TraineeNotesCard.tsx
git commit -m "feat(trainee-notes): add social skills category to note utilities"
```

---

### Task 2.4: Add social skills to shift report detail view

**Files:**

- Modify: `src/app/admin/submissions/shift-reports/[id]/page.tsx`

**Context:** This page renders each shift report section as cards. Follow the existing pattern for rendering a boolean + trainee list + details section.

- [ ] **Step 1: Add social skills section**

Find where Step 3 sections are rendered (after pro_candidates). Add a card section following the same pattern:

```tsx
{/* Social Skills */}
<ReportSection
  title="כישורים חברתיים"
  hasFlag={report.has_social_skills}
  traineeIds={report.social_skills_trainee_ids}
  details={report.social_skills_details}
  profiles={profiles}
/>
```

If `ReportSection` is not an extracted component, follow the inline rendering pattern used by existing sections.

- [ ] **Step 2: Verify rendering**

Navigate to an existing shift report detail page and verify the social skills section appears (will show "לא" for existing reports since default is false).

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/submissions/shift-reports/
git commit -m "feat(shift-report): render social skills in report detail view"
```

---

### Task 2.5: Add social skills to CSV export

**Files:**

- Modify: `src/components/admin/exports/ShiftReportExportButton.tsx`

**Context:** CSV export maps shift report fields to Hebrew column headers. Follow the existing pattern for boolean + details fields.

- [ ] **Step 1: Add social skills columns to export**

Find the column mapping array and add:

```typescript
{ header: "כישורים חברתיים", accessor: (r) => r.has_social_skills ? "כן" : "לא" },
{ header: "פרטי כישורים חברתיים", accessor: (r) => r.social_skills_details || "" },
```

- [ ] **Step 2: Commit**

```bash
git add src/components/admin/exports/ShiftReportExportButton.tsx
git commit -m "feat(export): include social skills in shift report CSV export"
```

---

### Task 2.6: Add club field to UserEditForm

**Files:**

- Modify: `src/components/admin/UserEditForm.tsx`
- Modify: `src/lib/validations/` (user edit Zod schema)

**Context:** UserEditForm (215 lines) uses react-hook-form with Zod resolver. Text input pattern: `FormField > FormItem > FormLabel > FormControl > Input`. Add club as an optional text field.

- [ ] **Step 1: Add `club` to user edit Zod schema**

In `src/lib/validations/user-edit.ts`, add to `userEditSchema`:

```typescript
club: z.string().max(100).optional().or(z.literal("")),
```

- [ ] **Step 2: Add `club` to `getUserEditDefaults`**

In the same file, add to the return object of `getUserEditDefaults()` (line 44):

```typescript
club: profile.club || "",
```

- [ ] **Step 3: Add `club` to `getFieldChanges`**

In the same file, add a change detection block after the birthdate block (around line 89):

```typescript
const originalClub = original.club || null;
const updatedClub = updated.club || null;
if (originalClub !== updatedClub) {
  changes.push({
    field: "club",
    old_value: original.club,
    new_value: updated.club || null,
  });
}
```

- [ ] **Step 4: Add club input field to UserEditForm**

Add after the `position` field (or another logical location):

```tsx
<FormField
  control={form.control}
  name="club"
  render={({ field }) => (
    <FormItem>
      <FormLabel>מועדון / קבוצה</FormLabel>
      <FormControl>
        <Input placeholder="לדוגמה: מכבי חיפה" {...field} disabled={loading} />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

- [ ] **Step 5: Add `club` to the update action payload**

In `src/lib/actions/admin-users-update.ts`, find the `.update()` call and add `club` to the fields being written. The action builds an update object from the validated form data -- ensure `club: validatedData.club || null` is included.

- [ ] **Step 6: Verify in browser**

Navigate to `/admin/users/[any-user-id]`, check that the club field appears and can be saved.

- [ ] **Step 7: Run type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 8: Commit**

```bash
git add src/components/admin/UserEditForm.tsx src/lib/validations/user-edit.ts src/lib/actions/admin-users-update.ts
git commit -m "feat(admin): add club field to user edit form"
```

---

## Chunk 3: Arbox Reports & Data Layer

### Task 3.1: Create Arbox reports API client

**Files:**

- Create: `src/lib/arbox/reports.ts`

**Context:** Follow the pagination pattern from `src/lib/arbox/client.ts` (66 lines). The existing client uses `fetchArboxUsersPage()` with page loop stopping at `length < 500`. Reports API uses same auth header (`api-key`), same base URL, different path (`/v3/reports/entrance`).

- [ ] **Step 1: Write the test for entrance report parsing**

Create `src/lib/arbox/__tests__/reports.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { calculateWeeklyAverage } from "../reports";

describe("calculateWeeklyAverage", () => {
  it("calculates correct weekly average", () => {
    // 4 sessions over 2 weeks
    const result = calculateWeeklyAverage(4, "2026-01-01", "2026-01-14");
    expect(result).toBeCloseTo(2.0, 1);
  });

  it("returns 0 for zero sessions", () => {
    const result = calculateWeeklyAverage(0, "2026-01-01", "2026-01-14");
    expect(result).toBe(0);
  });

  it("handles single day range", () => {
    const result = calculateWeeklyAverage(1, "2026-01-01", "2026-01-01");
    expect(result).toBeCloseTo(7.0, 1); // 1 session in 1 day = 7/week
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run -- src/lib/arbox/__tests__/reports.test.ts
```

Expected: FAIL (module not found)

- [ ] **Step 3: Implement the reports module**

Create `src/lib/arbox/reports.ts`:

```typescript
const BASE_URL = "https://arboxserver.arboxapp.com/api/public/v3";
const PAGE_LIMIT = 500;

export interface EntranceReportEntry {
  readonly user_id: number | null;
  readonly name: string;
  readonly email: string | null;
  readonly phone: string | null;
  readonly class_name: string | null;
  readonly date: string;
  readonly start_time: string;
  readonly location_name: string | null;
}

interface ArboxReportResponse {
  readonly statusCode: number;
  readonly data: readonly EntranceReportEntry[];
  readonly extra: readonly unknown[];
}

async function fetchEntranceReportPage(
  from: string,
  to: string,
  page: number,
): Promise<readonly EntranceReportEntry[]> {
  const apiKey = process.env.ARBOX_API_KEY;
  if (!apiKey) {
    throw new Error("ARBOX_API_KEY is not set");
  }

  const url = `${BASE_URL}/reports/entrance?from=${from}&to=${to}&page=${page}&limit=${PAGE_LIMIT}`;
  const res = await fetch(url, {
    headers: {
      "api-key": apiKey,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Arbox entrance report failed: ${res.status}`);
  }

  const json: ArboxReportResponse = await res.json();
  return json.data;
}

export async function fetchEntranceReport(
  from: string,
  to: string,
): Promise<readonly EntranceReportEntry[]> {
  const all: EntranceReportEntry[] = [];
  let page = 1;

  while (true) {
    const entries = await fetchEntranceReportPage(from, to, page);
    all.push(...entries);
    if (entries.length < PAGE_LIMIT) break;
    page++;
  }

  return all;
}

export function calculateWeeklyAverage(
  totalSessions: number,
  fromDate: string,
  toDate: string,
): number {
  if (totalSessions === 0) return 0;
  const from = new Date(fromDate);
  const to = new Date(toDate);
  const days = Math.max(1, (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
  const weeks = days / 7;
  return totalSessions / Math.max(weeks, 1 / 7);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test:run -- src/lib/arbox/__tests__/reports.test.ts
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/arbox/reports.ts src/lib/arbox/__tests__/reports.test.ts
git commit -m "feat(arbox): add entrance report API client with weekly average calculation"
```

---

### Task 3.2: Create aggregate-notes utility

**Files:**

- Create: `src/features/player-report/lib/utils/aggregate-notes.ts`
- Create: `src/features/player-report/lib/utils/__tests__/aggregate-notes.test.ts`

**Context:** This utility pulls trainee notes from shift reports and categorizes them as strengths vs. weaknesses. Uses `extractTraineeNotes()` from `src/lib/utils/trainee-notes.ts` and filters by category.

- [ ] **Step 1: Write the test**

```typescript
import { describe, it, expect } from "vitest";
import { categorizeNotes } from "../aggregate-notes";
import type { TraineeReportNotes } from "@/lib/utils/trainee-notes";

const mockNotes: readonly TraineeReportNotes[] = [
  {
    reportId: "r1",
    reportDate: "2026-01-15",
    trainerName: "Coach A",
    notes: [
      { type: "achievements", label: "הישגים", details: "Great speed improvement", achievementCategories: ["מהירות"] },
      { type: "limitations", label: "מגבלות", details: "Needs flexibility work" },
    ],
  },
  {
    reportId: "r2",
    reportDate: "2026-01-20",
    trainerName: "Coach B",
    notes: [
      { type: "social_skills", label: "כישורים חברתיים", details: "Great team player" },
      { type: "pro_candidates", label: "מועמד למקצוענות", details: "Ready for advanced program" },
    ],
  },
];

describe("categorizeNotes", () => {
  it("separates strengths, weaknesses, and social skills", () => {
    const result = categorizeNotes(mockNotes);

    expect(result.strengths).toHaveLength(2);
    expect(result.strengths[0].text).toContain("Great speed improvement");
    expect(result.strengths[1].text).toContain("Ready for advanced program");

    expect(result.weaknesses).toHaveLength(1);
    expect(result.weaknesses[0].text).toContain("Needs flexibility work");

    expect(result.socialSkills).toHaveLength(1);
    expect(result.socialSkills[0].text).toContain("Great team player");
  });

  it("returns empty arrays for no notes", () => {
    const result = categorizeNotes([]);
    expect(result.strengths).toHaveLength(0);
    expect(result.weaknesses).toHaveLength(0);
    expect(result.socialSkills).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm run test:run -- src/features/player-report/lib/utils/__tests__/aggregate-notes.test.ts
```

- [ ] **Step 3: Implement aggregate-notes**

```typescript
import type { TraineeReportNotes } from "@/lib/utils/trainee-notes";

export interface ReportBulletItem {
  readonly id: string;
  readonly text: string;
  readonly source: string; // "trainer name - date"
  readonly category: string;
}

interface CategorizedNotes {
  readonly strengths: readonly ReportBulletItem[];
  readonly weaknesses: readonly ReportBulletItem[];
  readonly socialSkills: readonly ReportBulletItem[];
}

const STRENGTH_CATEGORIES = new Set(["achievements", "pro_candidates"]);
const WEAKNESS_CATEGORIES = new Set([
  "limitations",
  "injuries",
  "discipline",
  "mental_state",
  "complaints",
  "insufficient_attention",
]);
const SOCIAL_CATEGORIES = new Set(["social_skills"]);

export function categorizeNotes(
  reportNotes: readonly TraineeReportNotes[],
): CategorizedNotes {
  const strengths: ReportBulletItem[] = [];
  const weaknesses: ReportBulletItem[] = [];
  const socialSkills: ReportBulletItem[] = [];

  for (const report of reportNotes) {
    const source = `${report.trainerName} - ${new Date(report.reportDate).toLocaleDateString("he-IL")}`;

    for (const note of report.notes) {
      if (!note.details) continue;

      const item: ReportBulletItem = {
        id: `${report.reportId}-${note.type}`,
        text: note.details,
        source,
        category: note.type,
      };

      if (STRENGTH_CATEGORIES.has(note.type)) {
        strengths.push(item);
      } else if (WEAKNESS_CATEGORIES.has(note.type)) {
        weaknesses.push(item);
      } else if (SOCIAL_CATEGORIES.has(note.type)) {
        socialSkills.push(item);
      }
    }
  }

  return { strengths, weaknesses, socialSkills };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm run test:run -- src/features/player-report/lib/utils/__tests__/aggregate-notes.test.ts
```

- [ ] **Step 5: Create barrel exports**

Create `src/features/player-report/lib/utils/index.ts`:

```typescript
export { categorizeNotes, type ReportBulletItem } from "./aggregate-notes";
```

- [ ] **Step 6: Commit**

```bash
git add src/features/player-report/
git commit -m "feat(player-report): add aggregate-notes utility with tests"
```

---

### Task 3.3: Create report data fetching action

**Files:**

- Create: `src/features/player-report/lib/actions/get-report-data.ts`

**Context:** Server action using `"use server"` directive. Auth via `verifyAdminOrTrainer()`. Fetches profile, assessments, stats, shift report notes, attendance, and latest summary. Returns all data needed for the report editor.

- [ ] **Step 1: Create the feature types**

Create `src/features/player-report/types/index.ts`:

```typescript
import type { PlayerAssessment } from "@/types/assessment";
import type { TraineeSummary } from "@/types/database";
import type { ReportBulletItem } from "../lib/utils/aggregate-notes";

export interface TraineeAttendance {
  readonly totalSessions: number;
  readonly weeklyAverage: number;
  readonly sessions: readonly {
    readonly date: string;
    readonly className: string | null;
  }[];
}

export interface ReportData {
  readonly profile: {
    readonly id: string;
    readonly full_name: string | null;
    readonly birthdate: string | null;
    readonly position: string | null;
    readonly club: string | null;
    readonly avatar_url: string | null;
    readonly created_at: string;
  };
  readonly assessments: readonly PlayerAssessment[];
  readonly stats: {
    readonly overall_rating: number;
    readonly pace: number;
    readonly shooting: number;
    readonly passing: number;
    readonly dribbling: number;
    readonly defending: number;
    readonly physical: number;
  } | null;
  readonly attendance: TraineeAttendance | null;
  readonly strengths: readonly ReportBulletItem[];
  readonly weaknesses: readonly ReportBulletItem[];
  readonly socialSkills: readonly ReportBulletItem[];
  readonly latestSummary: TraineeSummary | null;
}
```

- [ ] **Step 2: Implement the get-report-data action**

```typescript
"use server";

import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { isValidUUID } from "@/lib/validations/common";
import { createClient } from "@/lib/supabase/server";
import { fetchEntranceReport, calculateWeeklyAverage } from "@/lib/arbox/reports";
import { extractTraineeNotes } from "@/lib/utils/trainee-notes";
import { categorizeNotes } from "../utils/aggregate-notes";
import type { ReportData, TraineeAttendance } from "../../types";

export async function getReportData(
  userId: string,
  fromDate: string,
  toDate: string,
): Promise<{ error: string | null; data: ReportData | null }> {
  if (!isValidUUID(userId)) {
    return { error: "Invalid user ID", data: null };
  }

  const auth = await verifyAdminOrTrainer();
  if (auth.error) {
    return { error: auth.error, data: null };
  }

  const supabase = await createClient();

  // Fetch profile
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, birthdate, position, club, avatar_url, created_at, arbox_user_id")
    .eq("id", userId)
    .single();

  if (profileError || !profile) {
    return { error: "User not found", data: null };
  }

  // Fetch assessments (all, sorted newest first)
  const { data: assessments } = await supabase
    .from("player_assessments")
    .select("*")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("assessment_date", { ascending: false });

  // Fetch latest stats
  const { data: stats } = await supabase
    .from("player_stats")
    .select("overall_rating, pace, shooting, passing, dribbling, defending, physical")
    .eq("user_id", userId)
    .single();

  // Fetch shift reports mentioning this trainee in date range
  const { data: shiftReports } = await supabase
    .from("trainer_shift_reports")
    .select("*")
    .gte("report_date", fromDate)
    .lte("report_date", toDate)
    .order("report_date", { ascending: false });

  const notes = extractTraineeNotes(
    (shiftReports ?? []) as never[],
    userId,
  );
  const { strengths, weaknesses, socialSkills } = categorizeNotes(notes);

  // Fetch attendance from Arbox (graceful fallback)
  let attendance: TraineeAttendance | null = null;
  if (profile.arbox_user_id) {
    try {
      const entranceData = await fetchEntranceReport(fromDate, toDate);
      const userEntries = entranceData.filter(
        (e) => e.user_id === profile.arbox_user_id,
      );
      attendance = {
        totalSessions: userEntries.length,
        weeklyAverage: calculateWeeklyAverage(userEntries.length, fromDate, toDate),
        sessions: userEntries.map((e) => ({
          date: e.date,
          className: e.class_name,
        })),
      };
    } catch {
      // Arbox API failure is non-blocking
      attendance = null;
    }
  }

  // Fetch latest summary
  const { data: latestSummary } = await supabase
    .from("trainee_summaries")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return {
    error: null,
    data: {
      profile: {
        id: profile.id,
        full_name: profile.full_name,
        birthdate: profile.birthdate,
        position: profile.position,
        club: profile.club,
        avatar_url: profile.avatar_url,
        created_at: profile.created_at,
      },
      assessments: assessments ?? [],
      stats: stats ?? null,
      attendance,
      strengths,
      weaknesses,
      socialSkills,
      latestSummary: latestSummary ?? null,
    },
  };
}
```

- [ ] **Step 3: Run type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/features/player-report/
git commit -m "feat(player-report): add report data fetching action and types"
```

---

### Task 3.4: Create save-summary action

**Files:**

- Create: `src/features/player-report/lib/actions/save-summary.ts`

- [ ] **Step 1: Implement save-summary action**

```typescript
"use server";

import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { isValidUUID } from "@/lib/validations/common";
import { createClient } from "@/lib/supabase/server";

export async function saveSummary(
  userId: string,
  summary: string,
): Promise<{ error: string | null }> {
  if (!isValidUUID(userId)) {
    return { error: "Invalid user ID" };
  }

  if (!summary.trim()) {
    return { error: "Summary cannot be empty" };
  }

  const auth = await verifyAdminOrTrainer();
  if (auth.error) {
    return { error: auth.error };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("trainee_summaries")
    .insert({
      user_id: userId,
      author_id: auth.user!.id,
      summary: summary.trim(),
    });

  if (error) {
    return { error: "Failed to save summary" };
  }

  return { error: null };
}
```

- [ ] **Step 2: Create barrel exports for actions**

Create `src/features/player-report/lib/actions/index.ts`:

```typescript
export { getReportData } from "./get-report-data";
export { saveSummary } from "./save-summary";
```

- [ ] **Step 3: Run type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/features/player-report/lib/actions/
git commit -m "feat(player-report): add save-summary action"
```

---

## Chunk 4: Charts & Profile Page

### Task 4.1: Create RadarStatsChart component

**Files:**

- Create: `src/features/progress-charts/components/RadarStatsChart.tsx`

**Context:** Uses Recharts `RadarChart`. Follow the existing chart component pattern: use `ChartContainer` from `src/components/ui/chart.tsx`, Hebrew labels from `RATING_LABELS_HE`, colors from `RATING_COLORS` in `metric-definitions.ts`. Charts use `dir="ltr"` override within RTL layout.

- [ ] **Step 1: Create the RadarStatsChart component**

```tsx
"use client";

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
} from "recharts";
import { RATING_LABELS_HE } from "../lib/config/metric-definitions";

interface RadarStatsChartProps {
  stats: {
    pace: number;
    shooting: number;
    passing: number;
    dribbling: number;
    defending: number;
    physical: number;
  };
  height?: number;
}

const STAT_KEYS = ["pace", "shooting", "passing", "dribbling", "defending", "physical"] as const;

export function RadarStatsChart({ stats, height = 300 }: RadarStatsChartProps) {
  const data = STAT_KEYS.map((key) => ({
    stat: RATING_LABELS_HE[key],
    value: stats[key],
    fullMark: 99,
  }));

  return (
    <div dir="ltr" style={{ width: "100%", height }}>
      <ResponsiveContainer width="100%" height="100%">
        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={data}>
          <PolarGrid />
          <PolarAngleAxis
            dataKey="stat"
            tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 99]}
            tick={{ fontSize: 10 }}
          />
          <Radar
            name="Stats"
            dataKey="value"
            stroke="hsl(142, 76%, 36%)"
            fill="hsl(142, 76%, 36%)"
            fillOpacity={0.3}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
```

- [ ] **Step 2: Export from progress-charts index**

Update `src/features/progress-charts/components/index.ts` to include:

```typescript
export { RadarStatsChart } from "./RadarStatsChart";
```

- [ ] **Step 3: Run type check and dev server**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/features/progress-charts/components/RadarStatsChart.tsx src/features/progress-charts/components/index.ts
git commit -m "feat(charts): add RadarStatsChart component for EA FC stats"
```

---

### Task 4.2: Add charts and "Generate Report" button to admin trainee profile page

**Files:**

- Modify: `src/app/admin/users/[userId]/page.tsx`

**Context:** Page is 195 lines, async server component with `lg:grid-cols-3` layout. Main area (col-span-2) has UserEditForm, TraineeNotesCard, UserActionsCard. Add charts section and generate report button for trainees.

- [ ] **Step 1: Add "Generate Report" button**

Add a link button near the top of the page (in the header area, after breadcrumbs) for trainee users:

```tsx
{userToEdit.role === "trainee" && (
  <Link href={`/admin/reports/generate/${userToEdit.id}`}>
    <Button variant="outline">
      <FileText className="h-4 w-4 ml-2" />
      הפקת סיכום שחקן
    </Button>
  </Link>
)}
```

Import `FileText` from `lucide-react` and `Link` from `next/link`.

- [ ] **Step 2: Add RadarStatsChart to the sidebar**

Fetch player stats in the server component and render the radar chart in the sidebar (below the summary card):

```tsx
{userToEdit.role === "trainee" && stats && (
  <Card>
    <CardHeader>
      <CardTitle>דירוג שחקן</CardTitle>
    </CardHeader>
    <CardContent>
      <RadarStatsChartWrapper stats={stats} />
    </CardContent>
  </Card>
)}
```

Create a thin client wrapper for the dynamic import (SSR disabled, same pattern as `MiniRatingChartWrapper`):

```tsx
// src/app/admin/users/[userId]/RadarStatsChartWrapper.tsx
"use client";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

const RadarStatsChart = dynamic(
  () => import("@/features/progress-charts/components/RadarStatsChart").then((m) => m.RadarStatsChart),
  { ssr: false, loading: () => <Skeleton className="h-[300px]" /> }
);

interface Props {
  stats: {
    pace: number;
    shooting: number;
    passing: number;
    dribbling: number;
    defending: number;
    physical: number;
  };
}

export function RadarStatsChartWrapper({ stats }: Props) {
  return <RadarStatsChart stats={stats} />;
}
```

- [ ] **Step 3: Fetch player stats in the page server component**

Add after existing data fetches:

```typescript
const { data: stats } = await supabase
  .from("player_stats")
  .select("pace, shooting, passing, dribbling, defending, physical")
  .eq("user_id", userToEdit.id)
  .single();
```

- [ ] **Step 4: Verify in browser**

Navigate to `/admin/users/[trainee-id]`, check:
- "Generate Report" button visible
- Radar chart renders in sidebar (if trainee has stats)

- [ ] **Step 5: Run type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/users/
git commit -m "feat(admin): add radar chart and generate report button to trainee profile"
```

---

## Chunk 5: Report Editor Page & PDF Generation

### Task 5.1: Create the report editor page route

**Files:**

- Create: `src/app/admin/reports/generate/[userId]/page.tsx`

**Context:** Server component that validates auth, fetches initial data, and renders the client-side `ReportEditor`. Follows the pattern of `src/app/admin/users/[userId]/page.tsx`. Default date range: last 3 months.

- [ ] **Step 1: Create the page**

```tsx
import { redirect } from "next/navigation";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { isValidUUID } from "@/lib/validations/common";
import { getReportData } from "@/features/player-report/lib/actions";
import { ReportEditor } from "@/features/player-report/components/ReportEditor";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

interface PageProps {
  params: Promise<{ userId: string }>;
}

export default async function GenerateReportPage({ params }: PageProps) {
  const { userId } = await params;

  if (!isValidUUID(userId)) {
    redirect("/admin/users");
  }

  const auth = await verifyAdminOrTrainer();
  if (auth.error) {
    redirect("/auth/login");
  }

  // Default date range: last 3 months
  const toDate = new Date().toISOString().split("T")[0];
  const fromDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const { data, error } = await getReportData(userId, fromDate, toDate);

  if (error || !data) {
    redirect("/admin/users");
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-muted-foreground">
        <Link href="/admin/users" className="hover:text-foreground">
          ניהול משתמשים
        </Link>
        <ArrowRight className="h-4 w-4 rotate-180" />
        <Link
          href={`/admin/users/${userId}`}
          className="hover:text-foreground"
        >
          {data.profile.full_name ?? "שחקן"}
        </Link>
        <ArrowRight className="h-4 w-4 rotate-180" />
        <span>הפקת סיכום שחקן</span>
      </div>

      <ReportEditor
        initialData={data}
        userId={userId}
        initialFromDate={fromDate}
        initialToDate={toDate}
      />
    </div>
  );
}
```

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit
```

(Will fail until ReportEditor component exists -- that's fine, proceed to next task.)

- [ ] **Step 3: Commit page route**

```bash
git add src/app/admin/reports/
git commit -m "feat(player-report): add report editor page route"
```

---

### Task 5.2: Create report editor components

**Files:**

- Create: `src/features/player-report/components/ReportEditor.tsx`
- Create: `src/features/player-report/components/ReportDetailsSection.tsx`
- Create: `src/features/player-report/components/ReportAssessmentsTable.tsx`
- Create: `src/features/player-report/components/ReportChartsSection.tsx`
- Create: `src/features/player-report/components/ReportBulletList.tsx`
- Create: `src/features/player-report/components/ReportSummarySection.tsx`
- Create: `src/features/player-report/components/index.ts`

**This is the largest task. Build each component, then wire them together in ReportEditor.**

- [ ] **Step 5.2.1: Create ReportBulletList (reusable editable bullet list)**

This is the shared component used by strengths, weaknesses, and social skills sections.

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, X } from "lucide-react";

export interface BulletItem {
  readonly id: string;
  readonly text: string;
}

interface ReportBulletListProps {
  title: string;
  items: readonly BulletItem[];
  onChange: (items: readonly BulletItem[]) => void;
  emptyMessage?: string;
  headerClassName?: string;
}

export function ReportBulletList({
  title,
  items,
  onChange,
  emptyMessage = "אין נתונים לתקופה זו",
  headerClassName,
}: ReportBulletListProps) {
  const [newText, setNewText] = useState("");

  const handleAdd = () => {
    if (!newText.trim()) return;
    const newItem: BulletItem = {
      id: `manual-${Date.now()}`,
      text: newText.trim(),
    };
    onChange([...items, newItem]);
    setNewText("");
  };

  const handleRemove = (id: string) => {
    onChange(items.filter((item) => item.id !== id));
  };

  const handleEdit = (id: string, text: string) => {
    onChange(items.map((item) => (item.id === id ? { ...item, text } : item)));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className={headerClassName}>{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 && (
          <p className="text-muted-foreground text-sm">{emptyMessage}</p>
        )}
        <ul className="space-y-2">
          {items.map((item) => (
            <li key={item.id} className="flex items-start gap-2">
              <span className="mt-2 h-1.5 w-1.5 rounded-full bg-foreground shrink-0" />
              <Input
                value={item.text}
                onChange={(e) => handleEdit(item.id, e.target.value)}
                className="flex-1"
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleRemove(item.id)}
                className="shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
        <div className="flex gap-2">
          <Input
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            placeholder="הוסף פריט..."
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          />
          <Button variant="outline" size="icon" onClick={handleAdd}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5.2.2: Create ReportDetailsSection**

```tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import type { ReportData } from "../types";

interface ReportDetailsSectionProps {
  profile: ReportData["profile"];
  attendance: ReportData["attendance"];
}

export function ReportDetailsSection({
  profile,
  attendance,
}: ReportDetailsSectionProps) {
  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString("he-IL");

  const details = [
    { label: "שם השחקן", value: profile.full_name },
    { label: "תאריך לידה", value: profile.birthdate ? formatDate(profile.birthdate) : null },
    { label: "עמדה", value: profile.position },
    { label: "מועדון / קבוצה", value: profile.club },
    { label: "תאריך הצטרפות", value: formatDate(profile.created_at) },
    {
      label: "תדירות הגעה בממוצע",
      value: attendance
        ? `${attendance.weeklyAverage.toFixed(2)} בשבוע`
        : "N/A",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>פרטי שחקן</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-start gap-6">
          <Avatar className="h-24 w-24">
            <AvatarImage src={profile.avatar_url ?? undefined} />
            <AvatarFallback>
              {profile.full_name?.charAt(0) ?? "?"}
            </AvatarFallback>
          </Avatar>
          <dl className="grid grid-cols-2 gap-x-8 gap-y-2 flex-1">
            {details.map(({ label, value }) => (
              <div key={label}>
                <dt className="text-sm text-muted-foreground">{label}</dt>
                <dd className="font-medium">{value ?? "---"}</dd>
              </div>
            ))}
          </dl>
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5.2.3: Create ReportAssessmentsTable**

```tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ASSESSMENT_LABELS_HE } from "@/types/assessment";
import type { PlayerAssessment } from "@/types/assessment";

interface ReportAssessmentsTableProps {
  assessments: readonly PlayerAssessment[];
}

const METRIC_ROWS: { key: keyof PlayerAssessment; label: string }[] = [
  { key: "sprint_5m", label: ASSESSMENT_LABELS_HE.sprint_5m },
  { key: "sprint_10m", label: ASSESSMENT_LABELS_HE.sprint_10m },
  { key: "sprint_20m", label: ASSESSMENT_LABELS_HE.sprint_20m },
  { key: "jump_2leg_height", label: ASSESSMENT_LABELS_HE.jump_2leg_height },
  { key: "jump_2leg_distance", label: ASSESSMENT_LABELS_HE.jump_2leg_distance },
  { key: "jump_right_leg", label: ASSESSMENT_LABELS_HE.jump_right_leg },
  { key: "jump_left_leg", label: ASSESSMENT_LABELS_HE.jump_left_leg },
  { key: "blaze_spot_time", label: ASSESSMENT_LABELS_HE.blaze_spot_time },
  { key: "kick_power_kaiser", label: ASSESSMENT_LABELS_HE.kick_power_kaiser },
  { key: "flexibility_ankle", label: ASSESSMENT_LABELS_HE.flexibility_ankle },
  { key: "flexibility_knee", label: ASSESSMENT_LABELS_HE.flexibility_knee },
  { key: "flexibility_hip", label: ASSESSMENT_LABELS_HE.flexibility_hip },
  { key: "coordination", label: ASSESSMENT_LABELS_HE.coordination },
  { key: "body_structure", label: ASSESSMENT_LABELS_HE.body_structure },
  { key: "leg_power_technique", label: ASSESSMENT_LABELS_HE.leg_power_technique },
];

export function ReportAssessmentsTable({
  assessments,
}: ReportAssessmentsTableProps) {
  // Show two most recent
  const recent = assessments.slice(0, 2);

  if (recent.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>מבדקים גופניים</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">אין מבדקים עדיין</p>
        </CardContent>
      </Card>
    );
  }

  const formatDate = (d: string) => new Date(d).toLocaleDateString("he-IL");

  return (
    <Card>
      <CardHeader>
        <CardTitle>מבדקים גופניים</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">מדד</TableHead>
              {recent.map((a) => (
                <TableHead key={a.id} className="text-right">
                  {formatDate(a.assessment_date)}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {METRIC_ROWS.map(({ key, label }) => (
              <TableRow key={key}>
                <TableCell className="font-medium">{label}</TableCell>
                {recent.map((a) => (
                  <TableCell key={a.id}>
                    {(a[key] as string | number | null) ?? "---"}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5.2.4: Create ReportChartsSection**

```tsx
"use client";

import { useRef } from "react";
import dynamic from "next/dynamic";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { ReportData } from "../types";
import type { PlayerAssessment } from "@/types/assessment";

const RadarStatsChart = dynamic(
  () =>
    import("@/features/progress-charts/components/RadarStatsChart").then(
      (m) => m.RadarStatsChart,
    ),
  { ssr: false, loading: () => <Skeleton className="h-[300px]" /> },
);

const AssessmentProgressCharts = dynamic(
  () =>
    import(
      "@/features/progress-charts/components/AssessmentProgressCharts"
    ).then((m) => m.AssessmentProgressCharts),
  { ssr: false, loading: () => <Skeleton className="h-[400px]" /> },
);

interface ReportChartsSectionProps {
  stats: ReportData["stats"];
  assessments: readonly PlayerAssessment[];
  radarRef: React.RefObject<HTMLDivElement | null>;
  trendsRef: React.RefObject<HTMLDivElement | null>;
}

export function ReportChartsSection({
  stats,
  assessments,
  radarRef,
  trendsRef,
}: ReportChartsSectionProps) {
  return (
    <div className="space-y-4">
      {/* Radar Chart */}
      {stats && (
        <Card>
          <CardHeader>
            <CardTitle>דירוג שחקן</CardTitle>
          </CardHeader>
          <CardContent>
            <div ref={radarRef}>
              <RadarStatsChart stats={stats} height={350} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trend Charts */}
      {assessments.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>מגמות התפתחות</CardTitle>
          </CardHeader>
          <CardContent>
            <div ref={trendsRef}>
              <AssessmentProgressCharts
                assessments={assessments as PlayerAssessment[]}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 5.2.5: Create ReportSummarySection**

```tsx
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";
import { saveSummary } from "../lib/actions";
import { toast } from "sonner";

interface ReportSummarySectionProps {
  userId: string;
  initialSummary: string;
  onSummaryChange: (summary: string) => void;
}

export function ReportSummarySection({
  userId,
  initialSummary,
  onSummaryChange,
}: ReportSummarySectionProps) {
  const [summary, setSummary] = useState(initialSummary);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!summary.trim()) return;
    setSaving(true);
    const { error } = await saveSummary(userId, summary);
    setSaving(false);
    if (error) {
      toast.error(error);
    } else {
      toast.success("הסיכום נשמר בהצלחה");
    }
  };

  const handleChange = (value: string) => {
    setSummary(value);
    onSummaryChange(value);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>סיכום / הערות נוספות</CardTitle>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSave}
          disabled={saving || !summary.trim()}
        >
          <Save className="h-4 w-4 ml-2" />
          {saving ? "שומר..." : "שמור סיכום"}
        </Button>
      </CardHeader>
      <CardContent>
        <Textarea
          value={summary}
          onChange={(e) => handleChange(e.target.value)}
          placeholder="כתוב סיכום כללי על השחקן..."
          rows={8}
          className="resize-y"
        />
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5.2.6: Create ReportEditor (main orchestrator)**

```tsx
"use client";

import { useState, useRef, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2 } from "lucide-react";
import { ReportDetailsSection } from "./ReportDetailsSection";
import { ReportAssessmentsTable } from "./ReportAssessmentsTable";
import { ReportChartsSection } from "./ReportChartsSection";
import { ReportBulletList, type BulletItem } from "./ReportBulletList";
import { ReportSummarySection } from "./ReportSummarySection";
import { PlayerReportPdfButton } from "./PlayerReportPdfButton";
import { getReportData } from "../lib/actions";
import type { ReportData } from "../types";
import type { PlayerAssessment } from "@/types/assessment";

interface ReportEditorProps {
  initialData: ReportData;
  userId: string;
  initialFromDate: string;
  initialToDate: string;
}

export function ReportEditor({
  initialData,
  userId,
  initialFromDate,
  initialToDate,
}: ReportEditorProps) {
  const [data, setData] = useState(initialData);
  const [fromDate, setFromDate] = useState(initialFromDate);
  const [toDate, setToDate] = useState(initialToDate);
  const [isPending, startTransition] = useTransition();

  const [strengths, setStrengths] = useState<readonly BulletItem[]>(
    initialData.strengths.map((s) => ({ id: s.id, text: s.text })),
  );
  const [weaknesses, setWeaknesses] = useState<readonly BulletItem[]>(
    initialData.weaknesses.map((w) => ({ id: w.id, text: w.text })),
  );
  const [socialSkills, setSocialSkills] = useState<readonly BulletItem[]>(
    initialData.socialSkills.map((s) => ({ id: s.id, text: s.text })),
  );
  const [summary, setSummary] = useState(
    initialData.latestSummary?.summary ?? "",
  );

  const radarRef = useRef<HTMLDivElement>(null);
  const trendsRef = useRef<HTMLDivElement>(null);

  const handleDateRangeChange = () => {
    startTransition(async () => {
      const { data: newData } = await getReportData(userId, fromDate, toDate);
      if (newData) {
        setData(newData);
        setStrengths(newData.strengths.map((s) => ({ id: s.id, text: s.text })));
        setWeaknesses(newData.weaknesses.map((w) => ({ id: w.id, text: w.text })));
        setSocialSkills(newData.socialSkills.map((s) => ({ id: s.id, text: s.text })));
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Header with date range */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h1 className="text-2xl font-bold">
          סיכום פעילות שחקן - {data.profile.full_name}
        </h1>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Label htmlFor="fromDate">מ-</Label>
            <Input
              id="fromDate"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="w-auto"
            />
            <Label htmlFor="toDate">עד</Label>
            <Input
              id="toDate"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="w-auto"
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleDateRangeChange}
              disabled={isPending}
            >
              {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "עדכן"}
            </Button>
          </div>
        </div>
      </div>

      {/* Generate PDF button */}
      <div className="flex justify-end">
        <PlayerReportPdfButton
          data={data}
          strengths={strengths}
          weaknesses={weaknesses}
          socialSkills={socialSkills}
          summary={summary}
          radarRef={radarRef}
          trendsRef={trendsRef}
        />
      </div>

      {/* Details */}
      <ReportDetailsSection
        profile={data.profile}
        attendance={data.attendance}
      />

      {/* Assessments */}
      <ReportAssessmentsTable
        assessments={data.assessments}
      />

      {/* Charts */}
      <ReportChartsSection
        stats={data.stats}
        assessments={data.assessments as PlayerAssessment[]}
        radarRef={radarRef}
        trendsRef={trendsRef}
      />

      {/* Strengths */}
      <ReportBulletList
        title="נקודות חוזקה / פרמטרים ששופרו"
        items={strengths}
        onChange={setStrengths}
        headerClassName="text-green-600"
      />

      {/* Weaknesses */}
      <ReportBulletList
        title="מיקוד לשיפור בהמשך התהליך"
        items={weaknesses}
        onChange={setWeaknesses}
        headerClassName="text-amber-600"
      />

      {/* Social Skills */}
      <ReportBulletList
        title="כישורים חברתיים"
        items={socialSkills}
        onChange={setSocialSkills}
        headerClassName="text-indigo-600"
      />

      {/* Summary */}
      <ReportSummarySection
        userId={userId}
        initialSummary={initialData.latestSummary?.summary ?? ""}
        onSummaryChange={setSummary}
      />
    </div>
  );
}
```

- [ ] **Step 5.2.7: Create barrel export**

Create `src/features/player-report/components/index.ts`:

```typescript
export { ReportEditor } from "./ReportEditor";
```

Create `src/features/player-report/index.ts`:

```typescript
export { ReportEditor } from "./components";
export type { ReportData } from "./types";
```

- [ ] **Step 5.2.8: Run type check**

```bash
npx tsc --noEmit
```

(Will have errors for `PlayerReportPdfButton` which doesn't exist yet -- proceed to next task.)

- [ ] **Step 5.2.9: Commit**

```bash
git add src/features/player-report/components/ src/features/player-report/index.ts
git commit -m "feat(player-report): add report editor components"
```

---

### Task 5.3: Create chart snapshot utility

**Files:**

- Create: `src/features/player-report/lib/utils/chart-snapshot.ts`

- [ ] **Step 1: Implement chart snapshot utility**

```typescript
import { toPng } from "html-to-image";

export async function captureChartAsImage(
  element: HTMLElement | null,
): Promise<string | null> {
  if (!element) return null;

  try {
    const dataUrl = await toPng(element, {
      pixelRatio: 2,
      backgroundColor: "#ffffff",
    });
    return dataUrl;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Export from utils index**

Update `src/features/player-report/lib/utils/index.ts`:

```typescript
export { categorizeNotes, type ReportBulletItem } from "./aggregate-notes";
export { captureChartAsImage } from "./chart-snapshot";
```

- [ ] **Step 3: Commit**

```bash
git add src/features/player-report/lib/utils/
git commit -m "feat(player-report): add chart snapshot utility using html-to-image"
```

---

### Task 5.4: Create PDF template and download button

**Files:**

- Create: `src/lib/exports/pdf-player-report-template.tsx`
- Create: `src/features/player-report/components/PlayerReportPdfButton.tsx`

**Context:** Follow the existing `pdf-assessment-template.tsx` pattern. Uses `@react-pdf/renderer` with Heebo font, RTL via `row-reverse`, brand green. Chart images are embedded via `Image` component from base64 data URLs.

- [ ] **Step 5.4.1: Create the PDF template**

Create `src/lib/exports/pdf-player-report-template.tsx`. This is a large file -- structure it with:
- Font registration (Heebo, same as existing)
- StyleSheet (extending existing patterns)
- `PlayerReportPdfDocument` component with props for all sections
- Page 1: header, details, assessments table
- Page 2: chart images, strengths, weaknesses
- Page 3: social skills, summary, footer

Key props interface:

```typescript
interface PlayerReportPdfDocumentProps {
  playerName: string;
  details: {
    birthdate: string | null;
    position: string | null;
    club: string | null;
    registrationDate: string;
    weeklyAttendance: string;
  };
  assessments: PlayerAssessment[];
  radarChartImage: string | null;
  trendsChartImage: string | null;
  strengths: string[];
  weaknesses: string[];
  socialSkills: string[];
  summary: string;
  generatedAt: string;
}
```

The template follows the existing `pdf-assessment-template.tsx` pattern. Here is the skeleton:

```tsx
import {
  Document, Page, Text, View, Image, StyleSheet, Font,
} from "@react-pdf/renderer";
import type { PlayerAssessment } from "@/types/assessment";

// Re-use existing Heebo font registration from pdf-assessment-template.tsx
Font.register({
  family: "Heebo",
  fonts: [
    { src: "/fonts/Heebo-Regular.ttf", fontWeight: 400 },
    { src: "/fonts/Heebo-Bold.ttf", fontWeight: 700 },
  ],
});

const styles = StyleSheet.create({
  page: { flexDirection: "column", backgroundColor: "#FFFFFF", padding: 30, fontFamily: "Heebo" },
  header: { flexDirection: "row-reverse", justifyContent: "space-between", alignItems: "center", marginBottom: 20, borderBottom: 2, borderBottomColor: "#22c55e", paddingBottom: 15 },
  title: { fontSize: 24, fontWeight: 700, color: "#22c55e", textAlign: "right" },
  subtitle: { fontSize: 14, color: "#6b7280", textAlign: "right", marginTop: 4 },
  detailRow: { flexDirection: "row-reverse", marginBottom: 4 },
  detailLabel: { fontSize: 10, fontWeight: 700, textAlign: "right", width: 140 },
  detailValue: { fontSize: 10, textAlign: "right", flex: 1 },
  avatar: { width: 80, height: 80, borderRadius: 40 },
  sectionTitle: { fontSize: 12, fontWeight: 700, textAlign: "right", marginTop: 15, marginBottom: 5, color: "#22c55e" },
  sectionTitleAmber: { fontSize: 12, fontWeight: 700, textAlign: "right", marginTop: 15, marginBottom: 5, color: "#d97706" },
  sectionTitleIndigo: { fontSize: 12, fontWeight: 700, textAlign: "right", marginTop: 15, marginBottom: 5, color: "#4f46e5" },
  table: { display: "flex", flexDirection: "column", marginTop: 10 },
  tableHeader: { flexDirection: "row-reverse", backgroundColor: "#f3f4f6", paddingVertical: 8, paddingHorizontal: 5, borderBottom: 1, borderBottomColor: "#e5e7eb" },
  tableRow: { flexDirection: "row-reverse", borderBottom: 1, borderBottomColor: "#e5e7eb", paddingVertical: 6, paddingHorizontal: 5 },
  tableCell: { flex: 1, textAlign: "right", fontSize: 9 },
  tableCellHeader: { flex: 1, textAlign: "right", fontSize: 9, fontWeight: 700 },
  bulletItem: { flexDirection: "row-reverse", marginBottom: 3, paddingRight: 10 },
  bulletDot: { fontSize: 10, marginLeft: 5 },
  bulletText: { fontSize: 10, textAlign: "right", flex: 1 },
  chartImage: { width: "100%", marginVertical: 10 },
  summaryText: { fontSize: 10, textAlign: "right", lineHeight: 1.6 },
  footer: { position: "absolute", bottom: 20, left: 30, right: 30, textAlign: "center", fontSize: 8, color: "#9ca3af" },
});

interface PlayerReportPdfDocumentProps {
  playerName: string;
  details: {
    birthdate: string | null;
    position: string | null;
    club: string | null;
    registrationDate: string;
    weeklyAttendance: string;
  };
  assessments: PlayerAssessment[];
  radarChartImage: string | null;
  trendsChartImage: string | null;
  strengths: string[];
  weaknesses: string[];
  socialSkills: string[];
  summary: string;
  generatedAt: string;
}

function BulletList({ items, style }: { items: string[]; style?: object }) {
  return (
    <View>
      {items.map((item, i) => (
        <View key={i} style={styles.bulletItem}>
          <Text style={styles.bulletDot}>●</Text>
          <Text style={styles.bulletText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}:</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

export function PlayerReportPdfDocument({
  playerName, details, assessments, radarChartImage,
  trendsChartImage, strengths, weaknesses, socialSkills,
  summary, generatedAt,
}: PlayerReportPdfDocumentProps) {
  const formatDate = (d: string) => new Date(d).toLocaleDateString("he-IL");
  const recent = assessments.slice(0, 2);

  return (
    <Document>
      {/* Page 1: Details + Assessments */}
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <View>
            <Text style={styles.title}>סיכום פעילות שחקן</Text>
            <Text style={styles.subtitle}>Garden of Eden</Text>
          </View>
        </View>

        <Text style={{ fontSize: 10, textAlign: "right", color: "#6b7280", marginBottom: 10 }}>
          תאריך הסיכום: {generatedAt}
        </Text>

        <DetailRow label="שם השחקן" value={playerName} />
        {details.birthdate && <DetailRow label="תאריך לידה" value={formatDate(details.birthdate)} />}
        {details.position && <DetailRow label="עמדה" value={details.position} />}
        {details.club && <DetailRow label="מועדון / קבוצה" value={details.club} />}
        <DetailRow label="תאריך הצטרפות" value={formatDate(details.registrationDate)} />
        <DetailRow label="תדירות הגעה בממוצע" value={details.weeklyAttendance} />

        {recent.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>מבדקים גופניים</Text>
            {/* Assessment comparison table -- implement rows for each metric */}
            {/* Follow the pattern from pdf-assessment-template.tsx */}
          </>
        )}

        <Text style={styles.footer}>נוצר ב-{generatedAt} | Garden of Eden</Text>
      </Page>

      {/* Page 2: Charts + Strengths + Weaknesses */}
      <Page size="A4" style={styles.page}>
        {radarChartImage && <Image src={radarChartImage} style={styles.chartImage} />}
        {trendsChartImage && <Image src={trendsChartImage} style={styles.chartImage} />}

        {strengths.length > 0 && (
          <>
            <Text style={styles.sectionTitle}>נקודות חוזקה / פרמטרים ששופרו</Text>
            <BulletList items={strengths} />
          </>
        )}

        {weaknesses.length > 0 && (
          <>
            <Text style={styles.sectionTitleAmber}>מיקוד לשיפור בהמשך התהליך</Text>
            <BulletList items={weaknesses} />
          </>
        )}

        <Text style={styles.footer}>נוצר ב-{generatedAt} | Garden of Eden</Text>
      </Page>

      {/* Page 3: Social Skills + Summary (conditional) */}
      {(socialSkills.length > 0 || summary) && (
        <Page size="A4" style={styles.page}>
          {socialSkills.length > 0 && (
            <>
              <Text style={styles.sectionTitleIndigo}>כישורים חברתיים</Text>
              <BulletList items={socialSkills} />
            </>
          )}

          {summary && (
            <>
              <Text style={styles.sectionTitle}>סיכום / הערות נוספות</Text>
              <Text style={styles.summaryText}>{summary}</Text>
            </>
          )}

          <Text style={styles.footer}>נוצר ב-{generatedAt} | Garden of Eden</Text>
        </Page>
      )}
    </Document>
  );
}
```

**Note:** Use `/ui-ux-pro-max` skill during actual implementation to refine the visual design, spacing, colors, and layout. The skeleton above provides the complete structure; the skill will polish it.

- [ ] **Step 5.4.2: Create PlayerReportPdfButton**

```tsx
"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { FileDown, Loader2 } from "lucide-react";
import { pdf } from "@react-pdf/renderer";
import { PlayerReportPdfDocument } from "@/lib/exports/pdf-player-report-template";
import { captureChartAsImage } from "../lib/utils/chart-snapshot";
import type { ReportData } from "../types";
import type { BulletItem } from "./ReportBulletList";

interface PlayerReportPdfButtonProps {
  data: ReportData;
  strengths: readonly BulletItem[];
  weaknesses: readonly BulletItem[];
  socialSkills: readonly BulletItem[];
  summary: string;
  radarRef: React.RefObject<HTMLDivElement | null>;
  trendsRef: React.RefObject<HTMLDivElement | null>;
}

export function PlayerReportPdfButton({
  data,
  strengths,
  weaknesses,
  socialSkills,
  summary,
  radarRef,
  trendsRef,
}: PlayerReportPdfButtonProps) {
  const [generating, setGenerating] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);

    try {
      // Capture chart images
      const radarImage = await captureChartAsImage(radarRef.current);
      const trendsImage = await captureChartAsImage(trendsRef.current);

      const now = new Date().toLocaleDateString("he-IL");

      const doc = (
        <PlayerReportPdfDocument
          playerName={data.profile.full_name ?? "שחקן"}
          details={{
            birthdate: data.profile.birthdate,
            position: data.profile.position,
            club: data.profile.club,
            registrationDate: data.profile.created_at,
            weeklyAttendance: data.attendance
              ? `${data.attendance.weeklyAverage.toFixed(2)} בשבוע`
              : "N/A",
          }}
          assessments={data.assessments as never[]}
          radarChartImage={radarImage}
          trendsChartImage={trendsImage}
          strengths={strengths.map((s) => s.text)}
          weaknesses={weaknesses.map((w) => w.text)}
          socialSkills={socialSkills.map((s) => s.text)}
          summary={summary}
          generatedAt={now}
        />
      );

      const blob = await pdf(doc).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `סיכום-שחקן-${data.profile.full_name ?? "report"}-${now}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Button onClick={handleGenerate} disabled={generating}>
      {generating ? (
        <Loader2 className="h-4 w-4 ml-2 animate-spin" />
      ) : (
        <FileDown className="h-4 w-4 ml-2" />
      )}
      {generating ? "מייצר PDF..." : "הורד PDF"}
    </Button>
  );
}
```

- [ ] **Step 5.4.3: Run type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 5.4.4: Verify end-to-end in browser**

1. Navigate to `/admin/users/[trainee-id]`
2. Click "Generate Report" button
3. Verify report editor page loads with all sections
4. Edit strengths/weaknesses/social skills/summary
5. Click "Download PDF" and verify PDF generates and downloads

- [ ] **Step 5.4.5: Run build**

```bash
npm run build
```

- [ ] **Step 5.4.6: Commit**

```bash
git add src/lib/exports/pdf-player-report-template.tsx src/features/player-report/
git commit -m "feat(player-report): add PDF template and download button"
```

---

### Task 5.5: Final integration and cleanup

- [ ] **Step 1: Run full type check**

```bash
npx tsc --noEmit
```

- [ ] **Step 2: Run linter**

```bash
npm run lint
```

- [ ] **Step 3: Run tests**

```bash
npm run test:run
```

- [ ] **Step 4: Run production build**

```bash
npm run build
```

- [ ] **Step 5: Manual testing checklist**

- [ ] Social skills question appears in end-of-shift form Step 3
- [ ] Club field appears in user edit form
- [ ] "Generate Report" button on trainee profile page
- [ ] Report editor page loads with all data
- [ ] Date range picker works (re-fetches data)
- [ ] Editable bullet lists (add, remove, edit items)
- [ ] Summary save button works
- [ ] Radar chart renders on admin trainee profile
- [ ] Charts render in report editor
- [ ] PDF downloads with all sections
- [ ] PDF is RTL with Hebrew text
- [ ] Empty states handled (no assessments, no notes, no Arbox data)

- [ ] **Step 6: Commit any remaining fixes**

```bash
git add -A
git commit -m "feat(player-report): final integration and cleanup"
```
