# Shift Other-Purpose Time Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let trainers record how much of a shift went to non-training work (one categorised time entry per shift), shown separately from training time.

**Architecture:** Two columns on `trainer_shifts` (`other_purpose_minutes`, `other_purpose_category`) hold a single preset-categorised entry. A pure helper splits each shift into training vs other minutes; a server action (trainer edits own ended shifts, admin edits any) writes the entry; a dialog launched from the shifts table edits it.

**Tech Stack:** Next.js 16 / React 19 / TypeScript (strict), Supabase (Postgres + RLS), Zod, Tailwind + Radix (shadcn), Vitest.

## Global Constraints

- All user-facing text in Hebrew; app is RTL — use logical CSS (`start`/`end`), never `left`/`right`. One line each, copied from project rules.
- No emojis in code/comments. Immutability — never mutate objects/arrays.
- No mock-based or component tests — tests cover pure utility functions only (project uses real Supabase). TDD applies to the pure helpers (Task 1); DB/action/UI tasks are verified with `npx tsc --noEmit`, `npm run lint`, and `npm run build`.
- Validate all IDs with `isValidUUID()` from `src/lib/validations/common.ts`.
- Server actions guard via `verifyAdminOrTrainer()` / `verifyAdmin()` from `src/lib/actions/shared/verify-admin`.
- Path alias `@/` maps to `src/`. Files 200-400 lines typical, 800 max.
- Preset categories (verbatim, single source of truth): `תזונה`, `שימור לקוחות`, `ישיבות / פגישות צוות`, `אדמיניסטרציה (ניירת)`, `שיווק ותוכן`, `תחזוקת מתקן`.

---

### Task 1: Categories constant + pure helpers (split & validate)

**Files:**
- Modify: `src/lib/constants/shifts.ts`
- Create: `src/lib/utils/shift-other-purpose.ts`
- Test: `src/lib/utils/__tests__/shift-other-purpose.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `SHIFT_OTHER_PURPOSE_CATEGORIES: readonly string[]` and `type ShiftOtherPurposeCategory` (from `@/lib/constants/shifts`).
  - `splitShiftMinutes(shift: ShiftTimeInput, now?: number): ShiftMinutesSplit` where `ShiftTimeInput = { start_time: string; end_time: string | null; other_purpose_minutes: number }` and `ShiftMinutesSplit = { grossMinutes: number; otherMinutes: number; trainingMinutes: number }`.
  - `validateOtherPurpose(minutes: number, category: string | null, shiftDurationMinutes: number): { ok: true; minutes: number; category: ShiftOtherPurposeCategory | null } | { ok: false; error: string }`.

- [ ] **Step 1: Add the categories constant**

Append to `src/lib/constants/shifts.ts` (keep the existing `MAX_SHIFT_HOURS`):

```ts
export const SHIFT_OTHER_PURPOSE_CATEGORIES = [
  "תזונה",
  "שימור לקוחות",
  "ישיבות / פגישות צוות",
  "אדמיניסטרציה (ניירת)",
  "שיווק ותוכן",
  "תחזוקת מתקן",
] as const;

export type ShiftOtherPurposeCategory =
  (typeof SHIFT_OTHER_PURPOSE_CATEGORIES)[number];
```

- [ ] **Step 2: Write the failing tests**

Create `src/lib/utils/__tests__/shift-other-purpose.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { splitShiftMinutes, validateOtherPurpose } from "../shift-other-purpose";

const FIXED_NOW = new Date("2026-06-22T12:00:00Z").getTime();

describe("splitShiftMinutes", () => {
  it("splits an ended shift into training and other", () => {
    expect(
      splitShiftMinutes({
        start_time: "2026-06-22T08:00:00Z",
        end_time: "2026-06-22T12:00:00Z",
        other_purpose_minutes: 30,
      }),
    ).toEqual({ grossMinutes: 240, otherMinutes: 30, trainingMinutes: 210 });
  });

  it("clamps other to gross when it exceeds the shift", () => {
    expect(
      splitShiftMinutes({
        start_time: "2026-06-22T08:00:00Z",
        end_time: "2026-06-22T09:00:00Z",
        other_purpose_minutes: 120,
      }),
    ).toEqual({ grossMinutes: 60, otherMinutes: 60, trainingMinutes: 0 });
  });

  it("uses now for an open shift", () => {
    const r = splitShiftMinutes(
      { start_time: "2026-06-22T11:00:00Z", end_time: null, other_purpose_minutes: 0 },
      FIXED_NOW,
    );
    expect(r.grossMinutes).toBe(60);
    expect(r.trainingMinutes).toBe(60);
  });
});

describe("validateOtherPurpose", () => {
  it("accepts valid minutes + preset category within the shift", () => {
    expect(validateOtherPurpose(30, "תזונה", 240)).toEqual({
      ok: true,
      minutes: 30,
      category: "תזונה",
    });
  });

  it("treats zero as a clear (no category)", () => {
    expect(validateOtherPurpose(0, "תזונה", 240)).toEqual({
      ok: true,
      minutes: 0,
      category: null,
    });
  });

  it("rejects minutes over the shift duration", () => {
    expect(validateOtherPurpose(300, "תזונה", 240)).toMatchObject({ ok: false });
  });

  it("rejects an unknown category", () => {
    expect(validateOtherPurpose(30, "משהו אחר", 240)).toMatchObject({ ok: false });
  });

  it("rejects minutes > 0 with no category", () => {
    expect(validateOtherPurpose(30, null, 240)).toMatchObject({ ok: false });
  });

  it("rejects non-integer minutes", () => {
    expect(validateOtherPurpose(30.5, "תזונה", 240)).toMatchObject({ ok: false });
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npm run test:run -- src/lib/utils/__tests__/shift-other-purpose.test.ts`
Expected: FAIL — `Failed to resolve import "../shift-other-purpose"`.

- [ ] **Step 4: Implement the helpers**

Create `src/lib/utils/shift-other-purpose.ts`:

```ts
import {
  SHIFT_OTHER_PURPOSE_CATEGORIES,
  type ShiftOtherPurposeCategory,
} from "@/lib/constants/shifts";

export interface ShiftTimeInput {
  readonly start_time: string;
  readonly end_time: string | null;
  readonly other_purpose_minutes: number;
}

export interface ShiftMinutesSplit {
  readonly grossMinutes: number;
  readonly otherMinutes: number;
  readonly trainingMinutes: number;
}

/** Split a shift into gross / other-purpose / training minutes. Other is
 * clamped to the gross duration so training never goes negative. For an open
 * shift (no end_time) the gross runs to `now`. */
export function splitShiftMinutes(
  shift: ShiftTimeInput,
  now: number = Date.now(),
): ShiftMinutesSplit {
  const start = new Date(shift.start_time).getTime();
  const end = shift.end_time ? new Date(shift.end_time).getTime() : now;
  const grossMinutes = Math.max(0, Math.round((end - start) / 60000));
  const otherMinutes = Math.max(
    0,
    Math.min(shift.other_purpose_minutes ?? 0, grossMinutes),
  );
  return {
    grossMinutes,
    otherMinutes,
    trainingMinutes: grossMinutes - otherMinutes,
  };
}

export type OtherPurposeValidation =
  | { ok: true; minutes: number; category: ShiftOtherPurposeCategory | null }
  | { ok: false; error: string };

/** Validate an other-purpose entry. minutes <= 0 means "clear" (0 + null).
 * Otherwise minutes must be a positive integer within the shift duration and
 * the category must be one of the presets. */
export function validateOtherPurpose(
  minutes: number,
  category: string | null,
  shiftDurationMinutes: number,
): OtherPurposeValidation {
  if (!minutes || minutes <= 0) {
    return { ok: true, minutes: 0, category: null };
  }
  if (!Number.isInteger(minutes)) {
    return { ok: false, error: "משך זמן לא תקין" };
  }
  if (
    !category ||
    !SHIFT_OTHER_PURPOSE_CATEGORIES.includes(category as ShiftOtherPurposeCategory)
  ) {
    return { ok: false, error: "יש לבחור קטגוריה" };
  }
  if (minutes > shiftDurationMinutes) {
    return { ok: false, error: "הזמן למטרות אחרות חורג ממשך המשמרת" };
  }
  return { ok: true, minutes, category: category as ShiftOtherPurposeCategory };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npm run test:run -- src/lib/utils/__tests__/shift-other-purpose.test.ts`
Expected: PASS (10 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/constants/shifts.ts src/lib/utils/shift-other-purpose.ts src/lib/utils/__tests__/shift-other-purpose.test.ts
git commit -m "feat(shifts): other-purpose categories constant and split/validate helpers"
```

---

### Task 2: Migration + generated type

**Files:**
- Create: `supabase/migrations/20260622160000_trainer_shifts_other_purpose.sql`
- Modify: `src/types/database.ts:1132-1163` (the `trainer_shifts` Row/Insert/Update)

**Interfaces:**
- Consumes: the preset list (mirrored verbatim into the DB CHECK).
- Produces: `TrainerShift` (already `Database["public"]["Tables"]["trainer_shifts"]["Row"]`) gains `other_purpose_minutes: number` and `other_purpose_category: string | null`.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260622160000_trainer_shifts_other_purpose.sql`:

```sql
-- Trainer shifts: record a single categorised "other purposes" time entry
-- (e.g. nutrition, customer retention) so admins can see training time
-- separately from non-training time.

ALTER TABLE trainer_shifts
  ADD COLUMN IF NOT EXISTS other_purpose_minutes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_purpose_category text;

ALTER TABLE trainer_shifts
  ADD CONSTRAINT trainer_shifts_other_purpose_minutes_nonneg
    CHECK (other_purpose_minutes >= 0);

ALTER TABLE trainer_shifts
  ADD CONSTRAINT trainer_shifts_other_purpose_category_valid
    CHECK (other_purpose_category IS NULL OR other_purpose_category IN (
      'תזונה',
      'שימור לקוחות',
      'ישיבות / פגישות צוות',
      'אדמיניסטרציה (ניירת)',
      'שיווק ותוכן',
      'תחזוקת מתקן'
    ));

-- Single-entry semantics: both set together or both empty.
ALTER TABLE trainer_shifts
  ADD CONSTRAINT trainer_shifts_other_purpose_paired
    CHECK (
      (other_purpose_minutes > 0 AND other_purpose_category IS NOT NULL)
      OR (other_purpose_minutes = 0 AND other_purpose_category IS NULL)
    );
```

- [ ] **Step 2: Add the columns to the generated type**

In `src/types/database.ts`, inside `trainer_shifts:`, add the two fields to each block. Row (after `flagged_for_review: boolean;`):

```ts
          other_purpose_minutes: number;
          other_purpose_category: string | null;
```

Insert (after `flagged_for_review?: boolean;`):

```ts
          other_purpose_minutes?: number;
          other_purpose_category?: string | null;
```

Update (after `flagged_for_review?: boolean;`):

```ts
          other_purpose_minutes?: number;
          other_purpose_category?: string | null;
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit --pretty false`
Expected: exit 0, no output.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260622160000_trainer_shifts_other_purpose.sql src/types/database.ts
git commit -m "feat(shifts): add other_purpose columns to trainer_shifts"
```

> **Integration note (not a code step):** apply with `supabase db push` (migration history is clean, so it applies only this file) — or via the Supabase MCP `apply_migration` — before deploying the code that reads/writes these columns.

---

### Task 3: Server action `setShiftOtherPurposeAction`

**Files:**
- Modify: `src/lib/actions/trainer-shifts.ts` (add export at end of the action group, before the "Failed shift sync" section comment at line ~351)

**Interfaces:**
- Consumes: `validateOtherPurpose` (Task 1), `isValidUUID`, `verifyAdminOrTrainer`, `createClient`, `revalidatePath`, the `ActionResult` type already declared at the top of the file.
- Produces: `setShiftOtherPurposeAction(input: { shiftId: string; minutes: number; category: string | null }): Promise<ActionResult>`.

- [ ] **Step 1: Add the import**

At the top of `src/lib/actions/trainer-shifts.ts`, after the existing imports, add:

```ts
import { validateOtherPurpose } from "@/lib/utils/shift-other-purpose";
```

- [ ] **Step 2: Add the action**

Insert before the `// ---- Failed shift sync ...` divider comment (around line 351):

```ts
export async function setShiftOtherPurposeAction(input: {
  shiftId: string;
  minutes: number;
  category: string | null;
}): Promise<ActionResult> {
  if (!isValidUUID(input.shiftId)) return { error: "מזהה משמרת לא תקין" };

  const result = await verifyAdminOrTrainer();
  if (result.error) return { error: result.error };
  const user = result.user!;
  const isAdmin = result.profile!.role === "admin";

  const supabase = await createClient();

  const { data: shift } = await supabase
    .from("trainer_shifts")
    .select("id, trainer_id, start_time, end_time")
    .eq("id", input.shiftId)
    .maybeSingle();

  if (!shift) return { error: "משמרת לא נמצאה" };
  if (!isAdmin && shift.trainer_id !== user.id) {
    return { error: "אין הרשאה לערוך משמרת זו" };
  }
  if (!shift.end_time) {
    return { error: "לא ניתן לעדכן זמן למשמרת פעילה" };
  }

  const durationMinutes = Math.round(
    (new Date(shift.end_time).getTime() - new Date(shift.start_time).getTime()) /
      60000,
  );

  const validated = validateOtherPurpose(
    input.minutes,
    input.category,
    durationMinutes,
  );
  if (!validated.ok) return { error: validated.error };

  const { error: updateError } = await supabase
    .from("trainer_shifts")
    .update({
      other_purpose_minutes: validated.minutes,
      other_purpose_category: validated.category,
    })
    .eq("id", input.shiftId);

  if (updateError) {
    console.error("Set shift other purpose error:", updateError);
    return { error: "שגיאה בעדכון" };
  }

  revalidatePath("/admin/shifts");
  return { success: true };
}
```

- [ ] **Step 3: Type-check and lint**

Run: `npx tsc --noEmit --pretty false && npm run lint`
Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add src/lib/actions/trainer-shifts.ts
git commit -m "feat(shifts): setShiftOtherPurposeAction with auth + duration validation"
```

---

### Task 4: `ShiftOtherPurposeDialog` component

**Files:**
- Create: `src/components/admin/shifts/ShiftOtherPurposeDialog.tsx`

**Interfaces:**
- Consumes: `setShiftOtherPurposeAction` (Task 3), `SHIFT_OTHER_PURPOSE_CATEGORIES` (Task 1), `splitShiftMinutes` (Task 1), `TrainerShift` type.
- Produces: `ShiftOtherPurposeDialog({ open, onOpenChange, shift }: { open: boolean; onOpenChange: (open: boolean) => void; shift: TrainerShift })`.

- [ ] **Step 1: Create the component**

Create `src/components/admin/shifts/ShiftOtherPurposeDialog.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { setShiftOtherPurposeAction } from "@/lib/actions/trainer-shifts";
import { SHIFT_OTHER_PURPOSE_CATEGORIES } from "@/lib/constants/shifts";
import { splitShiftMinutes } from "@/lib/utils/shift-other-purpose";
import type { TrainerShift } from "@/types/database";

const CLEAR_VALUE = "__none__";
const MINUTE_PRESETS = [15, 30, 45, 60, 90] as const;

interface ShiftOtherPurposeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shift: TrainerShift;
}

export function ShiftOtherPurposeDialog({
  open,
  onOpenChange,
  shift,
}: ShiftOtherPurposeDialogProps) {
  const router = useRouter();
  const { grossMinutes } = splitShiftMinutes({
    start_time: shift.start_time,
    end_time: shift.end_time,
    other_purpose_minutes: 0,
  });

  const [category, setCategory] = useState<string>(
    shift.other_purpose_category ?? CLEAR_VALUE,
  );
  const [minutes, setMinutes] = useState<string>(
    shift.other_purpose_minutes ? String(shift.other_purpose_minutes) : "",
  );
  const [loading, setLoading] = useState(false);

  const isClear = category === CLEAR_VALUE;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsedMinutes = isClear ? 0 : Number(minutes);
    if (!isClear && (!Number.isInteger(parsedMinutes) || parsedMinutes <= 0)) {
      toast.error("יש להזין משך זמן בדקות");
      return;
    }
    if (!isClear && parsedMinutes > grossMinutes) {
      toast.error("הזמן למטרות אחרות חורג ממשך המשמרת");
      return;
    }

    setLoading(true);
    const result = await setShiftOtherPurposeAction({
      shiftId: shift.id,
      minutes: parsedMinutes,
      category: isClear ? null : category,
    });
    setLoading(false);

    if (result.error) {
      toast.error(result.error);
      return;
    }
    toast.success("עודכן");
    onOpenChange(false);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>זמן למטרות אחרות</DialogTitle>
          <DialogDescription>
            כמה מזמן המשמרת ({grossMinutes} דקות) הוקדש לפעילות שאינה אימון.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>קטגוריה</Label>
            <Select value={category} onValueChange={setCategory} dir="rtl">
              <SelectTrigger>
                <SelectValue placeholder="בחר קטגוריה" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={CLEAR_VALUE}>ללא / נקה</SelectItem>
                {SHIFT_OTHER_PURPOSE_CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!isClear && (
            <div className="space-y-2">
              <Label htmlFor="other-minutes">דקות</Label>
              <div className="flex flex-wrap gap-1.5">
                {MINUTE_PRESETS.filter((p) => p <= grossMinutes).map((p) => (
                  <Button
                    key={p}
                    type="button"
                    variant={Number(minutes) === p ? "default" : "outline"}
                    size="sm"
                    onClick={() => setMinutes(String(p))}
                  >
                    {p}
                  </Button>
                ))}
              </div>
              <Input
                id="other-minutes"
                type="number"
                inputMode="numeric"
                min={1}
                max={grossMinutes}
                dir="ltr"
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
                placeholder="דקות"
              />
            </div>
          )}

          <div className="flex gap-2 justify-end">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              ביטול
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
              שמור
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 2: Type-check and lint**

Run: `npx tsc --noEmit --pretty false && npm run lint`
Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/shifts/ShiftOtherPurposeDialog.tsx
git commit -m "feat(shifts): ShiftOtherPurposeDialog for editing a shift's other-purpose time"
```

---

### Task 5: Wire into `TrainerShiftsView` (trigger + split display)

**Files:**
- Modify: `src/components/admin/shifts/TrainerShiftsView.tsx`

**Interfaces:**
- Consumes: `ShiftOtherPurposeDialog` (Task 4), `splitShiftMinutes` (Task 1).
- Produces: no new exports; updates the shifts table UI.

- [ ] **Step 1: Add imports**

Add to the imports of `src/components/admin/shifts/TrainerShiftsView.tsx`:

```ts
import { ShiftOtherPurposeDialog } from "@/components/admin/shifts/ShiftOtherPurposeDialog";
import { splitShiftMinutes } from "@/lib/utils/shift-other-purpose";
import { Activity } from "lucide-react";
```

- [ ] **Step 2: Extend the per-trainer summary with training/other totals**

In the `TrainerSummary` interface add:

```ts
  trainingMinutes: number;
  otherMinutes: number;
```

In `aggregateByTrainer`, replace the per-shift accumulation so both new and existing entries add the split. Replace the `const duration = calcDurationMinutes(shift);` line and the two `totalMinutes`/init blocks with:

```ts
    const split = splitShiftMinutes({
      start_time: shift.start_time,
      end_time: shift.end_time,
      other_purpose_minutes: shift.other_purpose_minutes,
    });
    const duration = split.grossMinutes;

    if (existing) {
      existing.totalMinutes += duration;
      existing.trainingMinutes += split.trainingMinutes;
      existing.otherMinutes += split.otherMinutes;
      existing.shiftCount += 1;
      if (shift.flagged_for_review) existing.flaggedCount += 1;
      existing.shifts.push(shift);
    } else {
      map.set(shift.trainer_id, {
        trainerId: shift.trainer_id,
        trainerName: shift.trainer_name,
        totalMinutes: duration,
        trainingMinutes: split.trainingMinutes,
        otherMinutes: split.otherMinutes,
        shiftCount: 1,
        flaggedCount: shift.flagged_for_review ? 1 : 0,
        shifts: [shift],
      });
    }
```

- [ ] **Step 3: Add the dialog state**

After the existing `const [editRequestShift, setEditRequestShift] = useState<TrainerShift | null>(null);`, add:

```ts
  const [otherPurposeShift, setOtherPurposeShift] =
    useState<TrainerShift | null>(null);
```

- [ ] **Step 4: Add a top "other purposes" summary card**

After the existing total-hours `<Card>` (the one showing `סה"כ שעות`), add a card showing the month's other-purpose total:

```tsx
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="bg-purple-500 rounded-xl p-3">
                <Activity className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">מטרות אחרות</p>
                <p className="text-2xl font-bold">
                  {formatDuration(
                    summaries.reduce((sum, s) => sum + s.otherMinutes, 0),
                  )}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
```

- [ ] **Step 5: Show the other-purpose badge on each ended shift (mobile + desktop)**

In the **mobile** expanded shift block, after the start/end time row, add:

```tsx
                          {shift.end_time && shift.other_purpose_minutes > 0 && (
                            <div className="text-xs text-purple-700">
                              אחר: {shift.other_purpose_minutes} ד׳ ·{" "}
                              {shift.other_purpose_category}
                            </div>
                          )}
```

In the **desktop** expanded shift row's duration `<TableCell>` (the one with `formatDuration(calcDurationMinutes(shift))`), after the existing badges add:

```tsx
                              {shift.other_purpose_minutes > 0 && (
                                <Badge
                                  variant="outline"
                                  className="ms-2 text-xs text-purple-700"
                                >
                                  אחר: {shift.other_purpose_minutes} ד׳ ·{" "}
                                  {shift.other_purpose_category}
                                </Badge>
                              )}
```

- [ ] **Step 6: Add the edit trigger (mobile)**

In the mobile per-shift action area: inside the `isAdmin` action row add (alongside ערוך / מחק):

```tsx
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs h-7"
                                onClick={() => setOtherPurposeShift(shift)}
                                disabled={!shift.end_time}
                              >
                                <Activity className="h-3 w-3" />
                                זמן אחר
                              </Button>
```

And in the `!isAdmin && shift.end_time` block (next to "בקש שינוי"), add the same button:

```tsx
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs h-7"
                                onClick={() => setOtherPurposeShift(shift)}
                              >
                                <Activity className="h-3 w-3" />
                                זמן אחר
                              </Button>
```

- [ ] **Step 7: Add the edit trigger (desktop)**

In the desktop admin actions cell (the `flex items-center gap-1` group), add before the delete dialog:

```tsx
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setOtherPurposeShift(shift);
                                    }}
                                    disabled={!shift.end_time}
                                  >
                                    <Activity className="h-3 w-3" />
                                  </Button>
```

In the desktop trainer (non-admin) cell — the `{!isAdmin && shift.end_time && (...)}` block holding "בקש שינוי" — wrap both buttons in a `flex items-center gap-1` and add:

```tsx
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-xs h-7"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOtherPurposeShift(shift);
                                  }}
                                >
                                  <Activity className="h-3 w-3 me-1" />
                                  זמן אחר
                                </Button>
```

- [ ] **Step 8: Render the dialog**

Before the closing `</div>` of the component (after the `EditShiftRequestDialog` block), add:

```tsx
      {otherPurposeShift && (
        <ShiftOtherPurposeDialog
          key={otherPurposeShift.id}
          open={!!otherPurposeShift}
          onOpenChange={(open) => {
            if (!open) setOtherPurposeShift(null);
          }}
          shift={otherPurposeShift}
        />
      )}
```

- [ ] **Step 9: Type-check, lint, build**

Run: `npx tsc --noEmit --pretty false && npm run lint && npm run build`
Expected: all exit 0.

- [ ] **Step 10: Commit**

```bash
git add src/components/admin/shifts/TrainerShiftsView.tsx
git commit -m "feat(shifts): edit other-purpose time and show training/other split in shifts table"
```

---

## Final verification (after all tasks)

- [ ] `npm run test:run` — all suites pass (Task 1 adds 10 tests).
- [ ] `npx tsc --noEmit` — clean.
- [ ] `npm run build` — succeeds.
- [ ] Apply the migration to the target database (`supabase db push`) before deploying.
- [ ] Manual: as a trainer, open an ended own shift in the shifts table, set 30 min · תזונה, confirm the badge and the per-trainer "מטרות אחרות" total; clear it; confirm an admin can set it on any shift and the over-length value is rejected.

## Self-Review

- **Spec coverage:** data model (Task 2), categories constant (Task 1), server action with own-shift/admin auth + duration cap + ended-only (Task 3), dialog with preset minutes + preset category + clear (Task 4), trigger for trainer-own/admin + training/other split display + per-trainer totals (Task 5), pure-helper tests (Task 1). All spec sections map to a task.
- **Placeholders:** none — every code step shows full content.
- **Type consistency:** `splitShiftMinutes`/`validateOtherPurpose`/`setShiftOtherPurposeAction`/`ShiftOtherPurposeDialog` signatures match across tasks; `other_purpose_minutes`/`other_purpose_category` names identical in migration, type, action, and UI.
