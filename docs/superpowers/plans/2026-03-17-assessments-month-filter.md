# Assessment Month Filter Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add month-based filtering to the admin/trainer assessments page so trainers can see which trainees completed a full, partial, or no assessment in any given month.

**Architecture:** A new `AssessmentsContent` client wrapper renders the existing view (no month) or a new `AssessmentsMonthView` (month selected). A new server action `getAssessmentsByMonth` fetches and classifies all trainees for the selected month. All components are self-contained; the existing `AssessmentsTable` is untouched.

**Tech Stack:** Next.js 16 App Router, TypeScript (strict), Supabase, nuqs (URL state), shadcn/ui (Radix Popover/Dialog/Select/Badge), Vitest, Tailwind CSS 4, sonner (toasts).

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/types/assessment.ts` | Modify | Add `AssessmentMonthStatus`, `SectionCompleteness`, `computeSectionCompleteness()` |
| `src/types/__tests__/assessment.test.ts` | Modify | Tests for `computeSectionCompleteness` |
| `src/lib/actions/admin-assessments-month.ts` | Create | Server action `getAssessmentsByMonth` |
| `src/components/admin/assessments/AssessmentStatusBadge.tsx` | Create | Badge for מלא / חלקי / חסר |
| `src/components/admin/assessments/MonthPicker.tsx` | Create | Month + year selects + clear button |
| `src/components/admin/assessments/AssessmentSectionPopover.tsx` | Create | Popover showing 6-section breakdown |
| `src/components/admin/assessments/AssessmentDetailDialog.tsx` | Create | Full-detail dialog with "השלם מבדק" |
| `src/components/admin/assessments/AssessmentsMonthView.tsx` | Create | Month-view table: cards + pills + table |
| `src/components/admin/assessments/AssessmentsContent.tsx` | Create | Client wrapper: switches between views |
| `src/app/admin/assessments/page.tsx` | Modify | Async searchParams; wire `AssessmentsContent` |

---

## Task 1: Types + `computeSectionCompleteness` utility

**Files:**
- Modify: `src/types/assessment.ts`
- Modify: `src/types/__tests__/assessment.test.ts`

**Background:** `ASSESSMENT_SECTIONS` is already defined in `assessment.ts` with 6 sections. Each section has a `key`, `title`, `fields[]`, and `type` (`"number"`, `"select"`, or `"textarea"`). We need a pure function that maps a `PlayerAssessment | null` → `SectionCompleteness[]`. Tests go in the existing test file alongside `getAssessmentCompleteness` tests.

- [ ] **Add types to `src/types/assessment.ts`** (after the existing `AssessmentSection` interface, before `ASSESSMENT_SECTIONS`):

```typescript
export type AssessmentMonthStatus = 'full' | 'partial' | 'none';

export interface SectionCompleteness {
  key: 'sprints' | 'jumps' | 'agility' | 'categorical' | 'power' | 'mental';
  title: string;
  completed: number;
  total: number;
}
```

- [ ] **Add `computeSectionCompleteness` to `src/types/assessment.ts`** (after `getAssessmentCompleteness`):

```typescript
/**
 * Returns section-level completeness for all 6 ASSESSMENT_SECTIONS.
 * Returns [] when assessment is null (trainee has no record for the month).
 * Mental (textarea) fields are completed if non-null AND non-empty string.
 * Quantitative fields are completed if non-null.
 */
export function computeSectionCompleteness(
  assessment: Partial<PlayerAssessment> | null
): SectionCompleteness[] {
  if (!assessment) return [];

  return ASSESSMENT_SECTIONS.map((section) => {
    const completed = section.fields.filter((field) => {
      const value = assessment[field as keyof PlayerAssessment];
      if (section.type === 'textarea') {
        return value !== null && value !== undefined && value !== '';
      }
      return value !== null && value !== undefined;
    }).length;

    return {
      key: section.key as SectionCompleteness['key'],
      title: section.title,
      completed,
      total: section.fields.length,
    };
  });
}
```

- [ ] **Write failing tests** — add a new `describe` block in `src/types/__tests__/assessment.test.ts`:

```typescript
import {
  getAgeGroup,
  isLowerBetter,
  getAssessmentCompleteness,
  computeSectionCompleteness,
} from "../assessment";

// ... existing tests unchanged ...

describe("computeSectionCompleteness", () => {
  it("returns empty array for null assessment", () => {
    expect(computeSectionCompleteness(null)).toEqual([]);
  });

  it("returns 6 sections for an all-null assessment", () => {
    const result = computeSectionCompleteness(createMockAssessment());
    expect(result).toHaveLength(6);
    expect(result.map((s) => s.key)).toEqual([
      "sprints", "jumps", "agility", "categorical", "power", "mental",
    ]);
  });

  it("returns completed=0 total=3 for sprints when all null", () => {
    const result = computeSectionCompleteness(createMockAssessment());
    const sprints = result.find((s) => s.key === "sprints")!;
    expect(sprints.completed).toBe(0);
    expect(sprints.total).toBe(3);
  });

  it("counts only filled sprint fields", () => {
    const result = computeSectionCompleteness(
      createMockAssessment({ sprint_5m: 1.23, sprint_10m: 2.45 })
    );
    const sprints = result.find((s) => s.key === "sprints")!;
    expect(sprints.completed).toBe(2);
    expect(sprints.total).toBe(3);
  });

  it("marks sprints complete when all 3 filled", () => {
    const result = computeSectionCompleteness(
      createMockAssessment({ sprint_5m: 1.1, sprint_10m: 2.2, sprint_20m: 3.3 })
    );
    const sprints = result.find((s) => s.key === "sprints")!;
    expect(sprints.completed).toBe(3);
  });

  it("counts mental notes as completed only when non-empty string", () => {
    const result = computeSectionCompleteness(
      createMockAssessment({
        concentration_notes: "good",
        decision_making_notes: "",   // empty string = not completed
        work_ethic_notes: null,      // null = not completed
      })
    );
    const mental = result.find((s) => s.key === "mental")!;
    expect(mental.completed).toBe(1);
    expect(mental.total).toBe(5);
  });

  it("full assessment (all 15 fields) gives completed === total for all quantitative sections", () => {
    const full = createMockAssessment({
      sprint_5m: 1.1, sprint_10m: 2.2, sprint_20m: 3.3,
      jump_2leg_distance: 200, jump_right_leg: 180, jump_left_leg: 175, jump_2leg_height: 60,
      blaze_spot_time: 30, flexibility_ankle: 10, flexibility_knee: 15, flexibility_hip: 20,
      coordination: "advanced", leg_power_technique: "normal", body_structure: "good_build",
      kick_power_kaiser: 500,
    });
    const result = computeSectionCompleteness(full);
    const quantitative = result.filter((s) => s.key !== "mental");
    quantitative.forEach((s) => {
      expect(s.completed).toBe(s.total);
    });
  });
});

// Spec exception: a DB row where all 15 fields are null has completeness = 0 and must be
// classified as 'partial' (not 'none') because a record exists for that trainee.
describe("0% completeness edge case (spec exception)", () => {
  it("getAssessmentCompleteness returns 0 for all-null assessment", () => {
    // Verifies the server action logic: 0 !== 100, so the row is classified 'partial', not 'none'
    expect(getAssessmentCompleteness(createMockAssessment())).toBe(0);
  });

  it("computeSectionCompleteness returns 6 sections all with completed=0 for all-null assessment", () => {
    const result = computeSectionCompleteness(createMockAssessment());
    expect(result).toHaveLength(6);
    result.forEach((s) => expect(s.completed).toBe(0));
  });
});
```

- [ ] **Run tests to verify they fail** (import not yet exported):

```bash
npm run test:run -- src/types/__tests__/assessment.test.ts
```

Expected: FAIL — `computeSectionCompleteness` is not exported.

- [ ] **Run tests to verify they pass** after adding the code:

```bash
npm run test:run -- src/types/__tests__/assessment.test.ts
```

Expected: all tests PASS.

- [ ] **Type-check:**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Commit:**

```bash
git add src/types/assessment.ts src/types/__tests__/assessment.test.ts
git commit -m "feat(assessments): add AssessmentMonthStatus, SectionCompleteness types and computeSectionCompleteness util"
```

---

## Task 2: Server action `getAssessmentsByMonth`

**Files:**
- Create: `src/lib/actions/admin-assessments-month.ts`

**Background:** Pattern to follow is `src/lib/actions/admin-assessments-list.ts`. Key differences: (1) fetches ALL trainees first (no pagination), computes status for each, then paginates; (2) date-range filter on `assessment_date`; (3) returns counts computed before the status filter; (4) has try/catch with `error` field. Age-group JS filtering matches the existing pattern.

- [ ] **Create `src/lib/actions/admin-assessments-month.ts`:**

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { verifyAdminOrTrainer } from "@/lib/actions/shared/verify-admin";
import {
  getAgeGroup,
  getAssessmentCompleteness,
  computeSectionCompleteness,
  ASSESSMENT_SECTIONS,
} from "@/types/assessment";
import type { PlayerAssessment, AssessmentMonthStatus, SectionCompleteness } from "@/types/assessment";
import type { Profile } from "@/types/database";

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
  error?: boolean;
}

const empty: AssessmentMonthResult = {
  profiles: [],
  assessmentByUser: {},
  statusByUser: {},
  sectionsByUser: {},
  total: 0,
  fullCount: 0,
  partialCount: 0,
  noneCount: 0,
};

export async function getAssessmentsByMonth(
  params: AssessmentMonthParams
): Promise<AssessmentMonthResult> {
  const { error } = await verifyAdminOrTrainer();
  if (error) return empty;

  // Validate inputs
  if (params.month < 1 || params.month > 12 || params.year < 2000 || params.year > 2100) {
    return empty;
  }

  try {
    const supabase = await createClient();

    // Date range: first day → last day of selected month (ISO date strings)
    const firstDay = new Date(params.year, params.month - 1, 1)
      .toISOString()
      .split('T')[0];
    const lastDay = new Date(params.year, params.month, 0)
      .toISOString()
      .split('T')[0];

    // Fetch all trainees (no pagination — ~75 records)
    let profileQuery = supabase
      .from("profiles")
      .select("*")
      .eq("role", "trainee")
      .is("deleted_at", null)
      .order("full_name");

    if (params.search) {
      profileQuery = profileQuery.ilike("full_name", `%${params.search}%`);
    }

    const { data: allProfiles } = (await profileQuery) as unknown as {
      data: Profile[] | null;
    };

    if (!allProfiles || allProfiles.length === 0) return empty;

    // Age-group filtering in JS (same pattern as getAssessmentsPaginated)
    const filteredProfiles = params.ageGroupId
      ? allProfiles.filter((p) => getAgeGroup(p.birthdate)?.id === params.ageGroupId)
      : allProfiles;

    if (filteredProfiles.length === 0) return empty;

    // Fetch all assessments in the date range for these trainees
    const profileIds = filteredProfiles.map((p) => p.id);
    const { data: assessments } = (await supabase
      .from("player_assessments")
      .select("*")
      .gte("assessment_date", firstDay)
      .lte("assessment_date", lastDay)
      .is("deleted_at", null)
      .in("user_id", profileIds)
      .order("assessment_date", { ascending: false })) as unknown as {
      data: PlayerAssessment[] | null;
    };

    // Index most-recent assessment per user (already ordered desc)
    const latestByUser: Record<string, PlayerAssessment> = {};
    (assessments ?? []).forEach((a) => {
      if (!latestByUser[a.user_id]) {
        latestByUser[a.user_id] = a;
      }
    });

    // Compute status and sections for each trainee
    const assessmentByUser: Record<string, PlayerAssessment | null> = {};
    const statusByUser: Record<string, AssessmentMonthStatus> = {};
    const sectionsByUser: Record<string, SectionCompleteness[]> = {};

    let fullCount = 0;
    let partialCount = 0;
    let noneCount = 0;

    for (const profile of filteredProfiles) {
      const assessment = latestByUser[profile.id] ?? null;
      assessmentByUser[profile.id] = assessment;

      let status: AssessmentMonthStatus;
      if (!assessment) {
        status = 'none';
        noneCount++;
        sectionsByUser[profile.id] = [];
      } else if (getAssessmentCompleteness(assessment) === 100) {
        status = 'full';
        fullCount++;
        sectionsByUser[profile.id] = computeSectionCompleteness(assessment);
      } else {
        status = 'partial';
        partialCount++;
        sectionsByUser[profile.id] = computeSectionCompleteness(assessment);
      }

      statusByUser[profile.id] = status;
    }

    // Apply status filter (counts are already computed above, before filtering)
    const statusFilter = params.statusFilter && params.statusFilter !== 'all'
      ? params.statusFilter
      : null;

    const filteredByStatus = statusFilter
      ? filteredProfiles.filter((p) => statusByUser[p.id] === statusFilter)
      : filteredProfiles;

    // Paginate
    const from = params.page * params.pageSize;
    const paginatedProfiles = filteredByStatus.slice(from, from + params.pageSize);

    return {
      profiles: paginatedProfiles,
      assessmentByUser,
      statusByUser,
      sectionsByUser,
      total: filteredByStatus.length,
      fullCount,
      partialCount,
      noneCount,
    };
  } catch {
    return { ...empty, error: true };
  }
}
```

- [ ] **Type-check:**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Commit:**

```bash
git add src/lib/actions/admin-assessments-month.ts
git commit -m "feat(assessments): add getAssessmentsByMonth server action"
```

---

## Task 3: `AssessmentStatusBadge`

**Files:**
- Create: `src/components/admin/assessments/AssessmentStatusBadge.tsx`

**Background:** Simple display component. Uses shadcn `Badge`. The `partial` status needs an amber color — override using `className` since the Badge component doesn't have an amber variant. Check `src/components/ui/badge.tsx` for the variant prop options.

- [ ] **Create `src/components/admin/assessments/AssessmentStatusBadge.tsx`:**

```typescript
import { Badge } from "@/components/ui/badge";
import type { AssessmentMonthStatus } from "@/types/assessment";

interface AssessmentStatusBadgeProps {
  status: AssessmentMonthStatus;
}

const STATUS_CONFIG = {
  full: {
    label: "מלא",
    variant: "default" as const,
    className: "",
  },
  partial: {
    label: "חלקי",
    variant: "secondary" as const,
    className: "bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-100",
  },
  none: {
    label: "חסר",
    variant: "secondary" as const,
    className: "",
  },
};

export function AssessmentStatusBadge({ status }: AssessmentStatusBadgeProps) {
  const { label, variant, className } = STATUS_CONFIG[status];
  return (
    <Badge variant={variant} className={className}>
      {label}
    </Badge>
  );
}
```

- [ ] **Type-check:**

```bash
npx tsc --noEmit
```

- [ ] **Commit:**

```bash
git add src/components/admin/assessments/AssessmentStatusBadge.tsx
git commit -m "feat(assessments): add AssessmentStatusBadge component"
```

---

## Task 4: `MonthPicker`

**Files:**
- Create: `src/components/admin/assessments/MonthPicker.tsx`

**Background:** Uses `useQueryState` from `nuqs` with `parseAsInteger` for month/year and `parseAsString` for astatus. Must be `"use client"`. Uses shadcn `Select` components (already in `src/components/ui/select.tsx`). The clear button sets all three params to `null`.

- [ ] **Create `src/components/admin/assessments/MonthPicker.tsx`:**

```typescript
"use client";

import { parseAsInteger, parseAsString, useQueryState } from "nuqs";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const MONTHS = [
  { value: "1", label: "ינואר" },
  { value: "2", label: "פברואר" },
  { value: "3", label: "מרץ" },
  { value: "4", label: "אפריל" },
  { value: "5", label: "מאי" },
  { value: "6", label: "יוני" },
  { value: "7", label: "יולי" },
  { value: "8", label: "אוגוסט" },
  { value: "9", label: "ספטמבר" },
  { value: "10", label: "אוקטובר" },
  { value: "11", label: "נובמבר" },
  { value: "12", label: "דצמבר" },
];

function getYearOptions(): { value: string; label: string }[] {
  const current = new Date().getFullYear();
  return [current + 1, current, current - 1, current - 2].map((y) => ({
    value: String(y),
    label: String(y),
  }));
}

export function MonthPicker() {
  const [month, setMonth] = useQueryState("month", parseAsInteger);
  const [year, setYear] = useQueryState("year", parseAsInteger);
  const [, setAstatus] = useQueryState("astatus", parseAsString);

  const yearOptions = getYearOptions();
  const isActive = month !== null;

  const handleMonthChange = (value: string) => {
    const newMonth = parseInt(value, 10);
    const effectiveYear = year ?? new Date().getFullYear();
    void setMonth(newMonth);
    void setYear(effectiveYear);
  };

  const handleYearChange = (value: string) => {
    void setYear(parseInt(value, 10));
  };

  const handleClear = () => {
    void setMonth(null);
    void setYear(null);
    void setAstatus(null);
  };

  return (
    <div
      className={`flex items-center gap-2 rounded-lg border p-2 ${
        isActive ? "border-primary bg-primary/5" : "border-dashed"
      }`}
    >
      <span className="text-sm text-muted-foreground whitespace-nowrap">
        סינון לפי חודש:
      </span>

      <Select
        value={month !== null ? String(month) : undefined}
        onValueChange={handleMonthChange}
      >
        <SelectTrigger className="w-32">
          <SelectValue placeholder="בחר חודש" />
        </SelectTrigger>
        <SelectContent>
          {MONTHS.map((m) => (
            <SelectItem key={m.value} value={m.value}>
              {m.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={year !== null ? String(year) : undefined}
        onValueChange={handleYearChange}
        disabled={month === null}
      >
        <SelectTrigger className="w-24">
          <SelectValue placeholder="שנה" />
        </SelectTrigger>
        <SelectContent>
          {yearOptions.map((y) => (
            <SelectItem key={y.value} value={y.value}>
              {y.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {isActive && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleClear}
          className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
          <span className="sr-only">נקה סינון</span>
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Type-check:**

```bash
npx tsc --noEmit
```

- [ ] **Commit:**

```bash
git add src/components/admin/assessments/MonthPicker.tsx
git commit -m "feat(assessments): add MonthPicker component"
```

---

## Task 5: `AssessmentSectionPopover`

**Files:**
- Create: `src/components/admin/assessments/AssessmentSectionPopover.tsx`

**Background:** Uses Radix `Popover` already available as `src/components/ui/popover.tsx` (shadcn). Receives `sections: SectionCompleteness[]` and a `children` trigger. For mental (key === `'mental'`), ✓ if `completed > 0`; for quantitative, ✓ if `completed === total`.

- [ ] **Create `src/components/admin/assessments/AssessmentSectionPopover.tsx`:**

```typescript
"use client";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CheckCircle, XCircle } from "lucide-react";
import type { SectionCompleteness } from "@/types/assessment";

interface AssessmentSectionPopoverProps {
  sections: SectionCompleteness[];
  children: React.ReactNode;
}

function isSectionDone(section: SectionCompleteness): boolean {
  if (section.key === "mental") return section.completed > 0;
  return section.completed === section.total;
}

export function AssessmentSectionPopover({
  sections,
  children,
}: AssessmentSectionPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-64" align="start" side="top">
        <p className="text-sm font-medium mb-3">פירוט מבדק</p>
        <div className="space-y-2">
          {sections.map((section) => {
            const done = isSectionDone(section);
            return (
              <div
                key={section.key}
                className="flex items-center justify-between text-sm"
              >
                <div className="flex items-center gap-2">
                  {done ? (
                    <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                  )}
                  <span>{section.title}</span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {section.completed}/{section.total}
                </span>
              </div>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

- [ ] **Type-check:**

```bash
npx tsc --noEmit
```

- [ ] **Commit:**

```bash
git add src/components/admin/assessments/AssessmentSectionPopover.tsx
git commit -m "feat(assessments): add AssessmentSectionPopover component"
```

---

## Task 6: `AssessmentDetailDialog`

**Files:**
- Create: `src/components/admin/assessments/AssessmentDetailDialog.tsx`

**Background:** Uses shadcn `Dialog` (`src/components/ui/dialog.tsx`). The `assessment` prop is non-nullable — this dialog is only opened for partial rows. Navigation on "השלם מבדק" uses Next.js `useRouter`.

- [ ] **Create `src/components/admin/assessments/AssessmentDetailDialog.tsx`:**

```typescript
"use client";

import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle } from "lucide-react";
import type { SectionCompleteness } from "@/types/assessment";
import type { PlayerAssessment } from "@/types/assessment";
import type { Profile } from "@/types/database";

interface AssessmentDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  profile: Profile;
  // Non-nullable: this dialog is only opened for partial rows (assessment always exists)
  assessment: PlayerAssessment;
  sections: SectionCompleteness[];
}

function isSectionDone(section: SectionCompleteness): boolean {
  if (section.key === "mental") return section.completed > 0;
  return section.completed === section.total;
}

export function AssessmentDetailDialog({
  open,
  onOpenChange,
  profile,
  assessment,
  sections,
}: AssessmentDetailDialogProps) {
  const router = useRouter();

  const assessmentDate = new Date(assessment.assessment_date).toLocaleDateString(
    "he-IL"
  );

  const handleComplete = () => {
    onOpenChange(false);
    router.push(`/admin/assessments/${profile.id}/${assessment.id}/edit`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {profile.full_name || "ללא שם"} — {assessmentDate}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {sections.map((section) => {
            const done = isSectionDone(section);
            return (
              <div
                key={section.key}
                className="flex items-center justify-between text-sm"
              >
                <div className="flex items-center gap-2">
                  {done ? (
                    <CheckCircle className="h-4 w-4 text-green-600 shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                  )}
                  <span className={done ? "" : "text-muted-foreground"}>
                    {section.title}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {section.completed}/{section.total}
                </span>
              </div>
            );
          })}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            סגור
          </Button>
          <Button onClick={handleComplete}>השלם מבדק</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Type-check:**

```bash
npx tsc --noEmit
```

- [ ] **Commit:**

```bash
git add src/components/admin/assessments/AssessmentDetailDialog.tsx
git commit -m "feat(assessments): add AssessmentDetailDialog component"
```

---

## Task 7: `AssessmentsMonthView`

**Files:**
- Create: `src/components/admin/assessments/AssessmentsMonthView.tsx`

**Background:** The largest new component. Owns the table + cards + status pills. Reads `astatus`, `q`, `age` from URL via `useQueryState`. Uses `useTransition` for data fetching. Page state is local. `useEffect` resets page to 0 when filters change (skip first render using `useRef`). Shows `RefreshCw` spinner during transition. On `result.error`, calls `toast.error` from `sonner` and retains stale data.

For the summary cards: the active card (matching current `astatus`) gets a highlighted border. The count cards show status totals that stay stable regardless of current filter.

For the `%` badge on partial rows: wrap in `<AssessmentSectionPopover>` as a trigger. The badge itself is a `<button>` so it's clickable.

- [ ] **Create `src/components/admin/assessments/AssessmentsMonthView.tsx`:**

```typescript
"use client";

import { useState, useTransition, useEffect, useRef, useCallback } from "react";
import { parseAsString, useQueryState } from "nuqs";
import Link from "next/link";
import { toast } from "sonner";
import { RefreshCw, Users, ClipboardCheck, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableToolbar, ToolbarSelect } from "@/components/admin/TableToolbar";
import { SimpleTablePagination } from "@/components/admin/TablePagination";
import { AGE_GROUPS, getAgeGroup, getAssessmentCompleteness, computeSectionCompleteness } from "@/types/assessment";
import { AssessmentStatusBadge } from "./AssessmentStatusBadge";
import { AssessmentSectionPopover } from "./AssessmentSectionPopover";
import { AssessmentDetailDialog } from "./AssessmentDetailDialog";
import { getAssessmentsByMonth } from "@/lib/actions/admin-assessments-month";
import type { AssessmentMonthResult } from "@/lib/actions/admin-assessments-month";
import type { AssessmentMonthStatus } from "@/types/assessment";
import type { Profile } from "@/types/database";
import type { PlayerAssessment } from "@/types/assessment";

interface AssessmentsMonthViewProps {
  month: number;
  year: number;
}

const PAGE_SIZE = 20;

const ageGroupOptions = [
  { value: "all", label: "כל קבוצות הגיל" },
  ...AGE_GROUPS.map((g) => ({ value: g.id, label: g.labelHe })),
];

const STATUS_FILTER_OPTIONS: { value: string; label: string; status: AssessmentMonthStatus | 'all' }[] = [
  { value: "all", label: "הכל", status: "all" },
  { value: "full", label: "מלא", status: "full" },
  { value: "partial", label: "חלקי", status: "partial" },
  { value: "none", label: "חסר", status: "none" },
];

const MONTHS_HE = [
  "", "ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני",
  "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר",
];

export function AssessmentsMonthView({ month, year }: AssessmentsMonthViewProps) {
  const [search, setSearch] = useQueryState("q", parseAsString.withDefault(""));
  const [ageGroup, setAgeGroup] = useQueryState("age", parseAsString.withDefault("all"));
  const [astatus, setAstatus] = useQueryState("astatus", parseAsString.withDefault("all"));

  const [page, setPage] = useState(0);
  const [data, setData] = useState<AssessmentMonthResult | null>(null);
  const [isPending, startTransition] = useTransition();

  // For the detail dialog
  const [dialogProfile, setDialogProfile] = useState<Profile | null>(null);
  const [dialogAssessment, setDialogAssessment] = useState<PlayerAssessment | null>(null);
  const [dialogSections, setDialogSections] = useState<ReturnType<typeof computeSectionCompleteness>>([]);
  const [dialogOpen, setDialogOpen] = useState(false);

  const isFirstRender = useRef(true);

  // Reset page when filters change (skip initial mount)
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setPage(0);
  }, [astatus, search, ageGroup]);

  const fetchData = useCallback(
    (currentPage: number) => {
      startTransition(async () => {
        const result = await getAssessmentsByMonth({
          month,
          year,
          search: search || undefined,
          ageGroupId: ageGroup !== "all" ? ageGroup : undefined,
          statusFilter: (astatus as AssessmentMonthStatus | 'all') || 'all',
          page: currentPage,
          pageSize: PAGE_SIZE,
        });

        if (result.error) {
          toast.error("שגיאה בטעינת נתונים");
          return; // retain stale data
        }
        setData(result);
      });
    },
    [month, year, search, ageGroup, astatus]
  );

  // Fetch on mount and when month/year/filters change
  useEffect(() => {
    fetchData(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year, search, ageGroup, astatus, page]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  const handleStatusCardClick = (status: AssessmentMonthStatus) => {
    const current = astatus || "all";
    // Toggle: clicking the active card resets to "all"
    void setAstatus(current === status ? null : status);
  };

  const handleOpenDialog = (profile: Profile, assessment: PlayerAssessment) => {
    const sections = data?.sectionsByUser[profile.id] ?? [];
    setDialogProfile(profile);
    setDialogAssessment(assessment);
    setDialogSections(sections);
    setDialogOpen(true);
  };

  const activeStatus = astatus || "all";
  const monthLabel = `${MONTHS_HE[month]} ${year}`;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card
          className={`cursor-pointer transition-colors ${
            activeStatus === "full" ? "border-primary ring-1 ring-primary" : "hover:border-primary/50"
          }`}
          onClick={() => handleStatusCardClick("full")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-green-700">מבדק מלא</CardTitle>
            <ClipboardCheck className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.fullCount ?? "—"}</div>
            <p className="text-xs text-muted-foreground">{monthLabel}</p>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-colors ${
            activeStatus === "partial" ? "border-amber-500 ring-1 ring-amber-500" : "hover:border-amber-300"
          }`}
          onClick={() => handleStatusCardClick("partial")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-amber-700">מבדק חלקי</CardTitle>
            <AlertCircle className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.partialCount ?? "—"}</div>
            <p className="text-xs text-muted-foreground">{monthLabel}</p>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-colors ${
            activeStatus === "none" ? "border-destructive ring-1 ring-destructive" : "hover:border-destructive/30"
          }`}
          onClick={() => handleStatusCardClick("none")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">ללא מבדק</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.noneCount ?? "—"}</div>
            <p className="text-xs text-muted-foreground">{monthLabel}</p>
          </CardContent>
        </Card>
      </div>

      {/* Table Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>שחקנים — {monthLabel}</CardTitle>
            {isPending && <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Toolbar */}
          <TableToolbar
            searchValue={search}
            onSearchChange={(v) => { void setSearch(v || null); }}
            searchPlaceholder="חיפוש לפי שם..."
            filters={
              <ToolbarSelect
                value={ageGroup || "all"}
                onValueChange={(v) => { void setAgeGroup(v === "all" ? null : v); }}
                options={ageGroupOptions}
                placeholder="קבוצת גיל"
              />
            }
          />

          {/* Status filter pills */}
          <div className="flex gap-2 flex-wrap">
            {STATUS_FILTER_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { void setAstatus(opt.value === "all" ? null : opt.value); }}
                className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                  activeStatus === opt.value
                    ? "border-primary bg-primary/10 text-primary font-medium"
                    : "border-border hover:border-primary/50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Table — desktop */}
          {data && data.profiles.length > 0 ? (
            <>
              <div className="hidden sm:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>שם</TableHead>
                      <TableHead>קבוצת גיל</TableHead>
                      <TableHead>סטטוס</TableHead>
                      <TableHead>שלמות</TableHead>
                      <TableHead>פעולות</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.profiles.map((profile) => {
                      const status = data.statusByUser[profile.id];
                      const assessment = data.assessmentByUser[profile.id];
                      const sections = data.sectionsByUser[profile.id] ?? [];
                      const group = getAgeGroup(profile.birthdate);
                      const completeness = assessment
                        ? getAssessmentCompleteness(assessment)
                        : null;

                      return (
                        <TableRow key={profile.id}>
                          <TableCell className="font-medium">
                            {profile.full_name || "ללא שם"}
                          </TableCell>
                          <TableCell>
                            {group ? (
                              <Badge variant="outline">{group.label}</Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">לא הוגדר</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <AssessmentStatusBadge status={status} />
                          </TableCell>
                          <TableCell>
                            {status === "partial" && assessment ? (
                              <AssessmentSectionPopover sections={sections}>
                                <button className="cursor-pointer">
                                  <Badge variant="secondary" className="bg-amber-100 text-amber-800 border border-amber-300 hover:bg-amber-200">
                                    {completeness}%
                                  </Badge>
                                </button>
                              </AssessmentSectionPopover>
                            ) : status === "full" ? (
                              <Badge>100%</Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              {status === "full" && (
                                <Button asChild size="sm" variant="outline">
                                  <Link href={`/admin/assessments/${profile.id}`}>צפייה</Link>
                                </Button>
                              )}
                              {status === "partial" && assessment && (
                                <>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handleOpenDialog(profile, assessment)}
                                  >
                                    פרטים
                                  </Button>
                                  <Button asChild size="sm">
                                    <Link href={`/admin/assessments/${profile.id}/${assessment.id}/edit`}>
                                      השלם מבדק
                                    </Link>
                                  </Button>
                                </>
                              )}
                              {status === "none" && (
                                <Button asChild size="sm">
                                  <Link href={`/admin/assessments/${profile.id}/new`}>
                                    + מבדק חדש
                                  </Link>
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile card list */}
              <div className="space-y-2 sm:hidden">
                {data.profiles.map((profile) => {
                  const status = data.statusByUser[profile.id];
                  const assessment = data.assessmentByUser[profile.id];
                  const sections = data.sectionsByUser[profile.id] ?? [];
                  const group = getAgeGroup(profile.birthdate);
                  const completeness = assessment
                    ? getAssessmentCompleteness(assessment)
                    : null;

                  return (
                    <div key={profile.id} className="p-3 rounded-lg border space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">
                          {profile.full_name || "ללא שם"}
                        </span>
                        <div className="flex items-center gap-1.5">
                          {group && (
                            <Badge variant="outline" className="text-xs">{group.label}</Badge>
                          )}
                          <AssessmentStatusBadge status={status} />
                        </div>
                      </div>
                      {status === "partial" && completeness !== null && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>שלמות: {completeness}%</span>
                        </div>
                      )}
                      <div className="flex gap-2">
                        {status === "full" && (
                          <Button asChild size="sm" variant="outline" className="flex-1">
                            <Link href={`/admin/assessments/${profile.id}`}>צפייה</Link>
                          </Button>
                        )}
                        {status === "partial" && assessment && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              onClick={() => handleOpenDialog(profile, assessment)}
                            >
                              פרטים
                            </Button>
                            <Button asChild size="sm" className="flex-1">
                              <Link href={`/admin/assessments/${profile.id}/${assessment.id}/edit`}>
                                השלם
                              </Link>
                            </Button>
                          </>
                        )}
                        {status === "none" && (
                          <Button asChild size="sm" className="flex-1">
                            <Link href={`/admin/assessments/${profile.id}/new`}>
                              + מבדק חדש
                            </Link>
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <SimpleTablePagination
                totalItems={data.total}
                pageSize={PAGE_SIZE}
                currentPage={page}
                onPageChange={handlePageChange}
                itemLabel="שחקנים"
              />
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {isPending ? "טוען..." : "לא נמצאו שחקנים"}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Detail dialog */}
      {dialogProfile && dialogAssessment && (
        <AssessmentDetailDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          profile={dialogProfile}
          assessment={dialogAssessment}
          sections={dialogSections}
        />
      )}
    </div>
  );
}
```


- [ ] **Type-check:**

```bash
npx tsc --noEmit
```

Fix any type errors (common: `void` from `useQueryState` setters, missing imports).

- [ ] **Commit:**

```bash
git add src/components/admin/assessments/AssessmentsMonthView.tsx
git commit -m "feat(assessments): add AssessmentsMonthView component"
```

---

## Task 8: `AssessmentsContent`

**Files:**
- Create: `src/components/admin/assessments/AssessmentsContent.tsx`

**Background:** Client wrapper that owns `month`/`year`/`astatus` URL state and switches between the default view and `AssessmentsMonthView`. Receives `initialData` from `page.tsx` and passes it down to `AssessmentsTable` when no month is selected. Contains `MonthPicker` in both states. The global summary cards (no-month view) are rendered here.

- [ ] **Create `src/components/admin/assessments/AssessmentsContent.tsx`:**

```typescript
"use client";

import { parseAsInteger, useQueryState } from "nuqs";
import { ClipboardList, Users, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AssessmentsTable } from "./AssessmentsTable";
import { MonthPicker } from "./MonthPicker";
import { AssessmentsMonthView } from "./AssessmentsMonthView";
import type { AssessmentsPaginatedResult } from "@/lib/actions/admin-assessments-list";

interface AssessmentsContentProps {
  initialData: AssessmentsPaginatedResult | null;
}

export function AssessmentsContent({ initialData }: AssessmentsContentProps) {
  const [month] = useQueryState("month", parseAsInteger);
  const [year] = useQueryState("year", parseAsInteger);

  const effectiveYear = year ?? new Date().getFullYear();
  const isMonthView = month !== null;

  // Fallback values when initialData is null (month was set on first load)
  const total = initialData?.total ?? 0;
  const traineesWithAssessments = initialData?.traineesWithAssessments ?? 0;
  const totalAssessments = initialData?.totalAssessments ?? 0;
  const initialProfiles = initialData?.profiles ?? [];
  const initialAssessmentsByUser = initialData?.assessmentsByUser ?? {};
  const initialTotal = initialData?.total ?? 0;

  return (
    <div className="space-y-6">
      {/* Month picker — always visible */}
      <MonthPicker />

      {isMonthView ? (
        <AssessmentsMonthView month={month} year={effectiveYear} />
      ) : (
        <>
          {/* Global summary cards — same as before */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">סה&quot;כ שחקנים</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{total}</div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">עם מבדקים</CardTitle>
                <ClipboardList className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{traineesWithAssessments}</div>
                <p className="text-xs text-muted-foreground">
                  {total > 0
                    ? `${Math.round((traineesWithAssessments / total) * 100)}%`
                    : "0%"}{" "}
                  מהשחקנים
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">סה&quot;כ מבדקים</CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{totalAssessments}</div>
              </CardContent>
            </Card>
          </div>

          {/* Existing players table */}
          <Card>
            <CardHeader>
              <CardTitle>שחקנים</CardTitle>
            </CardHeader>
            <CardContent>
              <AssessmentsTable
                initialProfiles={initialProfiles}
                initialAssessmentsByUser={initialAssessmentsByUser}
                initialTotal={initialTotal}
              />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
```

- [ ] **Type-check:**

```bash
npx tsc --noEmit
```

- [ ] **Commit:**

```bash
git add src/components/admin/assessments/AssessmentsContent.tsx
git commit -m "feat(assessments): add AssessmentsContent client wrapper"
```

---

## Task 9: Update `page.tsx`

**Files:**
- Modify: `src/app/admin/assessments/page.tsx`

**Background:** Next.js 16 requires `searchParams` to be typed as `Promise<...>` and `await`ed. When `month` is present in the URL, skip the `getAssessmentsPaginated` call. Remove the inline summary cards and `AssessmentsTable` — `AssessmentsContent` now owns all of that. Keep the page header (`<h1>` + description) in the page.

- [ ] **Replace `src/app/admin/assessments/page.tsx`** with:

```typescript
import type { Metadata } from "next";
import { AssessmentsContent } from "@/components/admin/assessments/AssessmentsContent";
import { getAssessmentsPaginated } from "@/lib/actions/admin-assessments-list";

export const metadata: Metadata = {
  title: "ניהול מבדקים | Garden of Eden",
};

const PAGE_SIZE = 20;

export default async function AdminAssessmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const hasMonth = Boolean(params.month);

  // Skip the global fetch when a month is already selected —
  // AssessmentsMonthView fetches its own data client-side.
  const initialData = hasMonth
    ? null
    : await getAssessmentsPaginated({ page: 0, pageSize: PAGE_SIZE });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">מבדקים</h1>
          <p className="text-muted-foreground">ניהול מבדקי שחקנים</p>
        </div>
      </div>

      <AssessmentsContent initialData={initialData} />
    </div>
  );
}
```

- [ ] **Type-check:**

```bash
npx tsc --noEmit
```

- [ ] **Build:**

```bash
npm run build
```

Expected: successful build, no type errors. If there are errors, fix them before committing.

- [ ] **Commit:**

```bash
git add src/app/admin/assessments/page.tsx
git commit -m "feat(assessments): wire AssessmentsContent into page, add month filter"
```

---

## Task 10: Smoke test in browser

**Manual verification checklist — run `npm run dev` and navigate to `/admin/assessments`:**

- [ ] Page loads — global summary cards and trainee table appear as before (no regression)
- [ ] `MonthPicker` is visible at the top with month + year selects
- [ ] Select a month → page switches to month view; three summary cards appear showing counts
- [ ] Select a month with known data → trainees with full assessments show green "מלא" badge
- [ ] Trainees with partial assessments show amber "חלקי" badge
- [ ] Trainees with no assessment show grey "חסר" badge
- [ ] Clicking the `%` badge on a partial row opens the `AssessmentSectionPopover` with 6 sections
- [ ] Clicking "פרטים" opens `AssessmentDetailDialog` with sections and "השלם מבדק" button
- [ ] "השלם מבדק" navigates to the edit page
- [ ] "+ מבדק חדש" on a none row navigates to the new assessment page
- [ ] Clicking a summary card filters the table to that status; card is highlighted
- [ ] "הכל" pill resets the filter; "נקה" button clears the month and returns to global view
- [ ] Search and age-group filter work in month view
- [ ] RTL layout is correct throughout

- [ ] **Final commit if any small fixes were needed:**

```bash
git add -p
git commit -m "fix(assessments): smoke test fixes"
```
