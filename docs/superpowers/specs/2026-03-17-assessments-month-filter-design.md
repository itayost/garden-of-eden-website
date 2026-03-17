# Assessment Month Filter — Design Spec

**Date:** 2026-03-17
**Status:** Approved

## Overview

Add month-based filtering to the admin/trainer assessments page. When a month is selected, each trainee is classified as having a **full assessment** (100% complete), **partial assessment** (1–99%), or **no assessment** for that month. Trainers can filter the table by status and drill into partial assessments to see exactly which sections are done and which are missing.

---

## Requirements

1. A month/year picker on the assessments page lets trainers select a specific month.
2. When a month is selected, three summary cards replace the global stats: full / partial / no assessment counts. Each card is clickable and filters the table. Counts always reflect the full dataset (all trainees matching search/age-group) — computed before `statusFilter` is applied so they stay stable while the user switches filters.
3. The table shows all trainees with a status column (מלא / חלקי / חסר) and status filter pills (הכל | מלא | חלקי | חסר).
4. For partial assessments, clicking the `%` badge opens a popover showing section-level done/missing. A "פרטים" button opens a full dialog with all 6 sections and a "השלם מבדק" action button. Full and none rows do not show these controls.
5. When no month is selected, the page behaves exactly as it does today.

---

## Definitions

- **Full assessment**: `getAssessmentCompleteness()` returns `100`. The function counts **15 total fields**: sprints ×3 (`sprint_5m`, `sprint_10m`, `sprint_20m`) + jumps ×4 (`jump_2leg_distance`, `jump_right_leg`, `jump_left_leg`, `jump_2leg_height`) + agility/flexibility ×4 (`blaze_spot_time`, `flexibility_ankle`, `flexibility_knee`, `flexibility_hip`) + power ×1 (`kick_power_kaiser`) + categorical ×3 (`coordination`, `leg_power_technique`, `body_structure`). The `%` badge denominator is always 15. The DB row is passed directly to `getAssessmentCompleteness` (which accepts `Partial<PlayerAssessment>`).
- **Partial assessment**: completeness is `1`–`99`. **Exception:** a row that exists in the DB but has all 15 fields null (completeness = 0) is also treated as `partial` — a record exists for that trainee in the month. The `0%` badge for such a row is clickable and opens the popover (showing all sections as 0/N).
- **No assessment**: no `player_assessments` row exists for the trainee in the selected month.
- **Section completeness**: per-section count of filled vs total fields across all 6 `ASSESSMENT_SECTIONS`. For quantitative fields: a field is "completed" if non-null. For mental text fields: "completed" if non-null and non-empty string; `total` = 5. Mental fields do **not** contribute to the overall `%`. In the popover, the mental section shows ✓ if `completed > 0` — **intentionally asymmetric** with quantitative sections (any note present = section considered started). Quantitative sections show ✓ only when `completed === total`.

---

## Architecture

```
page.tsx  (server component)
  └── AssessmentsContent  (client wrapper — new)
        ├── [no month]  global summary cards + AssessmentsTable  (existing, props unchanged)
        └── [month set]  AssessmentsMonthView  (new, renders own toolbar)
                           ├── month summary cards (clickable)
                           ├── status filter pills
                           └── month table
```

**Toolbar ownership:** `AssessmentsTable` owns its own search + age-group toolbar (unchanged). When month is set, `AssessmentsTable` is not rendered — `AssessmentsMonthView` renders its own `TableToolbar` (reusing the existing `TableToolbar` + `ToolbarSelect` components) reading the same URL params `q` and `age` via `useQueryState`. There is never more than one toolbar on screen at a time.

**Initial data strategy:** `page.tsx` signature changes to receive `searchParams` (Next.js 16 async pattern — `searchParams: Promise<{ month?: string; [key: string]: string | string[] | undefined }>`; must be `await`ed before use). If `month` is absent, `page.tsx` calls `getAssessmentsPaginated` and passes the full `AssessmentsPaginatedResult` as `initialData` to `AssessmentsContent`. If `month` is present, `page.tsx` skips the call (no wasted DB query) and passes `initialData={null}`.

`AssessmentsContent` uses `initialData` as follows:
- When `month` is null: renders global summary cards using `initialData.total`, `initialData.traineesWithAssessments`, `initialData.totalAssessments` (same three cards as today), then renders `AssessmentsTable` with `initialProfiles`, `initialAssessmentsByUser`, `initialTotal`. Falls back to zeros when `initialData` is null.
- When `month` is set: renders `AssessmentsMonthView` — `initialData` is not used.

`AssessmentsTable` props interface is unchanged.

---

## Data Model

### New types — `src/types/assessment.ts`

```typescript
export type AssessmentMonthStatus = 'full' | 'partial' | 'none';

// Explicit literal union (AssessmentSection['key'] resolves to string — no narrowing benefit)
export interface SectionCompleteness {
  key: 'sprints' | 'jumps' | 'agility' | 'categorical' | 'power' | 'mental';
  title: string;     // Hebrew label from ASSESSMENT_SECTIONS
  completed: number; // non-null fields (quantitative) or non-null/non-empty strings (mental)
  total: number;     // total fields per ASSESSMENT_SECTIONS
}
```

### New server action — `src/lib/actions/admin-assessments-month.ts`

```typescript
export interface AssessmentMonthParams {
  month: number;      // 1–12
  year: number;
  search?: string;
  ageGroupId?: string;
  statusFilter?: AssessmentMonthStatus | 'all';
  page: number;
  pageSize: number;
}

// assessmentByUser (singular) differs from assessmentsByUser: Record<string, PlayerAssessment[]>
// in AssessmentsPaginatedResult. Stores one nullable assessment per user (most recent in month).
export interface AssessmentMonthResult {
  profiles: Profile[];
  assessmentByUser: Record<string, PlayerAssessment | null>;
  statusByUser: Record<string, AssessmentMonthStatus>;
  sectionsByUser: Record<string, SectionCompleteness[]>;  // [] for 'none' rows
  total: number;
  fullCount: number;    // computed BEFORE statusFilter — always the full dataset split
  partialCount: number;
  noneCount: number;
  error?: boolean;      // true on unexpected thrown exception (not auth failure)
}
```

**Empty result shape** (returned on auth failure):

```typescript
const empty: AssessmentMonthResult = {
  profiles: [], assessmentByUser: {}, statusByUser: {}, sectionsByUser: {},
  total: 0, fullCount: 0, partialCount: 0, noneCount: 0,
};
```

**Action logic:**

1. Guard: `verifyAdminOrTrainer()` → return `empty` on error. Wrap steps 2–8 in `try/catch`; on exception return `{ ...empty, error: true }`.
2. Compute date range: first day → last day of selected month as ISO date strings for Supabase `.gte` / `.lte` on `assessment_date`.
3. Fetch all trainees: `.from("profiles").select("*").eq("role", "trainee").is("deleted_at", null).order("full_name")` with optional `.ilike("full_name", ...)` for `search`. Age-group filtering is done in JS (same pattern as `getAssessmentsPaginated`). No pagination at this step.
4. Fetch all `player_assessments` where `assessment_date` in range and `user_id` in trainee set, with `.is("deleted_at", null)`.
5. For each trainee: pick the most-recent assessment in the month (if any). Status: no record → `'none'`, record present → `getAssessmentCompleteness(row) === 100 ? 'full' : 'partial'`. Compute `SectionCompleteness[]` for all 6 sections using `ASSESSMENT_SECTIONS` field lists. `sectionsByUser[userId]` = `[]` for `'none'`.
6. Compute `fullCount`, `partialCount`, `noneCount` from the full (pre-filter) dataset.
7. Apply `statusFilter` to narrow the list.
8. Paginate and return.

---

## URL State

Uses `nuqs`. New params scoped to `AssessmentsContent` only — not added to any shared/global config.

| Param | nuqs parser | Values | Default |
|-------|-------------|--------|---------|
| `month` | `parseAsInteger` | `1`–`12` | `null` |
| `year` | `parseAsInteger` | e.g. `2026` | `null` |
| `astatus` | `parseAsString` | `"all"` / `"full"` / `"partial"` / `"none"` | `"all"` |

Named `astatus` (not `status`) to avoid confusion with the `status` param on other admin pages.

`null` and `"all"` are treated as equivalent in `AssessmentsMonthView` — nuqs resolves a missing `astatus` param to `"all"` via the default. The clear button sets `astatus` to `null` to keep the URL clean; no extra null-branch check is needed in the component.

**Year defaulting:** when `month` is non-null and `year` is null, `AssessmentsContent` uses `new Date().getFullYear()` as the effective year. `MonthPicker` always writes both `month` and `year` together.

Selecting a future month is valid and will result in all trainees showing `'none'` status — this is expected behavior.

Existing `q` and `age` params work in both views. `AssessmentsMonthView` reads them via `useQueryState("q")` and `useQueryState("age")` and renders its own `TableToolbar` + `ToolbarSelect` (same components as `AssessmentsTable`, same URL keys). Page resets to 0 whenever `astatus`, `q`, or `age` changes — handled via `useEffect` watching those values.

---

## New Components

All under `src/components/admin/assessments/`:

### `AssessmentsContent.tsx`

- Client component. Reads `month`, `year` (`parseAsInteger`), `astatus` (`parseAsString`).
- Effective year: `year ?? new Date().getFullYear()` when `month` is non-null.
- Props: `initialData: AssessmentsPaginatedResult | null`.
- When `month` null: renders global summary cards (`total`, `traineesWithAssessments`, `totalAssessments` from `initialData`, defaulting to 0 when null) + `AssessmentsTable` (with `initialProfiles`, `initialAssessmentsByUser`, `initialTotal` from `initialData`, defaulting to empty/0).
- When `month` set: renders `AssessmentsMonthView` with `month` and effective `year`.
- Contains `MonthPicker` at the top in both states.

### `MonthPicker.tsx`

- Two `<Select>` controls: month (ינואר–דצמבר, values 1–12) + year.
- Year options: current year − 2, current year − 1, current year, current year + 1 = **4 options**, sorted descending.
- Always writes both `month` and `year` together on selection.
- "נקה" button sets `month`, `year`, `astatus` all to `null`.

### `AssessmentsMonthView.tsx`

- Client component. Props: `month: number`, `year: number`. Reads `astatus`, `q`, `age` via `useQueryState`.
- Local `page: number` state (starts 0). `useEffect` resets page to 0 when `astatus`, `q`, or `age` changes.
- Fetches via `getAssessmentsByMonth` with `useTransition`. `RefreshCw` spinner during transition. On `result.error === true`: `toast.error("שגיאה בטעינת נתונים")` + retain stale data.
- Renders own `TableToolbar` + `ToolbarSelect` for search + age-group (same components, same `q`/`age` URL keys).
- 3 clickable summary cards — active card highlighted. Clicking sets `astatus`.
- Status filter pills: הכל | מלא | חלקי | חסר.
- Table (desktop) + card list (mobile): שם | קבוצת גיל | סטטוס | שלמות | פעולות.
- `%` badge: clickable (opens `AssessmentSectionPopover`) for all `partial` rows including `0%`. Plain badge for full. `—` for none.
- "פרטים" button: partial rows only. "צפייה" link: full rows. "+ מבדק חדש" link: none rows.

### `AssessmentStatusBadge.tsx`

- `<Badge>` for `'full'` (green, `default` variant), `'partial'` (amber via `className`), `'none'` (muted, `secondary` variant).
- Labels: "מלא" / "חלקי" / "חסר".

### `AssessmentSectionPopover.tsx`

- Props: `sections: SectionCompleteness[]`, `children: React.ReactNode`.
- Quantitative sections: ✓ if `completed === total`, ✗ otherwise + `completed/total` fraction.
- Mental section: ✓ if `completed > 0` (intentional asymmetry — any note present counts as started), ✗ otherwise + `completed/5` count.
- Uses Radix `Popover` (shadcn/ui).

### `AssessmentDetailDialog.tsx`

- Props: `open: boolean`, `onOpenChange`, `profile: Profile`, `assessment: PlayerAssessment` (non-nullable — caller invariant; only opened for partial rows), `sections: SectionCompleteness[]`.
- Shows trainee name, assessment date, all 6 sections with ✓/✗ and fractions.
- Footer: "סגור" + "השלם מבדק" → `/admin/assessments/[profile.id]/[assessment.id]/edit`.

---

## Interactions

| Trigger | Result |
|---------|--------|
| Select month | Switch to month view; `astatus` → null, page → 0 |
| Click summary card | Sets `astatus`; page → 0 |
| Click status pill | Sets `astatus`; page → 0 |
| Change search / age-group | Refetch; page → 0 (via `useEffect`) |
| Click `%` badge (partial row) | Opens `AssessmentSectionPopover` |
| Click "פרטים" (partial row) | Opens `AssessmentDetailDialog` |
| Click "השלם מבדק" in dialog | Navigate to edit page |
| Click "+ מבדק חדש" (none row) | Navigate to `/admin/assessments/[userId]/new` |
| Click "צפייה" (full row) | Navigate to `/admin/assessments/[userId]` |
| Click "נקה" | Clears `month`, `year`, `astatus`; default view |

---

## Files Changed / Created

### New files

- `src/lib/actions/admin-assessments-month.ts`
- `src/components/admin/assessments/AssessmentsContent.tsx`
- `src/components/admin/assessments/MonthPicker.tsx`
- `src/components/admin/assessments/AssessmentsMonthView.tsx`
- `src/components/admin/assessments/AssessmentStatusBadge.tsx`
- `src/components/admin/assessments/AssessmentSectionPopover.tsx`
- `src/components/admin/assessments/AssessmentDetailDialog.tsx`

### Modified files

- `src/types/assessment.ts` — add `AssessmentMonthStatus`, `SectionCompleteness`
- `src/app/admin/assessments/page.tsx` — async `searchParams` prop; skip `getAssessmentsPaginated` when `month` present; render `AssessmentsContent` with `initialData`

### Unchanged

- `src/components/admin/assessments/AssessmentsTable.tsx`
- `src/lib/actions/admin-assessments-list.ts`

---

## Out of Scope

- Editing or creating assessments (existing pages handle this).
- Multi-month range filtering.
- Exporting month-filtered data to CSV/PDF.
