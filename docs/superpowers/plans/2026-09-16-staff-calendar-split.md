# Staff Calendar Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the staff daily board into a booking calendar (`/admin/calendar`, who is in which slot) and a session-building list (`/admin/schedule`, what each rostered trainee does), for both branches.

**Architecture:** No database change. Pure functions in `src/lib/schedule/` derive the worklist, the calendar's selected day, and roster add/remove decisions; they are unit-tested first. Two new server actions edit a roster one entry at a time so staff edits never overwrite trainee self-bookings. The calendar renders a phone day view and a desktop week grid in one tree, switched with CSS.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Supabase, Tailwind 4, Radix (shadcn), Vitest.

**Spec:** `docs/superpowers/specs/2026-09-16-staff-calendar-split-design.md`

## Global Constraints

- All user-facing text in Hebrew; `dir="rtl"`; logical CSS (`ms-`, `me-`, `ps-`, `pe-`, `start`, `end`), never `left`/`right`.
- No emojis in code, comments or docs. Immutability: never mutate arrays or objects (`[...arr].sort()`, not `arr.sort()`).
- Every server action: `"use server"`, `verifyAdminOrTrainer()` first, Zod validation, UUID validation, branch check, returns `{ success: true, data } | { error: string }` with a Hebrew message, logs with `console.error` on failure.
- A non-action helper imported by actions must NOT live in a `"use server"` file (every export of such a file becomes a callable endpoint).
- Tests cover pure functions only; no mocks, no Supabase in tests.
- Files 200-400 lines typical, 800 max. Do not grow existing files over 400 lines.
- Baseline: 20 localStorage test failures in goals and streak-tracking exist on main and are not regressions.
- Commits: conventional with scope `schedule`, ending with `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`. The husky post-checkout/post-commit hooks print an error (graphify / lint-staged); it is harmless, the commit still lands.
- Commands: `npm run test:run -- <path>`, `npx tsc --noEmit`, `npm run lint`, `npm run build`.

---

## File Structure

| File | Responsibility |
|------|----------------|
| `src/lib/schedule/session-worklist.ts` (new) | Slots + session summaries -> grouped worklist rows, filters, progress |
| `src/lib/schedule/calendar.ts` (new) | `?date=` resolution, the week's visible days, finding the selected day |
| `src/lib/schedule/roster-entry.ts` (new) | Decide insert / reinstate / reject for an add; allow or refuse a remove |
| `src/lib/validations/schedule.ts` (modify) | Roster add/remove schemas; update schema with optional roster |
| `src/lib/actions/shared/verify-roster-trainees.ts` (new, moved) | Linked trainees exist, are active, and belong to the branch |
| `src/lib/actions/daily-schedule-roster.ts` (new) | `addSlotTraineeAction`, `removeSlotTraineeAction` |
| `src/lib/actions/daily-schedule-mutate.ts` (modify) | Update leaves roster alone when absent |
| `src/components/admin/schedule/TraineeSearch.tsx` (new, extracted) | Trainee combobox with free-text fallback |
| `src/components/admin/schedule/SlotFormDialog.tsx` (modify) | Roster only on create |
| `src/components/admin/calendar/RosterSheet.tsx` (new) | One slot's roster: add, remove, plan and medical, edit and delete slot |
| `src/components/admin/calendar/DateStrip.tsx` (new) | Phone day picker |
| `src/components/admin/calendar/CalendarDayList.tsx` (new) | Phone slots for one day on the timeline rail |
| `src/components/admin/calendar/CalendarView.tsx` (new) | Header, actions, both layouts, dialogs |
| `src/components/admin/schedule/week/WeekDayColumn.tsx`, `WeekSlotCard.tsx` (modify) | Desktop grid column and slot card |
| `src/app/admin/calendar/page.tsx`, `loading.tsx` (new) | Calendar data loading |
| `src/components/admin/schedule/SessionWorklist.tsx` (new) | Session-building list UI |
| `src/app/admin/schedule/page.tsx` (rewrite) | Worklist data loading |
| `src/components/admin/schedule/SessionBuilder.tsx`, session page (modify) | Back link keeps branch |
| `src/app/admin/weekly-schedule/page.tsx`, `WeeklySchedulePageClient.tsx` (modify) | Template only |
| `src/lib/navigation/admin-nav.ts`, `revalidate-schedule.ts`, three actions (modify) | Nav and cache |
| `ScheduleDayView.tsx`, `SlotCard.tsx`, `DatedWeekView.tsx` (delete) | Replaced |

---

### Task 1: Session worklist derivation

**Files:**
- Create: `src/lib/schedule/session-worklist.ts`
- Test: `src/lib/schedule/__tests__/session-worklist.test.ts`

**Interfaces:**
- Consumes: `ScheduleSlot`, `SlotTrainee` from `@/types/schedule`; `SessionSummary` from `@/types/training-session`.
- Produces:
  - `type WorklistStatus = "not_built" | "built" | "completed"`
  - `interface WorklistRow { rosterEntryId: string; traineeId: string; traineeName: string; status: WorklistStatus; exerciseCount: number }`
  - `interface WorklistGroup { slotId: string; startTime: string /* HH:MM */; trainerId: string | null; trainerName: string | null; locationHe: string | null; rows: WorklistRow[] }`
  - `interface WorklistFilters { mineOnly: boolean; pendingOnly: boolean; currentUserId: string }`
  - `buildSessionWorklist(slots: ScheduleSlot[], summaries: Record<string, SessionSummary>): WorklistGroup[]`
  - `filterWorklist(groups: WorklistGroup[], filters: WorklistFilters): WorklistGroup[]`
  - `worklistProgress(groups: WorklistGroup[]): { built: number; total: number }`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";

import {
  buildSessionWorklist,
  filterWorklist,
  worklistProgress,
} from "../session-worklist";
import type { ScheduleSlot, SlotTrainee } from "@/types/schedule";
import type { SessionSummary } from "@/types/training-session";

const LIDOR = "11111111-1111-4111-8111-111111111111";
const NADAV = "22222222-2222-4222-8222-222222222222";
const NOAM = "33333333-3333-4333-8333-333333333333";
const OMER = "44444444-4444-4444-8444-444444444444";

function entry(overrides: Partial<SlotTrainee> = {}): SlotTrainee {
  return {
    id: "entry-1",
    slot_id: "slot-1",
    trainee_id: NOAM,
    trainee_name: "נועם",
    order_index: 0,
    source: "staff",
    booked_at: null,
    cancelled_at: null,
    late_cancel: false,
    reminded_at: null,
    ...overrides,
  };
}

function slot(overrides: Partial<ScheduleSlot> = {}): ScheduleSlot {
  return {
    id: "slot-1",
    schedule_date: "2026-09-16",
    start_time: "17:00:00",
    trainer_id: LIDOR,
    trainer_name: "לידור",
    focus_he: null,
    location_he: "סטודיו",
    branch_id: null,
    band_id: null,
    max_trainees: null,
    trainees: [],
    created_by: LIDOR,
    created_at: "2026-09-10T00:00:00Z",
    updated_at: "2026-09-10T00:00:00Z",
    ...overrides,
  };
}

function summary(traineeId: string, overrides: Partial<SessionSummary> = {}): SessionSummary {
  return { id: `session-${traineeId}`, trainee_id: traineeId, exerciseCount: 5, completed_at: null, ...overrides };
}

describe("buildSessionWorklist", () => {
  test("excludes free-text and cancelled entries", () => {
    const groups = buildSessionWorklist(
      [
        slot({
          trainees: [
            entry({ id: "a", trainee_id: NOAM }),
            entry({ id: "b", trainee_id: null, trainee_name: "אורח" }),
            entry({ id: "c", trainee_id: OMER, cancelled_at: "2026-09-15T10:00:00Z", late_cancel: true }),
          ],
        }),
      ],
      {},
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].rows.map((row) => row.rosterEntryId)).toEqual(["a"]);
  });

  test("maps session summaries to not_built, built and completed", () => {
    const groups = buildSessionWorklist(
      [
        slot({
          trainees: [
            entry({ id: "a", trainee_id: NOAM, order_index: 0 }),
            entry({ id: "b", trainee_id: OMER, order_index: 1 }),
            entry({ id: "c", trainee_id: NADAV, order_index: 2 }),
          ],
        }),
      ],
      {
        [OMER]: summary(OMER, { exerciseCount: 7 }),
        [NADAV]: summary(NADAV, { completed_at: "2026-09-16T18:00:00Z" }),
      },
    );
    expect(groups[0].rows.map((row) => [row.status, row.exerciseCount])).toEqual([
      ["not_built", 0],
      ["built", 7],
      ["completed", 5],
    ]);
  });

  test("sorts slots by start time then trainer name, rows by order_index", () => {
    const groups = buildSessionWorklist(
      [
        slot({ id: "late", start_time: "18:00:00" }),
        slot({ id: "nadav", start_time: "17:00:00", trainer_name: "נדב" }),
        slot({
          id: "lidor",
          start_time: "17:00:00",
          trainer_name: "לידור",
          trainees: [
            entry({ id: "second", trainee_id: OMER, order_index: 1 }),
            entry({ id: "first", trainee_id: NOAM, order_index: 0 }),
          ],
        }),
      ],
      {},
    );
    expect(groups.map((group) => group.slotId)).toEqual(["lidor", "nadav", "late"]);
    expect(groups[0].startTime).toBe("17:00");
    expect(groups[0].rows.map((row) => row.rosterEntryId)).toEqual(["first", "second"]);
  });

  test("a trainee in two slots appears in both, sharing the day's status", () => {
    const groups = buildSessionWorklist(
      [
        slot({ id: "one", start_time: "16:00:00", trainees: [entry({ id: "a", trainee_id: NOAM })] }),
        slot({ id: "two", start_time: "18:00:00", trainees: [entry({ id: "b", trainee_id: NOAM })] }),
      ],
      { [NOAM]: summary(NOAM) },
    );
    expect(groups.map((group) => group.rows[0].status)).toEqual(["built", "built"]);
  });

  test("does not mutate the input slots", () => {
    const input = [slot({ id: "b", start_time: "18:00:00" }), slot({ id: "a", start_time: "16:00:00" })];
    buildSessionWorklist(input, {});
    expect(input.map((s) => s.id)).toEqual(["b", "a"]);
  });
});

describe("filterWorklist", () => {
  const groups = buildSessionWorklist(
    [
      slot({ id: "mine", trainer_id: LIDOR, trainees: [entry({ id: "a", trainee_id: NOAM })] }),
      slot({
        id: "theirs",
        start_time: "18:00:00",
        trainer_id: NADAV,
        trainees: [entry({ id: "b", trainee_id: OMER })],
      }),
    ],
    { [NOAM]: summary(NOAM) },
  );

  test("no filters keeps every group with rows", () => {
    const result = filterWorklist(groups, { mineOnly: false, pendingOnly: false, currentUserId: LIDOR });
    expect(result.map((group) => group.slotId)).toEqual(["mine", "theirs"]);
  });

  test("mineOnly keeps the viewer's slots", () => {
    const result = filterWorklist(groups, { mineOnly: true, pendingOnly: false, currentUserId: LIDOR });
    expect(result.map((group) => group.slotId)).toEqual(["mine"]);
  });

  test("pendingOnly keeps not_built rows and drops groups left empty", () => {
    const result = filterWorklist(groups, { mineOnly: false, pendingOnly: true, currentUserId: LIDOR });
    expect(result.map((group) => group.slotId)).toEqual(["theirs"]);
  });

  test("drops groups with no linked trainees", () => {
    const withEmpty = buildSessionWorklist([slot({ id: "empty" })], {});
    expect(filterWorklist(withEmpty, { mineOnly: false, pendingOnly: false, currentUserId: LIDOR })).toEqual([]);
  });
});

describe("worklistProgress", () => {
  test("counts built and completed rows over all rows", () => {
    const groups = buildSessionWorklist(
      [
        slot({
          trainees: [
            entry({ id: "a", trainee_id: NOAM }),
            entry({ id: "b", trainee_id: OMER }),
            entry({ id: "c", trainee_id: NADAV }),
          ],
        }),
      ],
      { [NOAM]: summary(NOAM), [NADAV]: summary(NADAV, { completed_at: "2026-09-16T18:00:00Z" }) },
    );
    expect(worklistProgress(groups)).toEqual({ built: 2, total: 3 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/lib/schedule/__tests__/session-worklist.test.ts`
Expected: FAIL, cannot resolve `../session-worklist`.

- [ ] **Step 3: Write the implementation**

```ts
import type { ScheduleSlot, SlotTrainee } from "@/types/schedule";
import type { SessionSummary } from "@/types/training-session";

/**
 * The session-building list: every active, linked roster entry for one day,
 * grouped by slot, with whether that trainee's session is built.
 *
 * Free-text roster names have no account and cannot receive a session, and a
 * cancelled entry is not coming, so neither is work for a trainer.
 */

export type WorklistStatus = "not_built" | "built" | "completed";

export interface WorklistRow {
  rosterEntryId: string;
  traineeId: string;
  traineeName: string;
  status: WorklistStatus;
  exerciseCount: number;
}

export interface WorklistGroup {
  slotId: string;
  /** HH:MM. */
  startTime: string;
  trainerId: string | null;
  trainerName: string | null;
  locationHe: string | null;
  rows: WorklistRow[];
}

export interface WorklistFilters {
  mineOnly: boolean;
  pendingOnly: boolean;
  currentUserId: string;
}

type LinkedEntry = SlotTrainee & { trainee_id: string };

function isLinkedActive(entry: SlotTrainee): entry is LinkedEntry {
  return entry.trainee_id !== null && entry.cancelled_at === null;
}

function statusOf(summary: SessionSummary | undefined): WorklistStatus {
  if (!summary) return "not_built";
  return summary.completed_at ? "completed" : "built";
}

function compareSlots(a: ScheduleSlot, b: ScheduleSlot): number {
  return (
    a.start_time.localeCompare(b.start_time) ||
    (a.trainer_name ?? "").localeCompare(b.trainer_name ?? "", "he")
  );
}

/** Sessions are per trainee per day, so a trainee in two slots shares one status. */
export function buildSessionWorklist(
  slots: ScheduleSlot[],
  summaries: Record<string, SessionSummary>,
): WorklistGroup[] {
  return [...slots].sort(compareSlots).map((slot) => ({
    slotId: slot.id,
    startTime: slot.start_time.slice(0, 5),
    trainerId: slot.trainer_id,
    trainerName: slot.trainer_name,
    locationHe: slot.location_he,
    rows: slot.trainees
      .filter(isLinkedActive)
      .sort((a, b) => a.order_index - b.order_index)
      .map((entry) => {
        const summary = summaries[entry.trainee_id];
        return {
          rosterEntryId: entry.id,
          traineeId: entry.trainee_id,
          traineeName: entry.trainee_name,
          status: statusOf(summary),
          exerciseCount: summary?.exerciseCount ?? 0,
        };
      }),
  }));
}

/** Groups left with no rows are dropped: an empty slot is not work to do. */
export function filterWorklist(
  groups: WorklistGroup[],
  filters: WorklistFilters,
): WorklistGroup[] {
  return groups
    .filter((group) => !filters.mineOnly || group.trainerId === filters.currentUserId)
    .map((group) => ({
      ...group,
      rows: filters.pendingOnly
        ? group.rows.filter((row) => row.status === "not_built")
        : group.rows,
    }))
    .filter((group) => group.rows.length > 0);
}

export function worklistProgress(groups: WorklistGroup[]): { built: number; total: number } {
  const rows = groups.flatMap((group) => group.rows);
  return {
    built: rows.filter((row) => row.status !== "not_built").length,
    total: rows.length,
  };
}
```

Note: `.filter(isLinkedActive)` returns a new array, so the following `.sort` does not mutate `slot.trainees`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/lib/schedule/__tests__/session-worklist.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/schedule/session-worklist.ts src/lib/schedule/__tests__/session-worklist.test.ts
git commit -m "feat(schedule): derive the session-building worklist from the day's slots

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 2: Calendar date helpers

**Files:**
- Create: `src/lib/schedule/calendar.ts`
- Test: `src/lib/schedule/__tests__/calendar.test.ts`

**Interfaces:**
- Consumes: `addDays` from `@/lib/utils/iso-date`; `isValidDateString` from `@/lib/validations/common`; `Week`, `WeekDay` from `@/lib/utils/schedule-week`.
- Produces:
  - `const MAX_CALENDAR_OFFSET_DAYS = 364`
  - `resolveCalendarDate(raw: string | undefined, today: string): string`
  - `visibleDays(week: Week): WeekDay[]` (Sunday to Friday, plus Saturday when `week.saturday` is set)
  - `findDay(week: Week, date: string): WeekDay | null`

Saturday visibility itself is decided by `buildWeek` and already covered by `src/lib/utils/__tests__/schedule-week.test.ts`.

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";

import { findDay, resolveCalendarDate, visibleDays } from "../calendar";
import type { Week, WeekDay } from "@/lib/utils/schedule-week";

const TODAY = "2026-09-16";

function day(date: string, weekday: WeekDay["weekday"]): WeekDay {
  return {
    date,
    weekday,
    isToday: date === TODAY,
    isPast: date < TODAY,
    isBuilt: false,
    slots: [],
    onDuty: { bands: [], absences: [] } as unknown as WeekDay["onDuty"],
    extras: [],
  };
}

const SIX_DAYS = [
  day("2026-09-13", 0),
  day("2026-09-14", 1),
  day("2026-09-15", 2),
  day("2026-09-16", 3),
  day("2026-09-17", 4),
  day("2026-09-18", 5),
];

describe("resolveCalendarDate", () => {
  test("accepts a valid date inside the window", () => {
    expect(resolveCalendarDate("2026-09-20", TODAY)).toBe("2026-09-20");
  });

  test("falls back to today when missing or malformed", () => {
    expect(resolveCalendarDate(undefined, TODAY)).toBe(TODAY);
    expect(resolveCalendarDate("2026-13-01", TODAY)).toBe(TODAY);
    expect(resolveCalendarDate("yesterday", TODAY)).toBe(TODAY);
  });

  test("falls back to today beyond a year in either direction", () => {
    expect(resolveCalendarDate("2027-09-16", TODAY)).toBe(TODAY);
    expect(resolveCalendarDate("2025-09-16", TODAY)).toBe(TODAY);
    expect(resolveCalendarDate("9999-12-31", TODAY)).toBe(TODAY);
  });
});

describe("visibleDays and findDay", () => {
  test("six days without Saturday", () => {
    const week: Week = { days: SIX_DAYS, saturday: null };
    expect(visibleDays(week).map((d) => d.date)).toEqual(SIX_DAYS.map((d) => d.date));
    expect(findDay(week, "2026-09-19")).toBeNull();
  });

  test("Saturday is appended when the week has one", () => {
    const saturday = day("2026-09-19", 6);
    const week: Week = { days: SIX_DAYS, saturday };
    expect(visibleDays(week).at(-1)).toBe(saturday);
    expect(findDay(week, "2026-09-19")).toBe(saturday);
  });

  test("finds a weekday", () => {
    const week: Week = { days: SIX_DAYS, saturday: null };
    expect(findDay(week, TODAY)?.weekday).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:run -- src/lib/schedule/__tests__/calendar.test.ts`
Expected: FAIL, cannot resolve `../calendar`.

- [ ] **Step 3: Write the implementation**

```ts
import { addDays } from "@/lib/utils/iso-date";
import type { Week, WeekDay } from "@/lib/utils/schedule-week";
import { isValidDateString } from "@/lib/validations/common";

/**
 * A season in each direction covers every real use. The bound keeps a
 * hand-typed ?date= from reaching dates the ISO arithmetic cannot express
 * (addDays("9999-12-31", 1) is "+010000-01"), same as the weekly page.
 */
export const MAX_CALENDAR_OFFSET_DAYS = 364;

/** ISO strings compare lexicographically, so bounds are checked as strings. */
export function resolveCalendarDate(raw: string | undefined, today: string): string {
  if (!raw || !isValidDateString(raw)) return today;
  if (raw < addDays(today, -MAX_CALENDAR_OFFSET_DAYS)) return today;
  if (raw > addDays(today, MAX_CALENDAR_OFFSET_DAYS)) return today;
  return raw;
}

/** The days the calendar shows: Sunday to Friday, and Saturday only when it holds something. */
export function visibleDays(week: Week): WeekDay[] {
  return week.saturday ? [...week.days, week.saturday] : week.days;
}

/** Null for a Saturday with nothing on it, which the calendar renders as an empty day. */
export function findDay(week: Week, date: string): WeekDay | null {
  return visibleDays(week).find((candidate) => candidate.date === date) ?? null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:run -- src/lib/schedule/__tests__/calendar.test.ts`
Expected: PASS, 6 tests. If `isValidDateString("2026-13-01")` is accepted, check `src/lib/validations/common.ts`; do not weaken the test, the calendar must reject impossible months.

- [ ] **Step 5: Commit**

```bash
git add src/lib/schedule/calendar.ts src/lib/schedule/__tests__/calendar.test.ts
git commit -m "feat(schedule): calendar date resolution and visible days

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 3: Per-entry roster actions

**Files:**
- Create: `src/lib/schedule/roster-entry.ts`
- Test: `src/lib/schedule/__tests__/roster-entry.test.ts`
- Modify: `src/lib/validations/schedule.ts` (append schemas)
- Test: `src/lib/validations/__tests__/schedule.test.ts` (append)
- Create: `src/lib/actions/shared/verify-roster-trainees.ts` (moved code)
- Modify: `src/lib/actions/daily-schedule-mutate.ts` (remove the private `verifyRosterTrainees`, import the moved one)
- Create: `src/lib/actions/daily-schedule-roster.ts`
- Modify: `src/lib/actions/daily-schedule.ts` (barrel)

**Interfaces:**
- Consumes: `SlotTrainee`, `ScheduleSlot`, `SLOT_SELECT_WITH_TRAINEES` from `@/types/schedule`; `assertBranchWritable` from `@/lib/actions/shared/assert-branch`; `revalidateScheduleSurfaces` from `@/lib/actions/shared/revalidate-schedule`.
- Produces:
  - `type RosterAddPlan = { kind: "reject"; error: string } | { kind: "insert"; orderIndex: number; overCapacity: boolean } | { kind: "reinstate"; rowId: string; overCapacity: boolean }`
  - `planRosterAdd(roster: SlotTrainee[], entry: { traineeId: string | null; name: string }, maxTrainees: number | null): RosterAddPlan`
  - `planRosterRemove(row: SlotTrainee): string | null` (error message or null)
  - `rosterAddSchema`, `rosterRemoveSchema`, `type RosterAddInput`, `type RosterRemoveInput`
  - `verifyRosterTrainees(trainees: { traineeId: string | null; name: string }[], branchId: string): Promise<{ error: string | null }>`
  - `addSlotTraineeAction(input: RosterAddInput): Promise<{ success: true; data: { overCapacity: boolean } } | { error: string }>`
  - `removeSlotTraineeAction(input: RosterRemoveInput): Promise<{ success: true } | { error: string }>`

- [ ] **Step 1: Write the failing tests for the pure decisions**

`src/lib/schedule/__tests__/roster-entry.test.ts`:

```ts
import { describe, expect, test } from "vitest";

import { planRosterAdd, planRosterRemove } from "../roster-entry";
import type { SlotTrainee } from "@/types/schedule";

const NOAM = "33333333-3333-4333-8333-333333333333";
const OMER = "44444444-4444-4444-8444-444444444444";

function entry(overrides: Partial<SlotTrainee> = {}): SlotTrainee {
  return {
    id: "entry-1",
    slot_id: "slot-1",
    trainee_id: NOAM,
    trainee_name: "נועם",
    order_index: 0,
    source: "staff",
    booked_at: null,
    cancelled_at: null,
    late_cancel: false,
    reminded_at: null,
    ...overrides,
  };
}

describe("planRosterAdd", () => {
  test("inserts a new linked trainee after the highest order_index", () => {
    const roster = [entry({ id: "a", order_index: 0 }), entry({ id: "b", trainee_id: null, trainee_name: "אורח", order_index: 4 })];
    expect(planRosterAdd(roster, { traineeId: OMER, name: "עומר" }, null)).toEqual({
      kind: "insert",
      orderIndex: 5,
      overCapacity: false,
    });
  });

  test("inserts at 0 into an empty roster", () => {
    expect(planRosterAdd([], { traineeId: OMER, name: "עומר" }, 8)).toEqual({
      kind: "insert",
      orderIndex: 0,
      overCapacity: false,
    });
  });

  test("rejects a linked trainee already active on the slot", () => {
    expect(planRosterAdd([entry()], { traineeId: NOAM, name: "נועם" }, null)).toEqual({
      kind: "reject",
      error: "המתאמן כבר רשום לסלוט",
    });
  });

  test("reinstates a cancelled row instead of inserting a duplicate", () => {
    const roster = [entry({ id: "cancelled", cancelled_at: "2026-09-15T10:00:00Z", late_cancel: true })];
    expect(planRosterAdd(roster, { traineeId: NOAM, name: "נועם" }, null)).toEqual({
      kind: "reinstate",
      rowId: "cancelled",
      overCapacity: false,
    });
  });

  test("rejects a free-text name already active on the slot", () => {
    const roster = [entry({ trainee_id: null, trainee_name: "אורח" })];
    expect(planRosterAdd(roster, { traineeId: null, name: "אורח" }, null)).toEqual({
      kind: "reject",
      error: "השם כבר ברשימה",
    });
  });

  test("flags over capacity but still allows staff to add", () => {
    const roster = [entry({ id: "a" }), entry({ id: "b", trainee_id: OMER, order_index: 1 })];
    expect(planRosterAdd(roster, { traineeId: null, name: "אורח" }, 2)).toEqual({
      kind: "insert",
      orderIndex: 2,
      overCapacity: true,
    });
  });

  test("cancelled rows do not count toward capacity", () => {
    const roster = [entry({ id: "a", cancelled_at: "2026-09-15T10:00:00Z" })];
    const plan = planRosterAdd(roster, { traineeId: OMER, name: "עומר" }, 1);
    expect(plan).toEqual({ kind: "insert", orderIndex: 1, overCapacity: false });
  });
});

describe("planRosterRemove", () => {
  test("allows removing an active entry", () => {
    expect(planRosterRemove(entry())).toBeNull();
  });

  test("refuses a cancelled entry so usage history stays", () => {
    expect(planRosterRemove(entry({ cancelled_at: "2026-09-15T10:00:00Z", late_cancel: true }))).toBe(
      "ביטול שכבר נרשם נשמר בהיסטוריה ואינו ניתן להסרה",
    );
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run test:run -- src/lib/schedule/__tests__/roster-entry.test.ts`
Expected: FAIL, cannot resolve `../roster-entry`.

- [ ] **Step 3: Implement `src/lib/schedule/roster-entry.ts`**

```ts
import type { SlotTrainee } from "@/types/schedule";

/**
 * What adding one name to a slot's roster should do.
 *
 * Staff may over-fill a slot (ADR-0007); the flag only drives a warning. A
 * trainee who cancelled keeps their row, and the unique (slot, trainee) index
 * would refuse a second one, so re-adding them reinstates that row.
 */
export type RosterAddPlan =
  | { kind: "reject"; error: string }
  | { kind: "insert"; orderIndex: number; overCapacity: boolean }
  | { kind: "reinstate"; rowId: string; overCapacity: boolean };

export function planRosterAdd(
  roster: SlotTrainee[],
  entry: { traineeId: string | null; name: string },
  maxTrainees: number | null,
): RosterAddPlan {
  const active = roster.filter((row) => row.cancelled_at === null);
  const overCapacity = maxTrainees !== null && active.length + 1 > maxTrainees;

  if (entry.traineeId !== null) {
    const existing = roster.find((row) => row.trainee_id === entry.traineeId);
    if (existing && existing.cancelled_at === null) {
      return { kind: "reject", error: "המתאמן כבר רשום לסלוט" };
    }
    if (existing) return { kind: "reinstate", rowId: existing.id, overCapacity };
  } else if (active.some((row) => row.trainee_name === entry.name)) {
    return { kind: "reject", error: "השם כבר ברשימה" };
  }

  const orderIndex = roster.reduce((next, row) => Math.max(next, row.order_index + 1), 0);
  return { kind: "insert", orderIndex, overCapacity };
}

/** A cancellation is usage history (a late cancel counts as a used session), so staff cannot erase it. */
export function planRosterRemove(row: SlotTrainee): string | null {
  if (row.cancelled_at !== null) return "ביטול שכבר נרשם נשמר בהיסטוריה ואינו ניתן להסרה";
  return null;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npm run test:run -- src/lib/schedule/__tests__/roster-entry.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Write failing schema tests**

Append to `src/lib/validations/__tests__/schedule.test.ts` and add `rosterAddSchema, rosterRemoveSchema` to its import from `@/lib/validations/schedule`:

```ts
describe("rosterAddSchema", () => {
  const SLOT = "44444444-4444-4444-8444-444444444444";

  test("accepts a linked trainee", () => {
    const result = rosterAddSchema.safeParse({ slotId: SLOT, traineeId: TRAINEE, name: " נועם " });
    expect(result.success && result.data).toEqual({ slotId: SLOT, traineeId: TRAINEE, name: "נועם" });
  });

  test("accepts free text with no trainee id", () => {
    const result = rosterAddSchema.safeParse({ slotId: SLOT, name: "אורח" });
    expect(result.success && result.data.traineeId).toBeNull();
  });

  test("rejects a bad slot id and an empty name", () => {
    expect(rosterAddSchema.safeParse({ slotId: "x", name: "אורח" }).success).toBe(false);
    expect(rosterAddSchema.safeParse({ slotId: SLOT, name: "  " }).success).toBe(false);
  });
});

describe("rosterRemoveSchema", () => {
  test("requires a UUID", () => {
    expect(rosterRemoveSchema.safeParse({ rosterEntryId: TRAINEE }).success).toBe(true);
    expect(rosterRemoveSchema.safeParse({ rosterEntryId: "1" }).success).toBe(false);
  });
});
```

Run: `npm run test:run -- src/lib/validations/__tests__/schedule.test.ts`
Expected: FAIL, `rosterAddSchema` is not exported.

- [ ] **Step 6: Add the schemas**

In `src/lib/validations/schedule.ts`, after `slotIdSchema`:

```ts
/** One name added to an existing slot from the calendar's roster sheet. */
export const rosterAddSchema = rosterEntrySchema.extend({ slotId: uuidSchema });

export const rosterRemoveSchema = z.object({ rosterEntryId: uuidSchema });
```

And next to the other exported types:

```ts
export type RosterAddInput = z.input<typeof rosterAddSchema>;
export type RosterRemoveInput = z.input<typeof rosterRemoveSchema>;
```

Run: `npm run test:run -- src/lib/validations/__tests__/schedule.test.ts`
Expected: PASS.

- [ ] **Step 7: Move `verifyRosterTrainees` out of the "use server" file**

Create `src/lib/actions/shared/verify-roster-trainees.ts`. Cut the whole `verifyRosterTrainees` function and its doc comment from `src/lib/actions/daily-schedule-mutate.ts` (currently around lines 69-127) and paste it here, exported, with this header:

```ts
import { listProfileIdsInBranches } from "@/features/branches/lib/memberships";
import { createAdminClient } from "@/lib/supabase/admin";

/*
 * Not a "use server" module on purpose: exported from one, this helper would
 * become a callable server action that skips verifyAdminOrTrainer. Callers
 * are server actions that already verified the caller.
 */

// ...the moved doc comment...
export async function verifyRosterTrainees(
  trainees: { traineeId: string | null; name: string }[],
  branchId: string,
): Promise<{ error: string | null }> {
  // ...moved body, unchanged...
}
```

In `daily-schedule-mutate.ts` add `import { verifyRosterTrainees } from "@/lib/actions/shared/verify-roster-trainees";` and delete the now-unused `listProfileIdsInBranches` import if nothing else in the file uses it (check with `grep -n listProfileIdsInBranches src/lib/actions/daily-schedule-mutate.ts`). Keep the `createAdminClient` import only if `resolveTrainerName` still uses it (it does).

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 8: Create `src/lib/actions/daily-schedule-roster.ts`**

```ts
"use server";

import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { assertBranchWritable } from "@/lib/actions/shared/assert-branch";
import { revalidateScheduleSurfaces } from "@/lib/actions/shared/revalidate-schedule";
import { verifyRosterTrainees } from "@/lib/actions/shared/verify-roster-trainees";
import { planRosterAdd, planRosterRemove } from "@/lib/schedule/roster-entry";
import { typedFrom } from "@/lib/supabase/helpers";
import { createClient } from "@/lib/supabase/server";
import {
  rosterAddSchema,
  rosterRemoveSchema,
  type RosterAddInput,
  type RosterRemoveInput,
} from "@/lib/validations/schedule";
import { SLOT_SELECT_WITH_TRAINEES, type ScheduleSlot, type SlotTrainee } from "@/types/schedule";

/**
 * Roster edits one entry at a time.
 *
 * The slot form saves a whole roster through replace_slot_roster, which
 * deletes anyone missing from the list it was handed. A trainee who booked
 * while a staff member had that form open would be deleted by the save. These
 * actions touch only the row they name, so the calendar cannot lose a booking.
 *
 * Writes go through the server client: the staff-write RLS policy on
 * daily_schedule_slot_trainees applies, and .select() after each write turns
 * a silent RLS rejection (zero rows, no error) into a reported failure.
 */

type AddResult = { success: true; data: { overCapacity: boolean } } | { error: string };
type RemoveResult = { success: true } | { error: string };

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/** Postgres unique_violation: a concurrent add of the same trainee won the race. */
const UNIQUE_VIOLATION = "23505";

async function loadWritableSlot(
  supabase: ServerClient,
  slotId: string,
): Promise<{ slot: ScheduleSlot; branchId: string } | { error: string }> {
  const { data, error } = (await typedFrom(supabase, "daily_schedule_slots")
    .select(SLOT_SELECT_WITH_TRAINEES)
    .eq("id", slotId)
    .maybeSingle()) as { data: ScheduleSlot | null; error: { message: string } | null };

  if (error) {
    console.error("Load slot for roster error:", error);
    return { error: "שגיאה בטעינת הסלוט" };
  }
  if (!data) return { error: "הסלוט לא נמצא" };
  // Every slot written since branches shipped carries one; a legacy row
  // without it cannot be scope-checked, so it is not edited from here.
  if (!data.branch_id) return { error: "הסלוט אינו משויך לסניף" };

  const branchCheck = await assertBranchWritable(data.branch_id);
  if (branchCheck.error) return { error: branchCheck.error };

  return { slot: data, branchId: data.branch_id };
}

export async function addSlotTraineeAction(input: RosterAddInput): Promise<AddResult> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  const validated = rosterAddSchema.safeParse(input);
  if (!validated.success) {
    return { error: validated.error.issues[0]?.message ?? "אימות נתונים נכשל" };
  }
  const { slotId, traineeId, name } = validated.data;

  const supabase = await createClient();
  const loaded = await loadWritableSlot(supabase, slotId);
  if ("error" in loaded) return { error: loaded.error };

  const rosterCheck = await verifyRosterTrainees([{ traineeId, name }], loaded.branchId);
  if (rosterCheck.error) return { error: rosterCheck.error };

  const plan = planRosterAdd(loaded.slot.trainees, { traineeId, name }, loaded.slot.max_trainees);
  if (plan.kind === "reject") return { error: plan.error };

  const table = typedFrom(supabase, "daily_schedule_slot_trainees");
  const { data: written, error } =
    plan.kind === "reinstate"
      ? await table
          .update({ cancelled_at: null, late_cancel: false, source: "staff", trainee_name: name })
          .eq("id", plan.rowId)
          .select("id")
      : await table
          .insert({
            slot_id: slotId,
            trainee_id: traineeId,
            trainee_name: name,
            order_index: plan.orderIndex,
            source: "staff",
          })
          .select("id");

  if (error?.code === UNIQUE_VIOLATION) return { error: "המתאמן כבר רשום לסלוט" };
  if (error) {
    console.error("Add slot trainee error:", error);
    return { error: "שגיאה בהוספת המתאמן" };
  }
  if ((written?.length ?? 0) === 0) return { error: "אין הרשאה לעדכן את הסלוט" };

  revalidateScheduleSurfaces();
  return { success: true, data: { overCapacity: plan.overCapacity } };
}

export async function removeSlotTraineeAction(input: RosterRemoveInput): Promise<RemoveResult> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  const validated = rosterRemoveSchema.safeParse(input);
  if (!validated.success) return { error: "מזהה רישום לא תקין" };
  const { rosterEntryId } = validated.data;

  const supabase = await createClient();
  const { data: row, error: rowError } = (await typedFrom(supabase, "daily_schedule_slot_trainees")
    .select("id, slot_id, trainee_id, trainee_name, order_index, source, booked_at, cancelled_at, late_cancel, reminded_at")
    .eq("id", rosterEntryId)
    .maybeSingle()) as { data: SlotTrainee | null; error: { message: string } | null };

  if (rowError) {
    console.error("Load roster entry error:", rowError);
    return { error: "שגיאה בטעינת הרישום" };
  }
  if (!row) return { error: "הרישום לא נמצא" };

  const refusal = planRosterRemove(row);
  if (refusal) return { error: refusal };

  const loaded = await loadWritableSlot(supabase, row.slot_id);
  if ("error" in loaded) return { error: loaded.error };

  const { data: deleted, error } = await typedFrom(supabase, "daily_schedule_slot_trainees")
    .delete()
    .eq("id", rosterEntryId)
    .select("id");

  if (error) {
    console.error("Remove slot trainee error:", error);
    return { error: "שגיאה בהסרת המתאמן" };
  }
  if ((deleted?.length ?? 0) === 0) return { error: "הרישום לא נמצא" };

  revalidateScheduleSurfaces();
  return { success: true };
}
```

- [ ] **Step 9: Export from the barrel**

In `src/lib/actions/daily-schedule.ts` append:

```ts
export { addSlotTraineeAction, removeSlotTraineeAction } from "./daily-schedule-roster";
```

- [ ] **Step 10: Verify**

Run: `npx tsc --noEmit && npm run test:run -- src/lib/schedule src/lib/validations/__tests__/schedule.test.ts`
Expected: no type errors; all tests PASS.

- [ ] **Step 11: Commit**

```bash
git add src/lib/schedule/roster-entry.ts src/lib/schedule/__tests__/roster-entry.test.ts src/lib/validations/schedule.ts src/lib/validations/__tests__/schedule.test.ts src/lib/actions/shared/verify-roster-trainees.ts src/lib/actions/daily-schedule-mutate.ts src/lib/actions/daily-schedule-roster.ts src/lib/actions/daily-schedule.ts
git commit -m "feat(schedule): add and remove one roster entry without replacing the roster

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 4: Slot update leaves the roster alone when none is sent

**Files:**
- Modify: `src/lib/validations/schedule.ts` (`slotUpdateSchema`, `slotUpdateSchemaWithRosterRule`)
- Modify: `src/lib/actions/daily-schedule-mutate.ts` (`updateSlotAction`)
- Test: `src/lib/validations/__tests__/schedule.test.ts`

**Interfaces:**
- Produces: `SlotUpdateInput` where `trainees` is optional. `updateSlotAction` without `trainees` updates slot details only.

- [ ] **Step 1: Write the failing test**

Append to `src/lib/validations/__tests__/schedule.test.ts` and add `slotUpdateSchemaWithRosterRule` to the import:

```ts
describe("slotUpdateSchemaWithRosterRule", () => {
  const SLOT = "44444444-4444-4444-8444-444444444444";

  test("accepts an update with no trainees field and no seats", () => {
    const { trainees: _omit, ...details } = validSlot();
    const result = slotUpdateSchemaWithRosterRule.safeParse({ ...details, slotId: SLOT });
    expect(result.success).toBe(true);
    expect(result.success && result.data.trainees).toBeUndefined();
  });

  test("still rejects an explicitly empty roster on a staff-only slot", () => {
    const result = slotUpdateSchemaWithRosterRule.safeParse({ ...validSlot({ trainees: [] }), slotId: SLOT });
    expect(result.success).toBe(false);
  });

  test("still rejects duplicate linked trainees when a roster is sent", () => {
    const result = slotUpdateSchemaWithRosterRule.safeParse({
      ...validSlot({
        trainees: [
          { traineeId: TRAINEE, name: "א" },
          { traineeId: TRAINEE, name: "ב" },
        ],
      }),
      slotId: SLOT,
    });
    expect(result.success).toBe(false);
  });
});
```

If ESLint flags `_omit` as unused, destructure with `const details = { ...validSlot() }; delete` is NOT allowed (mutation); instead build `details` with `Object.fromEntries(Object.entries(validSlot()).filter(([key]) => key !== "trainees"))`.

Run: `npm run test:run -- src/lib/validations/__tests__/schedule.test.ts`
Expected: FAIL on the first test (trainees is required).

- [ ] **Step 2: Make the roster optional on update**

Replace `slotUpdateSchema` and `slotUpdateSchemaWithRosterRule` in `src/lib/validations/schedule.ts`:

```ts
export const slotUpdateSchema = slotSchema.extend({
  slotId: uuidSchema,
  /**
   * Absent means "leave the roster as it is". The calendar edits rosters one
   * entry at a time, and resending a stale list would delete bookings made
   * while the form was open.
   */
  trainees: slotSchema.shape.trainees.optional(),
});
```

```ts
export const slotUpdateSchemaWithRosterRule = slotUpdateSchema.refine(
  (v) => v.trainees === undefined || v.trainees.length > 0 || v.maxTrainees !== null,
  { message: "יש להוסיף לפחות מתאמן אחד", path: ["trainees"] },
);
```

Run: `npm run test:run -- src/lib/validations/__tests__/schedule.test.ts`
Expected: PASS.

- [ ] **Step 3: Skip roster work in `updateSlotAction` when absent**

In `src/lib/actions/daily-schedule-mutate.ts` inside `updateSlotAction`, replace

```ts
  const rosterCheck = await verifyRosterTrainees(trainees, branchId);
  if (rosterCheck.error) return { error: rosterCheck.error };
```

with

```ts
  if (trainees !== undefined) {
    const rosterCheck = await verifyRosterTrainees(trainees, branchId);
    if (rosterCheck.error) return { error: rosterCheck.error };
  }
```

and replace

```ts
  const { error: rosterError } = await replaceRoster(supabase, slotId, trainees);
  if (rosterError) return { error: rosterError };
```

with

```ts
  if (trainees !== undefined) {
    const { error: rosterError } = await replaceRoster(supabase, slotId, trainees);
    if (rosterError) return { error: rosterError };
  }
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm run test:run -- src/lib/validations/__tests__/schedule.test.ts`
Expected: no type errors, PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/validations/schedule.ts src/lib/validations/__tests__/schedule.test.ts src/lib/actions/daily-schedule-mutate.ts
git commit -m "fix(schedule): updating a slot without a roster leaves bookings untouched

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 5: Extract TraineeSearch; slot form edits details only

**Files:**
- Create: `src/components/admin/schedule/TraineeSearch.tsx`
- Modify: `src/components/admin/schedule/SlotFormDialog.tsx`

**Interfaces:**
- Consumes: `TrainerOption` from `@/lib/actions/admin-trainers-list`.
- Produces: `TraineeSearch` with props `{ idPrefix: string; options: TrainerOption[]; excludeIds: ReadonlySet<string>; onPickLinked: (trainee: TrainerOption) => void; onPickFreeText: (name: string) => void; disabled?: boolean }`. The input id is `${idPrefix}-search`.

- [ ] **Step 1: Create `TraineeSearch.tsx`**

Move the search state, suggestion memo, keyboard handling, input, free-text button and listbox out of `SlotFormDialog.tsx` (currently lines ~146-164 and ~358-436) into:

```tsx
"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TrainerOption } from "@/lib/actions/admin-trainers-list";
import { cn } from "@/lib/utils";

const MAX_SUGGESTIONS = 6;

interface TraineeSearchProps {
  /** Prefix for element ids; the input is `${idPrefix}-search` for a Label. */
  idPrefix: string;
  options: TrainerOption[];
  /** Linked trainees already on the roster, never suggested again. */
  excludeIds: ReadonlySet<string>;
  onPickLinked: (trainee: TrainerOption) => void;
  /** A typed name with no account. The parent decides whether it is a duplicate. */
  onPickFreeText: (name: string) => void;
  disabled?: boolean;
}

/**
 * Trainee combobox with a free-text fallback, shared by the slot form and the
 * calendar's roster sheet. Eden's lists include kids not yet in the system, so
 * a name that matches no account is still a valid entry.
 */
export function TraineeSearch({
  idPrefix,
  options,
  excludeIds,
  onPickLinked,
  onPickFreeText,
  disabled = false,
}: TraineeSearchProps) {
  const [search, setSearch] = useState("");
  // Keyboard highlight over the suggestion list; -1 = nothing highlighted.
  const [highlighted, setHighlighted] = useState(-1);
  const listboxId = `${idPrefix}-suggestions`;

  const suggestions = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return [];
    return options
      .filter((t) => !excludeIds.has(t.id) && (t.full_name ?? "").toLowerCase().includes(term))
      .slice(0, MAX_SUGGESTIONS);
  }, [search, options, excludeIds]);

  const reset = () => {
    setSearch("");
    setHighlighted(-1);
  };

  const pickLinked = (trainee: TrainerOption) => {
    onPickLinked(trainee);
    reset();
  };

  const pickFreeText = () => {
    const name = search.trim();
    if (!name) return;
    onPickFreeText(name);
    reset();
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          id={`${idPrefix}-search`}
          value={search}
          disabled={disabled}
          placeholder="חיפוש מתאמן או שם חופשי..."
          role="combobox"
          aria-expanded={suggestions.length > 0}
          aria-controls={suggestions.length > 0 ? listboxId : undefined}
          aria-activedescendant={
            highlighted >= 0 && suggestions[highlighted]
              ? `${idPrefix}-option-${suggestions[highlighted].id}`
              : undefined
          }
          onChange={(event) => {
            setSearch(event.target.value);
            setHighlighted(-1);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setHighlighted((h) => Math.min(h + 1, suggestions.length - 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setHighlighted((h) => Math.max(h - 1, -1));
            } else if (event.key === "Enter") {
              event.preventDefault();
              // A highlighted suggestion wins; otherwise a single match is
              // unambiguous; otherwise the text is a free-text name.
              if (highlighted >= 0 && suggestions[highlighted]) {
                pickLinked(suggestions[highlighted]);
              } else if (suggestions.length === 1) {
                pickLinked(suggestions[0]);
              } else {
                pickFreeText();
              }
            }
          }}
        />
        <Button
          type="button"
          variant="outline"
          onClick={pickFreeText}
          disabled={disabled || !search.trim()}
          aria-label="הוספת שם חופשי"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {suggestions.length > 0 && (
        <div id={listboxId} role="listbox" aria-label="הצעות מתאמנים" className="rounded-md border">
          {suggestions.map((trainee, index) => (
            <button
              key={trainee.id}
              id={`${idPrefix}-option-${trainee.id}`}
              role="option"
              aria-selected={index === highlighted}
              type="button"
              onClick={() => pickLinked(trainee)}
              onMouseEnter={() => setHighlighted(index)}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-start text-sm",
                index === highlighted ? "bg-muted" : "hover:bg-muted",
              )}
            >
              <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-forest/10 text-[11px] font-bold text-forest">
                {(trainee.full_name ?? "?").slice(0, 1)}
              </span>
              {trainee.full_name ?? "ללא שם"}
            </button>
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        שם שלא נמצא במערכת נוסף כטקסט חופשי (מסומן במסגרת).
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Rewire `SlotFormDialog.tsx`**

1. Delete the `search`/`highlighted` state, the `suggestions` memo, and the old `addLinked`/`addFreeText` bodies; delete now-unused imports (`useMemo` stays if `suggestedTrainers` uses it; `Input` stays for focus/location; remove `Plus` only if unused; `cn` stays if used elsewhere). Let `npx tsc --noEmit` and `npm run lint` tell you.
2. Roster state starts empty (it is only used when creating):

```tsx
  // Only a new slot takes names here. An existing slot's roster is edited one
  // entry at a time in the calendar, so this form cannot overwrite bookings.
  const [roster, setRoster] = useState<RosterEntry[]>([]);
  const isEdit = slot !== null;
  const activeCount = slot ? slot.trainees.filter((t) => t.cancelled_at === null).length : roster.length;

  const rosterIds = useMemo(
    () => new Set(roster.flatMap((entry) => (entry.traineeId ? [entry.traineeId] : []))),
    [roster],
  );

  const addLinked = (trainee: TrainerOption) => {
    setRoster((prev) => [...prev, { traineeId: trainee.id, name: trainee.full_name ?? "ללא שם" }]);
  };

  const addFreeText = (name: string) => {
    if (roster.some((entry) => entry.name === name)) {
      toast.error("השם כבר ברשימה");
      return;
    }
    setRoster((prev) => [...prev, { traineeId: null, name }]);
  };
```

3. Replace the body of `handleSubmit` from the empty-roster check through the action call:

```tsx
    // A bookable slot may be saved empty; it fills itself.
    if (!isEdit && roster.length === 0 && maxTrainees === "") {
      toast.error("יש להוסיף לפחות מתאמן אחד");
      return;
    }

    setLoading(true);
    try {
      const details = {
        branchId,
        scheduleDate: slot?.schedule_date ?? date,
        startTime,
        trainerId,
        focus,
        location,
        maxTrainees: maxTrainees === "" ? null : Number(maxTrainees),
      };

      const result = slot
        ? await updateSlotAction({ ...details, slotId: slot.id })
        : await createSlotAction({
            ...details,
            trainees: roster.map((entry) => ({
              traineeId: entry.traineeId ?? undefined,
              name: entry.name,
            })),
          });
```

(the rest of `handleSubmit` stays).

4. `DialogDescription` text:

```tsx
          <DialogDescription>
            {isEdit
              ? "שעה, מאמן, פוקוס ומיקום. את המתאמנים מוסיפים ומסירים ברשימת הסלוט ביומן."
              : "שעה, מאמן, מתאמנים ופוקוס: קבוצה אחת ביומן."}
          </DialogDescription>
```

5. Wrap the roster block (the `<div className="space-y-2">` with `Label htmlFor="slot-roster-search"`) in `{!isEdit && (...)}`, keep the badges list with remove buttons, and replace its input, button, listbox and help text with:

```tsx
              <TraineeSearch
                idPrefix="slot-roster"
                options={trainees}
                excludeIds={rosterIds}
                onPickLinked={addLinked}
                onPickFreeText={addFreeText}
              />
```

Add `import { TraineeSearch } from "./TraineeSearch";`.

6. In the seats block replace `roster.length` with `activeCount` in both the condition and the message.

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors in the two files. `wc -l src/components/admin/schedule/SlotFormDialog.tsx` should be below 510.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/schedule/TraineeSearch.tsx src/components/admin/schedule/SlotFormDialog.tsx
git commit -m "refactor(schedule): share trainee search; slot form edits details only

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 6: Roster sheet

**Files:**
- Create: `src/components/admin/calendar/RosterSheet.tsx`

**Interfaces:**
- Consumes: `addSlotTraineeAction`, `removeSlotTraineeAction`, `deleteSlotAction` from `@/lib/actions/daily-schedule`; `TraineeSearch` (Task 5); `PlanSheet` from `@/features/plans/components/staff/PlanSheet`; `HealthSheet` from `@/features/plans/components/HealthSheet`; `StaffPlanBadge` from `@/types/plans`; `trainerColor` from `@/lib/utils/trainer-color`.
- Produces: `RosterSheet` with props `{ slot: ScheduleSlot | null; onClose: () => void; trainees: TrainerOption[]; planBadges: Record<string, StaffPlanBadge>; isAdmin: boolean; onEditDetails: (slot: ScheduleSlot) => void }`. Open when `slot !== null`. The parent passes the slot looked up from fresh props, so `router.refresh()` updates the open sheet.

- [ ] **Step 1: Create the component**

```tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, HeartPulse, Loader2, MapPin, Pencil, Trash2, Users, X } from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { SheetDialogContent } from "@/components/ui/sheet-dialog";
import { TraineeSearch } from "@/components/admin/schedule/TraineeSearch";
import { HealthSheet } from "@/features/plans/components/HealthSheet";
import { PlanSheet } from "@/features/plans/components/staff/PlanSheet";
import type { TrainerOption } from "@/lib/actions/admin-trainers-list";
import {
  addSlotTraineeAction,
  deleteSlotAction,
  removeSlotTraineeAction,
} from "@/lib/actions/daily-schedule";
import { cn } from "@/lib/utils";
import { trainerColor } from "@/lib/utils/trainer-color";
import type { StaffPlanBadge } from "@/types/plans";
import type { ScheduleSlot, SlotTrainee } from "@/types/schedule";

/** Only the states that need a trainer's attention get a chip. */
const PLAN_CHIP: Partial<Record<StaffPlanBadge["status"], { label: string; className: string }>> = {
  expired: { label: "פג", className: "bg-destructive text-white" },
  ending_soon: { label: "מסתיים", className: "bg-amber-500 text-black" },
};

interface RosterSheetProps {
  /** The slot on screen, looked up from fresh page data; null closes the sheet. */
  slot: ScheduleSlot | null;
  onClose: () => void;
  trainees: TrainerOption[];
  planBadges: Record<string, StaffPlanBadge>;
  /** Admins may edit plans from the plan sheet. */
  isAdmin: boolean;
  onEditDetails: (slot: ScheduleSlot) => void;
}

/**
 * Who is in one slot. The only place in the calendar that changes a roster,
 * and it never builds sessions: that is the בניית אימונים screen's job.
 */
export function RosterSheet({ slot, onClose, trainees, planBadges, isAdmin, onEditDetails }: RosterSheetProps) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [planFor, setPlanFor] = useState<{ id: string; name: string } | null>(null);
  const [healthFor, setHealthFor] = useState<{ id: string; name: string } | null>(null);

  const active = useMemo(() => slot?.trainees.filter((t) => t.cancelled_at === null) ?? [], [slot]);
  const lateCancels = slot?.trainees.filter((t) => t.cancelled_at !== null && t.late_cancel) ?? [];
  const activeIds = useMemo(
    () => new Set(active.flatMap((t) => (t.trainee_id ? [t.trainee_id] : []))),
    [active],
  );

  if (!slot) return null;

  const palette = trainerColor(slot.trainer_id);
  const time = slot.start_time.slice(0, 5);
  const overCapacity = slot.max_trainees !== null && active.length > slot.max_trainees;

  const add = async (entry: { traineeId: string | null; name: string }) => {
    setAdding(true);
    try {
      const result = await addSlotTraineeAction({ slotId: slot.id, ...entry });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      if (result.data.overCapacity) toast.warning("הסלוט מעבר לקיבולת");
      else toast.success(`${entry.name} נוסף לסלוט`);
      router.refresh();
    } catch {
      toast.error("שגיאה בהוספת המתאמן");
    } finally {
      setAdding(false);
    }
  };

  const remove = async (entry: SlotTrainee) => {
    setBusyId(entry.id);
    try {
      const result = await removeSlotTraineeAction({ rosterEntryId: entry.id });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(`${entry.trainee_name} הוסר מהסלוט`);
      router.refresh();
    } catch {
      toast.error("שגיאה בהסרת המתאמן");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const result = await deleteSlotAction(slot.id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success("הסלוט נמחק");
      setConfirmDelete(false);
      onClose();
      router.refresh();
    } catch {
      toast.error("שגיאה במחיקת הסלוט");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Dialog open onOpenChange={(open) => !open && onClose()}>
        <SheetDialogContent>
          <DialogHeader className={cn("px-4 pt-4 pb-3 text-start sm:px-6 sm:pt-6", palette.bg)}>
            <div className="flex items-start justify-between gap-2 pe-8">
              <div className="min-w-0">
                <DialogTitle className="flex flex-wrap items-center gap-2">
                  <span className="font-display tabular-nums">{time}</span>
                  <span className={cn("font-extrabold", palette.text)}>{slot.trainer_name ?? "ללא מאמן"}</span>
                </DialogTitle>
                <DialogDescription className="mt-1 flex flex-wrap items-center gap-2">
                  {slot.location_he && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {slot.location_he}
                    </span>
                  )}
                  <span className={cn("flex items-center gap-1 tabular-nums", overCapacity && "text-destructive")}>
                    <Users className="h-3 w-3" />
                    {slot.max_trainees === null ? active.length : `${active.length}/${slot.max_trainees}`}
                  </span>
                  {slot.focus_he && <span className="italic">{slot.focus_he}</span>}
                </DialogDescription>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button variant="ghost" size="icon" onClick={() => onEditDetails(slot)} aria-label="עריכת פרטי הסלוט">
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setConfirmDelete(true)} aria-label="מחיקת סלוט">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pt-3 pb-4 sm:px-6 sm:pb-6">
            {overCapacity && (
              <p className="text-xs text-destructive">
                מעבר לקיבולת ({active.length}/{slot.max_trainees}). הצוות רשאי, המתאמנים לא.
              </p>
            )}

            {active.length === 0 ? (
              <p className="rounded-xl border border-dashed py-6 text-center text-sm text-muted-foreground">
                אין רשומים לסלוט הזה
              </p>
            ) : (
              <ul className="divide-y rounded-xl border">
                {active.map((entry) => {
                  const badge = entry.trainee_id ? planBadges[entry.trainee_id] : undefined;
                  const chip = badge?.endsOn ? PLAN_CHIP[badge.status] : undefined;
                  return (
                    <li key={entry.id} className="flex items-center gap-2 px-3 py-2">
                      <span className={cn("min-w-0 flex-1 truncate text-sm", !entry.trainee_id && "text-muted-foreground")}>
                        {entry.trainee_name}
                        {!entry.trainee_id && <span className="ms-1 text-[11px]">(ללא חשבון)</span>}
                      </span>
                      {entry.source === "self" && (
                        <CalendarCheck className="h-4 w-4 shrink-0 text-forest" aria-label="נרשם בעצמו" />
                      )}
                      {chip && entry.trainee_id && (
                        <button
                          type="button"
                          onClick={() => setPlanFor({ id: entry.trainee_id!, name: entry.trainee_name })}
                          className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-bold", chip.className)}
                          title={badge?.sessionsLeft != null ? `${badge.sessionsLeft} אימונים נותרו` : undefined}
                          aria-label={`המסלול של ${entry.trainee_name}: ${chip.label}`}
                        >
                          {chip.label}
                        </button>
                      )}
                      {badge?.hasMedicalNotes && entry.trainee_id && (
                        <button
                          type="button"
                          onClick={() => setHealthFor({ id: entry.trainee_id!, name: entry.trainee_name })}
                          className="rounded-full p-0.5 text-amber-600 hover:bg-amber-100"
                          aria-label={`מידע רפואי של ${entry.trainee_name}`}
                        >
                          <HeartPulse className="h-4 w-4" />
                        </button>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        disabled={busyId !== null}
                        onClick={() => remove(entry)}
                        aria-label={`הסרת ${entry.trainee_name} מהסלוט`}
                      >
                        {busyId === entry.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
                      </Button>
                    </li>
                  );
                })}
              </ul>
            )}

            {lateCancels.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs text-muted-foreground">ביטולים מאוחרים (נחשבים כאימון שנוצל)</p>
                <div className="flex flex-wrap gap-1.5">
                  {lateCancels.map((entry) => (
                    <span key={entry.id} className="rounded-full border border-dashed px-2 py-0.5 text-xs text-muted-foreground line-through">
                      {entry.trainee_name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="roster-add-search">הוספת מתאמן</Label>
              <TraineeSearch
                idPrefix="roster-add"
                options={trainees}
                excludeIds={activeIds}
                disabled={adding}
                onPickLinked={(trainee) => add({ traineeId: trainee.id, name: trainee.full_name ?? "ללא שם" })}
                onPickFreeText={(name) => add({ traineeId: null, name })}
              />
            </div>
          </div>
        </SheetDialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת סלוט</AlertDialogTitle>
            <AlertDialogDescription>
              הסלוט של {slot.trainer_name ?? "ללא מאמן"} ב-{time} יימחק לצמיתות, כולל רשימת המתאמנים.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                handleDelete();
              }}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "מוחק..." : "מחיקה"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {planFor && (
        <PlanSheet
          traineeId={planFor.id}
          traineeName={planFor.name}
          isAdmin={isAdmin}
          open
          onOpenChange={(open) => !open && setPlanFor(null)}
        />
      )}
      {healthFor && (
        <HealthSheet
          traineeId={healthFor.id}
          traineeName={healthFor.name}
          open
          onOpenChange={(open) => !open && setHealthFor(null)}
        />
      )}
    </>
  );
}
```

Hooks rule: all hooks are above the `if (!slot) return null;` early return. Keep it that way.

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors. If `StaffPlanBadge` field names differ (`endsOn`, `sessionsLeft`, `hasMedicalNotes`, `status`), read `src/types/plans.ts` and match them; they are copied from the current `SlotCard.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/calendar/RosterSheet.tsx
git commit -m "feat(schedule): roster sheet adds and removes trainees one at a time

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 7: Booking calendar page

**Files:**
- Modify: `src/components/admin/schedule/week/WeekSlotCard.tsx`
- Modify: `src/components/admin/schedule/week/WeekDayColumn.tsx`
- Create: `src/components/admin/calendar/DateStrip.tsx`
- Create: `src/components/admin/calendar/CalendarDayList.tsx`
- Create: `src/components/admin/calendar/CalendarView.tsx`
- Create: `src/app/admin/calendar/page.tsx`
- Create: `src/app/admin/calendar/loading.tsx`
- Delete: `src/components/admin/schedule/week/DatedWeekView.tsx`
- Modify: `src/components/admin/schedule/week/WeeklySchedulePageClient.tsx`, `src/app/admin/weekly-schedule/page.tsx`

**Interfaces:**
- Consumes: `resolveCalendarDate`, `visibleDays`, `findDay` (Task 2); `RosterSheet` (Task 6); `buildWeek`, `startOfWeek`, `weekRangeLabel`, `isBuildableDay`, `Week`, `WeekDay` from `@/lib/utils/schedule-week`; `getSlotsForWeekAction` from `@/lib/actions/daily-schedule`; `getWeeklyScheduleAction(fromDate, toDate, branchId)`, `getExceptionsInRangeAction(fromDate, toDate, branchId)` from `@/lib/actions/weekly-schedule`; `getSlotFormOptionsAction(branchId)` from `@/lib/actions/schedule-options`; `loadPlanStatusesForStaff(ids)`; existing buttons `CopyWhatsAppButton({ slots })`, `DuplicateDayButton({ targetDate, targetHasSlots })`, `BuildDayButton({ targetDate, targetHasSlots, bandCount, compact? })`, `BuildWeekButton({ weekStart, buildableCount, slotCount })`, `OnDutyStrip({ onDuty })`, `SlotFormDialog`, `ExceptionFormDialog({ open, onOpenChange, trainers, defaultDate, canEdit })`.
- Produces: route `/admin/calendar?date=&branch=`.

- [ ] **Step 1: `WeekSlotCard.tsx` reads as a calendar card**

Change the prop `onEdit` to `onOpen` (and its `aria-label` to `` `רשימת המתאמנים של ${slot.trainer_name ?? "ללא מאמן"} בשעה ${slot.start_time.slice(0, 5)}` ``), update its doc comment to say tapping opens the roster sheet, and replace the final `<p>` with:

```tsx
      <p
        className={cn(
          "mt-1.5 flex items-center gap-1 text-[11px] tabular-nums",
          overCapacity ? "font-medium text-destructive" : "text-muted-foreground",
        )}
      >
        <Users className="h-3 w-3 shrink-0" />
        {rosterCount === 0 ? "אין רשומים" : seats ?? rosterLabel(rosterCount)}
      </p>
```

with, above the `return`:

```tsx
  const overCapacity = slot.max_trainees !== null && rosterCount > slot.max_trainees;
  const seats = slot.max_trainees === null ? null : `${rosterCount}/${slot.max_trainees} מקומות`;
```

(replacing the old `seats` line).

- [ ] **Step 2: `WeekDayColumn.tsx` header selects the day**

Replace props `onEditSlot` with `onOpenSlot: (slot: ScheduleSlot) => void`, and add `isSelected: boolean` and `onSelectDay: (day: WeekDay) => void`. Replace the `<h2>...</h2>` block with:

```tsx
      <h2>
        <button
          type="button"
          onClick={() => onSelectDay(day)}
          aria-pressed={isSelected}
          className={cn(
            "flex w-full items-center justify-between gap-1 rounded-lg px-2 py-1.5 font-display text-sm transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/40",
            day.isToday ? "bg-forest text-cream" : "bg-muted text-forest hover:bg-muted/70",
            isSelected && !day.isToday && "ring-2 ring-forest/50",
            day.isPast && !day.isToday && "opacity-70",
          )}
        >
          <span className="truncate">
            {WEEKDAY_LABELS[day.weekday]}{" "}
            <span className="tabular-nums opacity-80">{shortDate(day.date)}</span>
          </span>
        </button>
      </h2>
```

Change `onEdit={() => onEditSlot(day, slot)}` to `onOpen={() => onOpenSlot(slot)}`. Remove the `Link` and `ExternalLink` imports.

- [ ] **Step 3: Create `DateStrip.tsx`**

```tsx
"use client";

import { cn } from "@/lib/utils";
import { shortDate } from "@/lib/utils/iso-date";
import type { WeekDay } from "@/lib/utils/schedule-week";
import { WEEKDAY_LABELS } from "@/types/weekly-schedule";

interface DateStripProps {
  days: WeekDay[];
  selectedDate: string;
  onSelect: (date: string) => void;
}

/** The phone's day picker, Arbox style: one row, today and the selection marked. */
export function DateStrip({ days, selectedDate, onSelect }: DateStripProps) {
  return (
    <div role="tablist" aria-label="ימי השבוע" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
      {days.map((day) => {
        const selected = day.date === selectedDate;
        return (
          <button
            key={day.date}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onSelect(day.date)}
            className={cn(
              "flex min-w-12 flex-1 flex-col items-center gap-0.5 rounded-xl border px-1.5 py-2 transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/40",
              selected ? "border-forest bg-forest text-cream" : "bg-background hover:bg-muted",
              !selected && day.isToday && "border-forest text-forest",
              !selected && day.isPast && "opacity-60",
            )}
          >
            <span className="text-[11px]">{WEEKDAY_LABELS[day.weekday]}</span>
            <span className="font-display text-sm tabular-nums">{shortDate(day.date)}</span>
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                day.slots.length > 0 ? (selected ? "bg-cream" : "bg-grass") : "bg-transparent",
              )}
              aria-hidden="true"
            />
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Create `CalendarDayList.tsx`**

```tsx
"use client";

import { useMemo } from "react";
import { CalendarDays, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { WeekSlotCard } from "@/components/admin/schedule/week/WeekSlotCard";
import type { WeekDay } from "@/lib/utils/schedule-week";
import type { ScheduleSlot } from "@/types/schedule";

interface CalendarDayListProps {
  /** Null for an empty Saturday. */
  day: WeekDay | null;
  onOpenSlot: (slot: ScheduleSlot) => void;
  onAddSlot: () => void;
}

/** One day's slots on the timeline rail, grouped by hour. */
export function CalendarDayList({ day, onOpenSlot, onAddSlot }: CalendarDayListProps) {
  const byTime = useMemo(() => {
    const groups = new Map<string, ScheduleSlot[]>();
    for (const slot of day?.slots ?? []) {
      const time = slot.start_time.slice(0, 5);
      groups.set(time, [...(groups.get(time) ?? []), slot]);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [day]);

  if (byTime.length === 0) {
    return (
      <Card className="border-2 border-dashed">
        <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
          <span className="rounded-full bg-muted p-3">
            <CalendarDays className="h-6 w-6 text-muted-foreground" />
          </span>
          <p className="text-muted-foreground">אין סלוטים ביום הזה</p>
          <Button onClick={onAddSlot}>
            <Plus className="h-4 w-4" />
            סלוט חדש
          </Button>
        </CardContent>
      </Card>
    );
  }

  const absentTrainerIds = new Set(day?.onDuty.absences.map((absence) => absence.trainerId) ?? []);

  return (
    <div className="ms-1.5 space-y-6 border-s-2 border-border ps-5">
      {byTime.map(([time, group]) => (
        <section key={time} className="relative space-y-2">
          <span
            className="absolute -start-[27px] top-2 h-3 w-3 rounded-full bg-grass ring-4 ring-background"
            aria-hidden="true"
          />
          <h3 className="font-display text-xl text-forest tabular-nums">{time}</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {group.map((slot) => (
              <WeekSlotCard
                key={slot.id}
                slot={slot}
                isTrainerAbsent={slot.trainer_id !== null && absentTrainerIds.has(slot.trainer_id)}
                onOpen={() => onOpenSlot(slot)}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
```

- [ ] **Step 5: Create `CalendarView.tsx`**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BuildDayButton } from "@/components/admin/schedule/BuildDayButton";
import { CopyWhatsAppButton } from "@/components/admin/schedule/CopyWhatsAppButton";
import { DuplicateDayButton } from "@/components/admin/schedule/DuplicateDayButton";
import { OnDutyStrip } from "@/components/admin/schedule/OnDutyStrip";
import { SlotFormDialog } from "@/components/admin/schedule/SlotFormDialog";
import { BuildWeekButton } from "@/components/admin/schedule/week/BuildWeekButton";
import { ExceptionFormDialog } from "@/components/admin/schedule/week/ExceptionFormDialog";
import { WeekDayColumn } from "@/components/admin/schedule/week/WeekDayColumn";
import { useCurrentBranch } from "@/features/branches/components/BranchContext";
import { BranchSwitcher } from "@/features/branches/components/BranchSwitcher";
import type { TrainerOption } from "@/lib/actions/admin-trainers-list";
import { findDay, visibleDays } from "@/lib/schedule/calendar";
import { hebrewWeekday } from "@/lib/utils/date";
import { addDays, shortDate } from "@/lib/utils/iso-date";
import { isBuildableDay, weekRangeLabel, type Week, type WeekDay } from "@/lib/utils/schedule-week";
import type { StaffPlanBadge } from "@/types/plans";
import type { ScheduleSlot } from "@/types/schedule";
import { CalendarDayList } from "./CalendarDayList";
import { DateStrip } from "./DateStrip";
import { RosterSheet } from "./RosterSheet";

interface CalendarViewProps {
  week: Week;
  weekStart: string;
  /** The day from ?date=, already resolved by the page. */
  date: string;
  today: string;
  isAdmin: boolean;
  trainers: TrainerOption[];
  trainees: TrainerOption[];
  planBadges: Record<string, StaffPlanBadge>;
  /** The week's slots could not be read; never render as an empty week. */
  slotsError: string | null;
  /** The standing template could not be read; staffing cannot be claimed. */
  templateFailed: boolean;
}

/** What the slot form was opened for. A date and its staffing are one fact. */
interface SlotFormContext {
  date: string;
  slot: ScheduleSlot | null;
  day: WeekDay | null;
}

/**
 * The booking calendar: who is in which slot. It never builds sessions.
 *
 * Phone and desktop layouts render in one tree and switch with CSS. A
 * useIsMobile branch would render one layout on the server and remount on
 * hydration, closing any dialog opened in between.
 */
export function CalendarView({
  week,
  weekStart,
  date,
  today,
  isAdmin,
  trainers,
  trainees,
  planBadges,
  slotsError,
  templateFailed,
}: CalendarViewProps) {
  const { branchId } = useCurrentBranch();

  // Selecting a day inside the loaded week is client state mirrored to the
  // URL; a new ?date= from the server (week arrows) resets it.
  const [selectedDate, setSelectedDate] = useState(date);
  const [propDate, setPropDate] = useState(date);
  if (propDate !== date) {
    setPropDate(date);
    setSelectedDate(date);
  }

  const [openSlotId, setOpenSlotId] = useState<string | null>(null);
  const [slotForm, setSlotForm] = useState<SlotFormContext | null>(null);
  const [slotFormOpen, setSlotFormOpen] = useState(false);
  const [exceptionDate, setExceptionDate] = useState<string | null>(null);
  const [exceptionOpen, setExceptionOpen] = useState(false);
  // Remount counter: both dialogs initialise every field at mount.
  const [formInstance, setFormInstance] = useState(0);

  const days = visibleDays(week);
  const selectedDay = findDay(week, selectedDate);
  const selectedSlots = selectedDay?.slots ?? [];
  // Looked up from fresh props so router.refresh() updates an open sheet, and
  // a deleted slot closes it.
  const openSlot = days.flatMap((d) => d.slots).find((s) => s.id === openSlotId) ?? null;

  const buildable = week.days.filter(isBuildableDay);
  const buildableSlotCount = buildable.reduce((total, d) => total + d.onDuty.bands.length, 0);

  const hrefFor = (target: string) => `/admin/calendar?date=${target}&branch=${branchId}`;

  const selectDay = (target: string) => {
    setSelectedDate(target);
    window.history.replaceState(null, "", hrefFor(target));
  };

  const openSlotForm = (context: SlotFormContext) => {
    setOpenSlotId(null);
    setSlotForm(context);
    setFormInstance((n) => n + 1);
    setSlotFormOpen(true);
  };

  const openException = (day: WeekDay) => {
    setExceptionDate(day.date);
    setFormInstance((n) => n + 1);
    setExceptionOpen(true);
  };

  const dayLabel = `${hebrewWeekday(selectedDate)} · ${shortDate(selectedDate)}`;
  const inLoadedWeek = (target: string) => target >= weekStart && target <= addDays(weekStart, 6);
  const dayArrow = (delta: number) => {
    const target = addDays(selectedDate, delta);
    return inLoadedWeek(target) ? { onClick: () => selectDay(target) } : { href: hrefFor(target) };
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {/* Phone: one day at a time. RTL: "previous" points right. */}
        <div className="flex items-center gap-2 md:hidden">
          <ArrowButton label="יום קודם" icon="prev" {...dayArrow(-1)} />
          <span className="flex items-center gap-2 px-1 font-display text-lg">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            {dayLabel}
          </span>
          <ArrowButton label="יום הבא" icon="next" {...dayArrow(1)} />
        </div>

        {/* Desktop: a week at a time. */}
        <div className="hidden items-center gap-2 md:flex">
          <ArrowButton label="שבוע קודם" icon="prev" href={hrefFor(addDays(weekStart, -7))} />
          <span className="flex items-center gap-2 px-1 font-display text-lg tabular-nums">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            {weekRangeLabel(weekStart)}
          </span>
          <ArrowButton label="שבוע הבא" icon="next" href={hrefFor(addDays(weekStart, 7))} />
        </div>

        {selectedDate !== today && (
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/admin/calendar?branch=${branchId}`}>היום</Link>
          </Button>
        )}
        <BranchSwitcher />
        <Button variant="ghost" size="icon" asChild aria-label="נוהל בטיחות וחירום">
          <Link href="/admin/safety">
            <ShieldAlert className="h-4 w-4 text-destructive" />
          </Link>
        </Button>
      </div>

      {!slotsError && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="hidden text-sm text-muted-foreground md:inline">{dayLabel}:</span>
          <Button
            onClick={() => openSlotForm({ date: selectedDate, slot: null, day: selectedDay })}
            className="order-first w-full sm:order-none sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            סלוט חדש
          </Button>
          <CopyWhatsAppButton slots={selectedSlots} />
          {isAdmin && <DuplicateDayButton targetDate={selectedDate} targetHasSlots={selectedSlots.length > 0} />}
          {isAdmin && !templateFailed && selectedDay && selectedDay.onDuty.bands.length > 0 && (
            <BuildDayButton
              targetDate={selectedDate}
              targetHasSlots={selectedSlots.length > 0}
              bandCount={selectedDay.onDuty.bands.length}
            />
          )}
          {isAdmin && !templateFailed && (
            <div className="hidden md:block">
              <BuildWeekButton weekStart={weekStart} buildableCount={buildable.length} slotCount={buildableSlotCount} />
            </div>
          )}
        </div>
      )}

      {selectedDay && !templateFailed && <OnDutyStrip onDuty={selectedDay.onDuty} />}

      {slotsError ? (
        <Card className="border-destructive">
          <CardContent className="py-12 text-center text-destructive">{slotsError}</CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-4 md:hidden">
            <DateStrip days={days} selectedDate={selectedDate} onSelect={selectDay} />
            <CalendarDayList
              day={selectedDay}
              onOpenSlot={(slot) => setOpenSlotId(slot.id)}
              onAddSlot={() => openSlotForm({ date: selectedDate, slot: null, day: selectedDay })}
            />
          </div>

          <div className="hidden space-y-3 md:block">
            <div className="grid grid-cols-3 gap-3 xl:grid-cols-6">
              {week.days.map((day) => (
                <WeekDayColumn
                  key={day.date}
                  day={day}
                  isAdmin={isAdmin}
                  templateFailed={templateFailed}
                  isSelected={day.date === selectedDate}
                  onSelectDay={(target) => selectDay(target.date)}
                  onAddSlot={(target) => openSlotForm({ date: target.date, slot: null, day: target })}
                  onOpenSlot={(slot) => setOpenSlotId(slot.id)}
                  onAddException={openException}
                />
              ))}
            </div>
            {week.saturday && (
              <div className="max-w-xs rounded-2xl border border-dashed p-3">
                <WeekDayColumn
                  day={week.saturday}
                  isAdmin={isAdmin}
                  templateFailed={templateFailed}
                  isSelected={week.saturday.date === selectedDate}
                  onSelectDay={(target) => selectDay(target.date)}
                  onAddSlot={(target) => openSlotForm({ date: target.date, slot: null, day: target })}
                  onOpenSlot={(slot) => setOpenSlotId(slot.id)}
                  onAddException={openException}
                />
              </div>
            )}
          </div>
        </>
      )}

      <RosterSheet
        slot={openSlot}
        onClose={() => setOpenSlotId(null)}
        trainees={trainees}
        planBadges={planBadges}
        isAdmin={isAdmin}
        onEditDetails={(slot) => openSlotForm({ date: slot.schedule_date, slot, day: findDay(week, slot.schedule_date) })}
      />

      {slotForm && (
        <SlotFormDialog
          key={`slot-${formInstance}`}
          open={slotFormOpen}
          onOpenChange={setSlotFormOpen}
          date={slotForm.date}
          slot={slotForm.slot}
          trainers={trainers}
          trainees={trainees}
          onDuty={slotForm.day?.onDuty ?? null}
          contextLabel={`${hebrewWeekday(slotForm.date)} · ${shortDate(slotForm.date)}`}
        />
      )}

      {exceptionDate && (
        <ExceptionFormDialog
          key={`exception-${formInstance}`}
          open={exceptionOpen}
          onOpenChange={setExceptionOpen}
          trainers={trainers}
          defaultDate={exceptionDate}
          canEdit={isAdmin}
        />
      )}
    </div>
  );
}

type ArrowButtonProps = { label: string; icon: "prev" | "next" } & (
  | { href: string; onClick?: never }
  | { onClick: () => void; href?: never }
);

/** RTL: "previous" is a right-pointing chevron. */
function ArrowButton({ label, icon, href, onClick }: ArrowButtonProps) {
  const Icon = icon === "prev" ? ChevronRight : ChevronLeft;
  if (href) {
    return (
      <Button variant="outline" size="icon" asChild aria-label={label}>
        <Link href={href}>
          <Icon className="h-4 w-4" />
        </Link>
      </Button>
    );
  }
  return (
    <Button variant="outline" size="icon" onClick={onClick} aria-label={label}>
      <Icon className="h-4 w-4" />
    </Button>
  );
}
```

If this file exceeds 400 lines after lint formatting, move `ArrowButton` into `src/components/admin/calendar/ArrowButton.tsx`.

Note on `BuildDayButton` / `DuplicateDayButton` / `BuildWeekButton`: they read the branch from `useCurrentBranch()` and call `router.refresh()` themselves; confirm by reading each file's top 50 lines before wiring. If `BuildWeekButton` renders nothing when `buildableCount === 0`, that is expected.

- [ ] **Step 6: Create the page**

`src/app/admin/calendar/page.tsx`:

```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { CalendarView } from "@/components/admin/calendar/CalendarView";
import { Card, CardContent } from "@/components/ui/card";
import { BranchProvider } from "@/features/branches/components/BranchContext";
import { listActiveBranchOptionsAction } from "@/features/branches/lib/actions/list-branches";
import { loadPlanStatusesForStaff } from "@/features/plans/lib/actions/staff-plan-badges";
import { getSlotsForWeekAction } from "@/lib/actions/daily-schedule";
import { getSlotFormOptionsAction } from "@/lib/actions/schedule-options";
import { getBranchScopeAction, verifyAdminOrTrainer } from "@/lib/actions/shared";
import { getExceptionsInRangeAction, getWeeklyScheduleAction } from "@/lib/actions/weekly-schedule";
import { allowedBranches, resolveRequestedBranch } from "@/lib/branches/resolve-branch";
import { resolveCalendarDate } from "@/lib/schedule/calendar";
import { addDays } from "@/lib/utils/iso-date";
import { buildWeek, startOfWeek } from "@/lib/utils/schedule-week";
import { israelToday } from "@/lib/utils/tasks";

export const metadata: Metadata = {
  title: "יומן | Garden of Eden",
};

interface PageProps {
  searchParams: Promise<{ date?: string; branch?: string }>;
}

export default async function CalendarPage({ searchParams }: PageProps) {
  const { error: authError, profile } = await verifyAdminOrTrainer();
  if (authError) redirect("/dashboard");

  const isAdmin = profile!.role === "admin";
  const today = israelToday();
  const params = await searchParams;
  const date = resolveCalendarDate(params.date, today);
  const weekStart = startOfWeek(date);
  const weekEnd = addDays(weekStart, 6);

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
        <CardContent className="py-12 text-center text-muted-foreground">אין סניפים פעילים לתצוגה</CardContent>
      </Card>
    );
  }

  // Trainers read this page too, so the pick-lists come from the admin-client
  // action (RLS hides trainee rows from a trainer).
  const [slotsResult, templateResult, exceptionsResult, optionsResult] = await Promise.all([
    getSlotsForWeekAction(weekStart, branchId),
    getWeeklyScheduleAction(weekStart, weekEnd, branchId),
    getExceptionsInRangeAction(weekStart, weekEnd, branchId),
    getSlotFormOptionsAction(branchId),
  ]);

  // Each failure degrades on its own and never renders as "nothing here".
  const slotsError = "error" in slotsResult ? slotsResult.error : null;
  const slots = "success" in slotsResult ? slotsResult.data : [];
  const templateFailed = "error" in templateResult || "error" in exceptionsResult;
  const bands = "success" in templateResult ? templateResult.data.bands : [];
  const exceptions = "success" in exceptionsResult ? exceptionsResult.data : [];
  const options = "success" in optionsResult ? optionsResult.data : { trainers: [], trainees: [] };

  const week = buildWeek({ weekStart, today, slots, bands, exceptions });

  const rosterIds = Array.from(
    new Set(slots.flatMap((slot) => slot.trainees.flatMap((t) => (t.trainee_id ? [t.trainee_id] : [])))),
  );
  const planBadges = await loadPlanStatusesForStaff(rosterIds);

  return (
    <BranchProvider value={{ branchId, branches, canSwitch: branches.length > 1 }}>
      <CalendarView
        week={week}
        weekStart={weekStart}
        date={date}
        today={today}
        isAdmin={isAdmin}
        trainers={options.trainers}
        trainees={options.trainees}
        planBadges={planBadges}
        slotsError={slotsError}
        templateFailed={templateFailed}
      />
    </BranchProvider>
  );
}
```

Check `buildWeek`'s input type in `src/lib/utils/schedule-week.ts` (`BuildWeekInput`) and match the exact field names. Check `verifyAdminOrTrainer` and `getBranchScopeAction` are both exported from `@/lib/actions/shared` (the current schedule page imports both from there).

`src/app/admin/calendar/loading.tsx`:

```tsx
import { Skeleton } from "@/components/ui/skeleton";

export default function CalendarLoading() {
  return (
    <div className="space-y-5">
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-64 w-full" />
    </div>
  );
}
```

- [ ] **Step 7: Retire the dated week tab (it still passes the old `WeekDayColumn` props)**

```bash
git rm src/components/admin/schedule/week/DatedWeekView.tsx
```

Replace `WeeklySchedulePageClient.tsx` with:

```tsx
"use client";

import Link from "next/link";
import { CalendarDays, CalendarRange } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useCurrentBranch } from "@/features/branches/components/BranchContext";
import { BranchSwitcher } from "@/features/branches/components/BranchSwitcher";
import type { TrainerOption } from "@/lib/actions/admin-trainers-list";
import type { WeeklyBand, WeeklyException } from "@/types/weekly-schedule";
import { WeeklyScheduleView } from "./WeeklyScheduleView";

interface WeeklySchedulePageClientProps {
  bands: WeeklyBand[];
  exceptions: WeeklyException[];
  panelFromDate: string;
  panelToDate: string;
  isAdmin: boolean;
  trainers: TrainerOption[];
  /** The standing template could not be read. */
  templateError: string | null;
}

/**
 * The standing week and its exceptions. The dated week that used to be a tab
 * here is the calendar's week grid now (/admin/calendar).
 */
export function WeeklySchedulePageClient({
  bands,
  exceptions,
  panelFromDate,
  panelToDate,
  isAdmin,
  trainers,
  templateError,
}: WeeklySchedulePageClientProps) {
  const { branchId } = useCurrentBranch();
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 px-1">
          <CalendarRange className="h-4 w-4 text-muted-foreground" />
          <span className="font-display text-xl">לוח שבועי</span>
          <BranchSwitcher />
        </div>
        <Button variant="outline" asChild>
          <Link href={`/admin/calendar?branch=${branchId}`}>
            <CalendarDays className="h-4 w-4" />
            ליומן
          </Link>
        </Button>
      </div>

      <WeeklyScheduleView
        bands={bands}
        exceptions={exceptions}
        fromDate={panelFromDate}
        toDate={panelToDate}
        isAdmin={isAdmin}
        trainers={trainers}
        loadError={templateError}
      />
    </div>
  );
}
```

In `src/app/admin/weekly-schedule/page.tsx`: remove the `week` search param handling, `MAX_WEEK_OFFSET_DAYS`, `getSlotsForWeekAction`, `getExceptionsInRangeAction`, `buildWeek`/`defaultWeekStart`/`startOfWeek`, `isValidDateString` and their imports; `searchParams` becomes `Promise<{ branch?: string }>`; load only `getWeeklyScheduleAction(panelFromDate, panelToDate, branchId)` and `getSlotFormOptionsAction(branchId)` in parallel; `templateError = "error" in templateResult ? templateResult.error : null`; render

```tsx
      <WeeklySchedulePageClient
        bands={bands}
        exceptions={panelExceptions}
        panelFromDate={panelFromDate}
        panelToDate={panelToDate}
        isAdmin={isAdmin}
        trainers={options.trainers}
        templateError={templateError}
      />
```

Delete `src/app/admin/weekly-schedule/loading.tsx` only if it renders a week grid skeleton that no longer matches; otherwise leave it.

- [ ] **Step 8: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: no errors. Do not add compatibility props to `WeekDayColumn`.

Then run `npm run dev`, sign in as an admin, open `http://localhost:3000/admin/calendar` at phone width (400px) and at 1280px, and check: the strip selects days without a page load; the grid header selects a day; tapping a slot opens the roster sheet; adding a trainee updates the sheet and the card count; removing works; a late-cancel entry cannot be removed; "עריכת פרטי הסלוט" opens the form without a roster field; deleting a slot closes the sheet.

- [ ] **Step 9: Commit**

```bash
git add -A src/components/admin/calendar src/app/admin/calendar src/app/admin/weekly-schedule src/components/admin/schedule/week
git commit -m "feat(schedule): booking calendar with a phone day view and a desktop week grid

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 8: Session-building list

**Files:**
- Create: `src/components/admin/schedule/SessionWorklist.tsx`
- Rewrite: `src/app/admin/schedule/page.tsx`
- Modify: `src/app/admin/schedule/session/[traineeId]/page.tsx`
- Modify: `src/components/admin/schedule/SessionBuilder.tsx`

**Interfaces:**
- Consumes: `buildSessionWorklist`, `filterWorklist`, `worklistProgress`, `WorklistGroup` (Task 1); `getScheduleAction(date, branchId)`; `getSessionSummariesAction(date)`.
- Produces: `/admin/schedule?date=&branch=&mine=1&pending=1`; row links `/admin/schedule/session/[traineeId]?date=&slot=&branch=`; `SessionBuilder` prop `branchId: string | null`.

- [ ] **Step 1: Create `SessionWorklist.tsx`**

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarDays, Check, ChevronLeft, ChevronRight, Dumbbell, HeartPulse, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useCurrentBranch } from "@/features/branches/components/BranchContext";
import { BranchSwitcher } from "@/features/branches/components/BranchSwitcher";
import { HealthSheet } from "@/features/plans/components/HealthSheet";
import { PlanSheet } from "@/features/plans/components/staff/PlanSheet";
import { filterWorklist, worklistProgress, type WorklistGroup, type WorklistRow } from "@/lib/schedule/session-worklist";
import { cn } from "@/lib/utils";
import { hebrewWeekday } from "@/lib/utils/date";
import { addDays, shortDate } from "@/lib/utils/iso-date";
import { trainerColor } from "@/lib/utils/trainer-color";
import type { StaffPlanBadge } from "@/types/plans";

const PLAN_CHIP: Partial<Record<StaffPlanBadge["status"], { label: string; className: string }>> = {
  expired: { label: "פג", className: "bg-destructive text-white" },
  ending_soon: { label: "מסתיים", className: "bg-amber-500 text-black" },
};

const STATUS: Record<WorklistRow["status"], { label: (row: WorklistRow) => string; className: string; Icon: typeof Plus }> = {
  not_built: { label: () => "לא נבנה", className: "bg-secondary text-secondary-foreground", Icon: Plus },
  built: { label: (row) => `נבנה · ${row.exerciseCount} תרגילים`, className: "bg-primary text-primary-foreground", Icon: Dumbbell },
  completed: { label: () => "הושלם", className: "bg-green-600 text-white", Icon: Check },
};

interface SessionWorklistProps {
  date: string;
  today: string;
  groups: WorklistGroup[];
  planBadges: Record<string, StaffPlanBadge>;
  loadError: string | null;
  /** Session statuses failed to load; every row would wrongly read "לא נבנה". */
  summariesFailed: boolean;
  currentUserId: string;
  isAdmin: boolean;
  mineOnly: boolean;
  pendingOnly: boolean;
}

/**
 * בניית אימונים: every rostered trainee for one day and whether their session
 * is built. Rosters are changed in the calendar, never here.
 */
export function SessionWorklist({
  date,
  today,
  groups,
  planBadges,
  loadError,
  summariesFailed,
  currentUserId,
  isAdmin,
  mineOnly,
  pendingOnly,
}: SessionWorklistProps) {
  const { branchId } = useCurrentBranch();
  const [planFor, setPlanFor] = useState<{ id: string; name: string } | null>(null);
  const [healthFor, setHealthFor] = useState<{ id: string; name: string } | null>(null);

  const hrefFor = (next: { date?: string; mine?: boolean; pending?: boolean }) => {
    const params = new URLSearchParams({ date: next.date ?? date, branch: branchId });
    if (next.mine ?? mineOnly) params.set("mine", "1");
    if (next.pending ?? pendingOnly) params.set("pending", "1");
    return `/admin/schedule?${params.toString()}`;
  };
  const calendarHref = `/admin/calendar?date=${date}&branch=${branchId}`;

  const progress = worklistProgress(groups);
  const visible = filterWorklist(groups, { mineOnly, pendingOnly, currentUserId });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" asChild aria-label="יום קודם">
          <Link href={hrefFor({ date: addDays(date, -1) })}>
            <ChevronRight className="h-4 w-4" />
          </Link>
        </Button>
        <span className="flex items-center gap-2 px-1 font-display text-xl">
          <CalendarDays className="h-4 w-4 text-muted-foreground" />
          {hebrewWeekday(date)} · {shortDate(date)}
        </span>
        <Button variant="outline" size="icon" asChild aria-label="יום הבא">
          <Link href={hrefFor({ date: addDays(date, 1) })}>
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </Button>
        {date !== today && (
          <Button variant="ghost" size="sm" asChild>
            <Link href={hrefFor({ date: today })}>היום</Link>
          </Button>
        )}
        <BranchSwitcher />
      </div>

      {loadError ? (
        <Card className="border-destructive">
          <CardContent className="py-12 text-center text-destructive">{loadError}</CardContent>
        </Card>
      ) : groups.length === 0 ? (
        <EmptyState text="אין סלוטים ליום זה" calendarHref={calendarHref} />
      ) : progress.total === 0 ? (
        <EmptyState text="אין מתאמנים לבנות להם אימון" calendarHref={calendarHref} />
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <p className="font-display text-lg tabular-nums">
              {progress.built} מתוך {progress.total} נבנו
            </p>
            <div className="flex gap-1.5" role="group" aria-label="סינון">
              <FilterLink href={hrefFor({ mine: !mineOnly })} active={mineOnly} label="רק שלי" />
              <FilterLink href={hrefFor({ pending: !pendingOnly })} active={pendingOnly} label="רק לא נבנו" />
            </div>
          </div>

          {summariesFailed && (
            <p className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              סטטוס האימונים לא נטען. ייתכן שחלק מהאימונים כבר נבנו.
            </p>
          )}

          {visible.length === 0 ? (
            <p className="rounded-xl border border-dashed py-8 text-center text-sm text-muted-foreground">
              אין תוצאות לסינון הזה
            </p>
          ) : (
            <div className="space-y-4">
              {visible.map((group) => {
                const palette = trainerColor(group.trainerId);
                return (
                  <section key={group.slotId} className="overflow-hidden rounded-2xl border">
                    <header className={cn("flex flex-wrap items-center gap-2 px-4 py-2", palette.bg)}>
                      <span className="font-display text-lg tabular-nums text-forest">{group.startTime}</span>
                      <span className={cn("h-2.5 w-2.5 rounded-full", palette.dot)} aria-hidden="true" />
                      <span className={cn("font-extrabold", palette.text)}>{group.trainerName ?? "ללא מאמן"}</span>
                      {group.locationHe && <span className="text-xs text-muted-foreground">{group.locationHe}</span>}
                    </header>
                    <ul className="divide-y">
                      {group.rows.map((row) => {
                        const status = STATUS[row.status];
                        const badge = planBadges[row.traineeId];
                        const chip = badge?.endsOn ? PLAN_CHIP[badge.status] : undefined;
                        return (
                          <li key={row.rosterEntryId} className="flex items-center gap-2 pe-3">
                            <Link
                              href={`/admin/schedule/session/${row.traineeId}?date=${date}&slot=${group.slotId}&branch=${branchId}`}
                              className="flex min-w-0 flex-1 items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/60 focus-visible:bg-muted focus-visible:outline-none"
                            >
                              <span className="truncate font-medium">{row.traineeName}</span>
                              <span className={cn("flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs", status.className)}>
                                <status.Icon className="h-3 w-3" />
                                {status.label(row)}
                              </span>
                            </Link>
                            {chip && (
                              <button
                                type="button"
                                onClick={() => setPlanFor({ id: row.traineeId, name: row.traineeName })}
                                className={cn("rounded-full px-1.5 py-0.5 text-[10px] font-bold", chip.className)}
                                aria-label={`המסלול של ${row.traineeName}: ${chip.label}`}
                              >
                                {chip.label}
                              </button>
                            )}
                            {badge?.hasMedicalNotes && (
                              <button
                                type="button"
                                onClick={() => setHealthFor({ id: row.traineeId, name: row.traineeName })}
                                className="rounded-full p-0.5 text-amber-600 hover:bg-amber-100"
                                aria-label={`מידע רפואי של ${row.traineeName}`}
                              >
                                <HeartPulse className="h-4 w-4" />
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}

      {planFor && (
        <PlanSheet traineeId={planFor.id} traineeName={planFor.name} isAdmin={isAdmin} open onOpenChange={(open) => !open && setPlanFor(null)} />
      )}
      {healthFor && (
        <HealthSheet traineeId={healthFor.id} traineeName={healthFor.name} open onOpenChange={(open) => !open && setHealthFor(null)} />
      )}
    </div>
  );
}

function EmptyState({ text, calendarHref }: { text: string; calendarHref: string }) {
  return (
    <Card className="border-2 border-dashed">
      <CardContent className="flex flex-col items-center gap-3 py-12 text-center">
        <p className="text-muted-foreground">{text}</p>
        <Button asChild>
          <Link href={calendarHref}>
            <CalendarDays className="h-4 w-4" />
            ליומן
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function FilterLink({ href, active, label }: { href: string; active: boolean; label: string }) {
  return (
    <Link
      href={href}
      aria-pressed={active}
      className={cn(
        "rounded-full border px-3 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-forest/40",
        active ? "border-forest bg-forest text-cream" : "bg-background hover:bg-muted",
      )}
    >
      {label}
    </Link>
  );
}
```

`aria-pressed` on a link is not valid ARIA; if lint (jsx-a11y) flags it, use `aria-current={active ? "true" : undefined}` instead.

- [ ] **Step 2: Rewrite `src/app/admin/schedule/page.tsx`**

```tsx
import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SessionWorklist } from "@/components/admin/schedule/SessionWorklist";
import { Card, CardContent } from "@/components/ui/card";
import { BranchProvider } from "@/features/branches/components/BranchContext";
import { listActiveBranchOptionsAction } from "@/features/branches/lib/actions/list-branches";
import { loadPlanStatusesForStaff } from "@/features/plans/lib/actions/staff-plan-badges";
import { getScheduleAction } from "@/lib/actions/daily-schedule";
import { getBranchScopeAction, verifyAdminOrTrainer } from "@/lib/actions/shared";
import { getSessionSummariesAction } from "@/lib/actions/training-sessions";
import { allowedBranches, resolveRequestedBranch } from "@/lib/branches/resolve-branch";
import { buildSessionWorklist } from "@/lib/schedule/session-worklist";
import { israelToday } from "@/lib/utils/tasks";
import { isValidDateString } from "@/lib/validations/common";

export const metadata: Metadata = {
  title: "בניית אימונים | Garden of Eden",
};

interface PageProps {
  searchParams: Promise<{ date?: string; branch?: string; mine?: string; pending?: string }>;
}

export default async function SessionWorklistPage({ searchParams }: PageProps) {
  const { error: authError, user, profile } = await verifyAdminOrTrainer();
  if (authError) redirect("/dashboard");

  const today = israelToday();
  const params = await searchParams;
  const date = params.date && isValidDateString(params.date) ? params.date : today;

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
        <CardContent className="py-12 text-center text-muted-foreground">אין סניפים פעילים לתצוגה</CardContent>
      </Card>
    );
  }

  const [scheduleResult, summariesResult] = await Promise.all([
    getScheduleAction(date, branchId),
    getSessionSummariesAction(date),
  ]);

  const loadError = "error" in scheduleResult ? scheduleResult.error : null;
  const slots = "success" in scheduleResult ? scheduleResult.data : [];
  const summariesFailed = "error" in summariesResult;
  const summaries = "success" in summariesResult ? summariesResult.data : {};

  const groups = buildSessionWorklist(slots, summaries);
  const traineeIds = Array.from(new Set(groups.flatMap((group) => group.rows.map((row) => row.traineeId))));
  const planBadges = await loadPlanStatusesForStaff(traineeIds);

  return (
    <BranchProvider value={{ branchId, branches, canSwitch: branches.length > 1 }}>
      <SessionWorklist
        date={date}
        today={today}
        groups={groups}
        planBadges={planBadges}
        loadError={loadError}
        summariesFailed={summariesFailed}
        currentUserId={user!.id}
        isAdmin={profile!.role === "admin"}
        mineOnly={params.mine === "1"}
        pendingOnly={params.pending === "1"}
      />
    </BranchProvider>
  );
}
```

- [ ] **Step 3: Session builder back link keeps the branch**

In `src/app/admin/schedule/session/[traineeId]/page.tsx`: add `branch?: string` to `searchParams`, compute `const branchId = query.branch && isValidUUID(query.branch) ? query.branch : null;`, and pass `branchId={branchId}` to `SessionBuilder`.

In `src/components/admin/schedule/SessionBuilder.tsx`: add to `SessionBuilderProps`

```ts
  /** The branch the worklist was showing, so "back" returns to it. */
  branchId: string | null;
```

destructure it, and replace `const backHref = \`/admin/schedule?date=${date}\`;` with

```ts
  const backHref = `/admin/schedule?date=${date}${branchId ? `&branch=${branchId}` : ""}`;
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: the only remaining errors are the unused `ScheduleDayView.tsx`/`SlotCard.tsx` if lint reports unused files (it normally does not) and `DatedWeekView.tsx` from Task 7.

With `npm run dev`: open `/admin/schedule` for a day that has slots with linked trainees. Check the counter, both filters, a row opens the builder, "back" returns to the same day and branch, and an empty day shows the "ליומן" button.

- [ ] **Step 5: Commit**

```bash
git add src/components/admin/schedule/SessionWorklist.tsx src/app/admin/schedule/page.tsx "src/app/admin/schedule/session/[traineeId]/page.tsx" src/components/admin/schedule/SessionBuilder.tsx
git commit -m "feat(schedule): the daily page becomes a session-building list

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

### Task 9: Navigation, cache, cleanup, docs

**Files:**
- Delete: `src/components/admin/schedule/ScheduleDayView.tsx`, `src/components/admin/schedule/SlotCard.tsx`
- Modify: `src/lib/navigation/admin-nav.ts`
- Modify: `src/lib/actions/shared/revalidate-schedule.ts`
- Modify: `src/features/booking/lib/actions/book.ts`, `src/features/plans/lib/actions/staff-payment.ts`, `src/features/plans/lib/actions/trainee-health.ts`
- Modify: `docs/adr/0003-weekly-schedule-derives-staffing.md`, `CLAUDE.md`

- [ ] **Step 1: Delete replaced components**

```bash
git rm src/components/admin/schedule/ScheduleDayView.tsx src/components/admin/schedule/SlotCard.tsx
grep -rn "ScheduleDayView\|SlotCard\b" src
```

Expected: no matches (the new `/admin/schedule` page from Task 8 no longer imports them).

- [ ] **Step 2: Navigation**

In `src/lib/navigation/admin-nav.ts`, add `ClipboardList` to the lucide import (and `CalendarDays`), and replace the first two items of the "תפעול" section plus renumber the rest:

```ts
      { href: "/admin/calendar", label: "יומן", icon: CalendarDays, mobileOrder: 1 },
      { href: "/admin/schedule", label: "בניית אימונים", icon: ClipboardList, mobileOrder: 2 },
      { href: "/admin/weekly-schedule", label: "לוח שבועי", icon: CalendarRange, mobileOrder: 3 },
      { href: "/admin/tasks", label: "משימות", icon: ListChecks, mobileOrder: 6 },
      { href: "/admin/end-of-shift", label: "דוח משמרת", icon: ClipboardCheck, mobileOrder: 4 },
      { href: "/admin/shifts", label: "שעות עבודה", icon: Clock, mobileOrder: 5 },
      { href: "/admin/safety", label: "נוהל בטיחות", icon: ShieldAlert, mobileOrder: 7 },
```

Remove `CalendarClock` from the import if it is no longer used anywhere in the file. Run `grep -rn "admin-nav\|ADMIN_NAV" src --include=*.test.ts` and update any test that asserts the old labels.

- [ ] **Step 3: Cache invalidation**

`src/lib/actions/shared/revalidate-schedule.ts`: update the doc comment ("Three pages: the booking calendar, the session-building list, and the weekly page, whose bands and exceptions share these writes.") and add

```ts
  revalidatePath("/admin/calendar");
```

before the existing two calls.

In `book.ts` (after line `revalidatePath("/admin/schedule");`), `staff-payment.ts` (same line) and `trainee-health.ts` (same line) add:

```ts
  revalidatePath("/admin/calendar");
```

- [ ] **Step 4: Docs**

Append to `docs/adr/0003-weekly-schedule-derives-staffing.md`:

```markdown
## Amendment 2026-09-16: the dated week moved to the calendar

Staff now have two screens instead of one board: `/admin/calendar` (who is in
which slot, a phone day view and a desktop week grid) and `/admin/schedule`
(which rostered trainees still need a Training session). The "השבוע הזה" tab
left this page for the calendar's week grid; `/admin/weekly-schedule` shows the
standing template and exceptions only. Nothing about deriving staffing or
materialising slots changed. Rosters edited from the calendar are written one
entry at a time, so a staff edit cannot delete a booking a trainee made while
the form was open. Spec: `docs/superpowers/specs/2026-09-16-staff-calendar-split-design.md`.
```

In `CLAUDE.md`, under "### Self-booking (קריית אתא)", append one paragraph:

```markdown
Staff screens: `/admin/calendar` is the booking calendar (roster per slot through `addSlotTraineeAction` / `removeSlotTraineeAction` in `src/lib/actions/daily-schedule-roster.ts`, never a whole-roster replace), and `/admin/schedule` is the session-building list derived by `buildSessionWorklist()` in `src/lib/schedule/session-worklist.ts`. Editing an existing slot's details sends no roster.
```

- [ ] **Step 5: Full verification**

Run each and read the output:

```bash
npx tsc --noEmit
npm run lint
npm run test:run
npm run build
```

Expected: tsc and lint clean; tests pass except the 20 known localStorage failures in goals and streak-tracking; build succeeds. If anything else fails, fix it before committing and report it.

Manual smoke with `npm run dev`, as admin and as a trainer, in both branches, at 400px and 1280px:
1. `/admin/calendar`: switch branch; move days on the strip and weeks with the arrows; "היום".
2. Create a slot; open it; add a linked trainee, a free-text name, and one past capacity (warning toast); remove one.
3. With a trainee account, book a קריית אתא slot from `/dashboard/schedule` while the staff roster sheet is open; refresh the staff page; the booking is still there and shows the "נרשם בעצמו" icon.
4. Edit slot details from the sheet; the roster is unchanged afterwards.
5. WhatsApp copy, duplicate day and build day (admin) from the calendar; build week on desktop.
6. `/admin/schedule`: counter, "רק שלי", "רק לא נבנו", open a builder, save, back returns to the same day and branch with the row now "נבנה".
7. `/admin/weekly-schedule`: template and exceptions only; "ליומן" works.
8. Sidebar shows יומן, בניית אימונים, לוח שבועי.

- [ ] **Step 6: Commit**

```bash
git add -A src docs CLAUDE.md
git commit -m "feat(schedule): wire the calendar into navigation and retire the combined board

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Self-Review Notes

- Spec coverage: routes and nav (Task 9), calendar layouts and header actions (Task 7), roster sheet (Task 6), per-entry writes (Task 3), details-only edit (Tasks 4-5), worklist data, layout, filters, empty states, back link (Tasks 1, 8), weekly page (Task 9), revalidation (Task 9), tests (Tasks 1-4), docs (Task 9).
- Ordering: Task 7 changes `WeekDayColumn` props and deletes its only other consumer (`DatedWeekView`) in the same task, so the tree type-checks after every task. The old `ScheduleDayView`/`SlotCard` stay compiling until Task 9 deletes them.
- Type names checked across tasks: `WorklistGroup`/`WorklistRow`, `RosterAddInput`/`RosterRemoveInput`, `onOpen` (WeekSlotCard), `onOpenSlot`/`onSelectDay`/`isSelected` (WeekDayColumn), `branchId` (SessionBuilder).
