# Assessment Month Filter — Design Spec

**Date:** 2026-03-17
**Status:** Approved

## Overview

Add month-based filtering to the admin/trainer assessments page. When a month is selected, each trainee is classified as having a **full assessment** (100% complete), **partial assessment** (1–99%), or **no assessment** for that month. Trainers can filter the table by status and drill into partial assessments to see exactly which sections are done and which are missing.

---

## Requirements

1. A month/year picker on the assessments page lets trainers select a specific month.
2. When a month is selected, three summary cards replace the global stats: full / partial / no assessment counts. Each card is clickable and filters the table.
3. The table shows all trainees with a status column (מלא / חלקי / חסר) and status filter pills (הכל | מלא | חלקי | חסר).
4. For partial assessments, clicking the `%` badge opens a popover showing section-level done/missing. A "פרטים" button opens a full dialog with all 6 sections and a "השלם מבדק" action button.
5. When no month is selected, the page behaves exactly as it does today.

---

## Definitions

- **Full assessment**: `getAssessmentCompleteness()` returns `100` (all 14 numeric + categorical fields filled).
- **Partial assessment**: completeness is `1`–`99`.
- **No assessment**: no assessment record exists for the trainee in the selected month.
- **Section completeness**: per-section count of filled vs total fields, across all 6 sections (sprints, jumps, agility, categorical, power, mental). Mental notes section is shown in detail views but not included in the overall `%` (consistent with existing behaviour).

---

## Architecture

Three layers:

```
page.tsx  (server component)
  └── AssessmentsContent  (client wrapper — new)
        ├── [no month]  global summary cards + AssessmentsTable  (existing)
        └── [month set]  AssessmentsMonthView  (new)
                           ├── month summary cards (clickable)
                           ├── status filter pills
                           └── month table
```

`page.tsx` passes initial data (from existing `getAssessmentsPaginated`) as props to `AssessmentsContent`. `AssessmentsContent` takes over all rendering from there.

---

## Data Model

### New types — `src/types/assessment.ts`

```typescript
export type AssessmentMonthStatus = 'full' | 'partial' | 'none';

export interface SectionCompleteness {
  key: string;       // section key from ASSESSMENT_SECTIONS
  title: string;     // Hebrew label
  completed: number; // fields with a non-null value
  total: number;     // total fields in the section
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

export interface AssessmentMonthResult {
  profiles: Profile[];
  assessmentByUser: Record<string, PlayerAssessment | null>;
  statusByUser: Record<string, AssessmentMonthStatus>;
  sectionsByUser: Record<string, SectionCompleteness[]>;
  total: number;
  fullCount: number;
  partialCount: number;
  noneCount: number;
}
```

**Action logic:**
1. Compute date range: first day → last day of the selected month.
2. Fetch all trainees matching `search`/`ageGroupId` filters (no pagination at this step — dataset is ~75 trainees).
3. Fetch all `player_assessments` rows in the date range whose `user_id` is in that trainee set.
4. For each trainee: pick the most-recent assessment in the month (if any); compute `AssessmentMonthStatus` and `SectionCompleteness[]` using `getAssessmentCompleteness` and `ASSESSMENT_SECTIONS`.
5. Apply `statusFilter` to narrow the list.
6. Paginate and return.

---

## URL State

Uses `nuqs` (already in the codebase). New params added to `AssessmentsContent`:

| Param | Values | Default |
|-------|--------|---------|
| `month` | `"1"`–`"12"` | absent (no filter) |
| `year` | e.g. `"2026"` | current year when `month` is set |
| `status` | `"all"` \| `"full"` \| `"partial"` \| `"none"` | `"all"` |

Existing `q` (search) and `age` (age group) params remain and continue to work in both views.

---

## New Components

All under `src/components/admin/assessments/`:

### `AssessmentsContent.tsx`
- Client component. Reads `month`, `year`, `status` from URL via `nuqs`.
- When no month: renders global summary cards (from initial props) + `AssessmentsTable`.
- When month set: renders `AssessmentsMonthView` with `month`/`year` props.
- Contains `MonthPicker` at the top in both states.

### `MonthPicker.tsx`
- Two `<Select>` controls: month (ינואר–דצמבר) + year (current year ± 2).
- "נקה" (clear) button that removes `month`, `year`, `status` from URL.

### `AssessmentsMonthView.tsx`
- Client component. Accepts `month`, `year` as props.
- Fetches data via `getAssessmentsByMonth` (with `useTransition`).
- Renders:
  - 3 clickable summary cards (fullCount / partialCount / noneCount) — clicking sets `status` param.
  - Status filter pills: הכל | מלא | חלקי | חסר.
  - Table (desktop) + card list (mobile) with columns: שם | קבוצת גיל | סטטוס | שלמות | פעולות.

### `AssessmentStatusBadge.tsx`
- Renders a `<Badge>` for `'full'` (green), `'partial'` (amber), `'none'` (muted).
- Hebrew labels: "מלא" / "חלקי" / "חסר".

### `AssessmentSectionPopover.tsx`
- Triggered by clicking the `%` completeness badge on a partial row.
- Shows each of the 6 sections with done/total count and a checkmark or ✗.
- Uses Radix `Popover` (already available via shadcn/ui).

### `AssessmentDetailDialog.tsx`
- Full dialog with trainee name, assessment date, and all 6 sections.
- Each section: title, status (הושלם / חסר), and field count.
- Footer: "סגור" + "השלם מבדק" button → navigates to `/admin/assessments/[userId]/[assessmentId]/edit`.

---

## Interactions

| Trigger | Result |
|---------|--------|
| Select month | Switch to month view, `status` resets to `"all"` |
| Click summary card | Sets `status` param, table filters |
| Click `%` badge (partial row) | Opens `AssessmentSectionPopover` |
| Click "פרטים" button | Opens `AssessmentDetailDialog` |
| Click "השלם מבדק" in dialog | Navigate to edit page |
| Click "+ מבדק חדש" (none row) | Navigate to new assessment page |
| Click "נקה" on picker | Clears `month`, `year`, `status`; returns to default view |

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
- `src/app/admin/assessments/page.tsx` — render `AssessmentsContent` instead of inline cards + `AssessmentsTable`

### Unchanged
- `src/components/admin/assessments/AssessmentsTable.tsx` — no changes
- `src/lib/actions/admin-assessments-list.ts` — no changes

---

## Out of Scope

- Editing or creating assessments (existing pages handle this).
- Multi-month range filtering.
- Exporting month-filtered data to CSV/PDF (future enhancement).
