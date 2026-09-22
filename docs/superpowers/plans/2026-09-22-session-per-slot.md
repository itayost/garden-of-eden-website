# Session Per Slot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A trainee booked into two slots on one day receives two separate workouts instead of one shared session.

**Architecture:** `training_sessions` loses `UNIQUE (trainee_id, session_date)` and gains a partial `UNIQUE (trainee_id, slot_id) WHERE slot_id IS NOT NULL`. The group fan-out loses its `skip_other_slot` rule entirely. The trainee's screen opens one session and collapses the rest; every staff read that was keyed by trainee id is re-keyed by slot and trainee.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Supabase Postgres with RLS, Tailwind 4, Radix, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-22-session-per-slot-design.md`

## Global Constraints

- All user-facing text is Hebrew. The app is RTL.
- Use logical CSS properties (`ms`/`me`/`start`/`end`), never `left`/`right`.
- No emojis in code, comments, or docs.
- Immutability: never mutate an object or array.
- Path alias `@/` maps to `src/`.
- Server actions call `verifyAdminOrTrainer()` (staff) or run on the user-scoped client with RLS (trainee); ids are checked with `isValidUUID()`.
- Action result shape: `{ success: true, data }` or `{ error: "הודעה בעברית" }`.
- No mock-based tests. Only pure functions get unit tests.
- **There is no staging database. `supabase db push` writes to production.** That is why the migration is Task 5 and not Task 1: between dropping the constraint and shipping the readers, a group save would create a second session that `getMyTodaySessionAction`'s `maybeSingle()` would choke on. Write the migration file in Task 2, push it only in Task 5.
- Baseline: 20 `localStorage` tests in goals and streak-tracking fail on `main`. Not a regression signal.

---

### Task 1: Which session is open

The trainee's screen shows one workout and collapses the rest. Which one is open depends on the wall clock, so it cannot be tested through the screen — it comes out as a pure function first.

**Files:**
- Create: `src/lib/schedule/open-session.ts`
- Test: `src/lib/schedule/__tests__/open-session.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface OpenSessionCandidate { id: string; startTime: string | null; exerciseIds: readonly string[] }`
  - `sortTodaySessions<T extends { startTime: string | null }>(sessions: readonly T[]): T[]`
  - `pickOpenSession(sessions: readonly OpenSessionCandidate[], nowMinutes: number, focusId: string | null): string | null`

- [ ] **Step 1: Write the failing test**

Create `src/lib/schedule/__tests__/open-session.test.ts`:

```ts
import { describe, expect, test } from "vitest";

import { pickOpenSession, sortTodaySessions } from "../open-session";

const MORNING = { id: "s-morning", startTime: "09:00", exerciseIds: ["e1", "e2"] };
const EVENING = { id: "s-evening", startTime: "19:00", exerciseIds: ["e3"] };
const SLOTLESS = { id: "s-none", startTime: null, exerciseIds: ["e4"] };

const at = (hours: number) => hours * 60;

describe("sortTodaySessions", () => {
  test("orders by start time and puts a session with no slot last", () => {
    const sorted = sortTodaySessions([SLOTLESS, EVENING, MORNING]);
    expect(sorted.map((s) => s.id)).toEqual(["s-morning", "s-evening", "s-none"]);
  });

  test("leaves a single session alone", () => {
    expect(sortTodaySessions([EVENING]).map((s) => s.id)).toEqual(["s-evening"]);
  });

  test("does not mutate the input", () => {
    const input = [EVENING, MORNING];
    sortTodaySessions(input);
    expect(input.map((s) => s.id)).toEqual(["s-evening", "s-morning"]);
  });
});

describe("pickOpenSession", () => {
  test("returns null for no sessions", () => {
    expect(pickOpenSession([], at(12), null)).toBeNull();
  });

  test("before the first hour, opens the earliest", () => {
    expect(pickOpenSession([MORNING, EVENING], at(7), null)).toBe("s-morning");
  });

  test("between the two hours, opens the one that already started", () => {
    expect(pickOpenSession([MORNING, EVENING], at(12), null)).toBe("s-morning");
  });

  test("after the last hour, opens the last one that started", () => {
    expect(pickOpenSession([MORNING, EVENING], at(22), null)).toBe("s-evening");
  });

  test("exactly at the start time counts as started", () => {
    expect(pickOpenSession([MORNING, EVENING], at(19), null)).toBe("s-evening");
  });

  test("a session with no slot is opened only when it is the only one", () => {
    expect(pickOpenSession([SLOTLESS], at(12), null)).toBe("s-none");
    expect(pickOpenSession([MORNING, SLOTLESS], at(12), null)).toBe("s-morning");
  });

  test("a scanned exercise wins over the clock", () => {
    expect(pickOpenSession([MORNING, EVENING], at(9), "e3")).toBe("s-evening");
  });

  test("a focus id that matches nothing falls back to the clock", () => {
    expect(pickOpenSession([MORNING, EVENING], at(9), "missing")).toBe("s-morning");
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm run test:run -- src/lib/schedule/__tests__/open-session.test.ts`
Expected: FAIL, "Failed to resolve import ... ../open-session".

- [ ] **Step 3: Write the implementation**

Create `src/lib/schedule/open-session.ts`:

```ts
/**
 * Which of a trainee's workouts is the one they are looking at.
 *
 * A trainee booked into two hours on one day has two sessions. The screen
 * opens one and collapses the rest, and getting that wrong means someone
 * standing at a machine at 19:00 reads the morning's targets.
 *
 * Pure, and takes the clock as a number, because "which hour is now" is
 * exactly the part that must be testable without a real clock.
 */

export interface OpenSessionCandidate {
  id: string;
  /** HH:MM of the slot this session belongs to; null when it has no slot. */
  startTime: string | null;
  /** Session-exercise ids, for resolving a QR scan. */
  exerciseIds: readonly string[];
}

/** Minutes since midnight, or null for a session with no slot. */
function minutesOf(startTime: string | null): number | null {
  if (!startTime) return null;
  const [hours, minutes] = startTime.split(":");
  return Number(hours) * 60 + Number(minutes);
}

/**
 * Chronological, with a session that belongs to no slot last: it has no hour
 * to sort by, and it is the rare shape (one row in the whole table today).
 */
export function sortTodaySessions<T extends { startTime: string | null }>(
  sessions: readonly T[],
): T[] {
  return [...sessions].sort((a, b) => {
    const left = minutesOf(a.startTime);
    const right = minutesOf(b.startTime);
    if (left === null) return right === null ? 0 : 1;
    if (right === null) return -1;
    return left - right;
  });
}

/**
 * The session to open, by id.
 *
 * A scanned exercise decides it outright: the trainee is standing at that
 * machine, and the hour it belongs to is the hour they are in, whatever the
 * clock says about the rest of the day. Otherwise the last hour that has
 * already started wins, and before the first one starts, the earliest.
 */
export function pickOpenSession(
  sessions: readonly OpenSessionCandidate[],
  nowMinutes: number,
  focusId: string | null,
): string | null {
  if (sessions.length === 0) return null;

  if (focusId) {
    const scanned = sessions.find((session) => session.exerciseIds.includes(focusId));
    if (scanned) return scanned.id;
  }

  const ordered = sortTodaySessions(sessions);
  const started = ordered.filter((session) => {
    const minutes = minutesOf(session.startTime);
    return minutes !== null && minutes <= nowMinutes;
  });

  if (started.length > 0) return started[started.length - 1].id;

  const upcoming = ordered.find((session) => session.startTime !== null);
  return (upcoming ?? ordered[0]).id;
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `npm run test:run -- src/lib/schedule/__tests__/open-session.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Type-check and commit**

Run: `npx tsc --noEmit`

```bash
git add src/lib/schedule/open-session.ts src/lib/schedule/__tests__/open-session.test.ts
git commit -m "feat(schedule): which of a trainee's workouts is the open one"
```

---

### Task 2: The rule and the migration file

The fan-out rule loses a case. Write the migration alongside it so the SQL and the tested statement of the rule change in the same commit, but do not push it: Task 5 does that, once the readers can handle a second session.

**Files:**
- Modify: `src/lib/schedule/slot-workout-fanout.ts`
- Modify: `src/lib/schedule/__tests__/slot-workout-fanout.test.ts`
- Create: `supabase/migrations/20260922160000_session_per_slot.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: `FanoutAction` narrowed to `"create" | "refresh" | "skip_custom" | "skip_completed"`.

- [ ] **Step 1: Delete the obsolete tests**

In `src/lib/schedule/__tests__/slot-workout-fanout.test.ts`, delete these two tests outright — the behaviour they pin down is the thing being removed:

- `"skips a session another slot wrote the same day"`
- `"reports a slot clash on its own"` (in the `describeFanout` block)

Change the remaining `"a session with no slot at all is individual work, not another slot"` to drop the "not another slot" half of its name, since there is no longer another-slot case to contrast with:

```ts
  test("a session with no sync stamp is individual work", () => {
    const decisions = planSlotWorkoutFanout(SLOT, candidates, {
      [NOAM]: session({ slotId: null, slotWorkoutSyncedAt: null }),
    });
    expect(decisions[0].action).toBe("skip_custom");
  });
```

Add one test that states the new behaviour:

```ts
  test("a session belongs to one slot, so another slot's is simply absent", () => {
    // The caller looks sessions up by slot now, so a trainee whose other
    // hour has a session passes nothing in for this one.
    const decisions = planSlotWorkoutFanout(SLOT, candidates, {});
    expect(decisions.map((d) => d.action)).toEqual(["create", "create"]);
  });
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npm run test:run -- src/lib/schedule/__tests__/slot-workout-fanout.test.ts`
Expected: FAIL. The `OTHER_SLOT` constant is now unused (lint) and `skip_other_slot` still appears in the union.

- [ ] **Step 3: Narrow the rule**

In `src/lib/schedule/slot-workout-fanout.ts`:

Change the union:

```ts
export type FanoutAction = "create" | "refresh" | "skip_custom" | "skip_completed";
```

Change `ExistingSession` to drop `slotId`, which no longer decides anything:

```ts
/** The trainee's session for THIS slot, when they already have one. */
export interface ExistingSession {
  /** Null means a trainer edited this session individually. */
  slotWorkoutSyncedAt: string | null;
  completedAt: string | null;
}
```

Change `decide` and the signature that carried the slot:

```ts
/**
 * Completion is checked before authorship: a finished session is history
 * whoever wrote it.
 *
 * There is no "belongs to another slot" case any more. A session belongs to
 * one slot, so the caller looks up this slot's session and a trainee's other
 * hour is simply not in the map.
 */
function decide(existing: ExistingSession | undefined): FanoutAction {
  if (!existing) return "create";
  if (existing.completedAt !== null) return "skip_completed";
  if (existing.slotWorkoutSyncedAt === null) return "skip_custom";
  return "refresh";
}

export function planSlotWorkoutFanout(
  candidates: readonly FanoutCandidate[],
  existing: Readonly<Record<string, ExistingSession>>,
): FanoutDecision[] {
  return candidates.map((candidate) => ({
    traineeId: candidate.traineeId,
    traineeName: candidate.traineeName,
    action: decide(existing[candidate.traineeId]),
  }));
}
```

Drop the `skip_other_slot` entry from `SKIP_LABELS`.

Update every `planSlotWorkoutFanout(SLOT, candidates, ...)` call in the test file to `planSlotWorkoutFanout(candidates, ...)`, remove the now-unused `SLOT` and `OTHER_SLOT` constants, and remove `slotId` from the `session()` fixture.

- [ ] **Step 4: Run the tests and verify they pass**

Run: `npm run test:run -- src/lib/schedule/__tests__/slot-workout-fanout.test.ts`
Expected: PASS.

- [ ] **Step 5: Write the migration file, do not push it**

Create `supabase/migrations/20260922160000_session_per_slot.sql`:

```sql
-- A session belongs to a slot, not to a day (spec 2026-09-22).
--
-- UNIQUE (trainee_id, session_date) made a workout a property of a day, but a
-- group workout is a property of an hour. A trainee booked into two hours got
-- one workout, whichever was saved first, and the second slot's fan-out
-- returned skip_other_slot. The client's decision: two hours, two workouts.
--
-- This also closes an edge the group-workout PR left open. With one session
-- shared between two slots, cancelling the first deleted it and nothing
-- re-applied the second slot's workout. With nothing shared there is nothing
-- to take by mistake.

ALTER TABLE public.training_sessions
  DROP CONSTRAINT IF EXISTS training_sessions_trainee_id_session_date_key;

CREATE UNIQUE INDEX IF NOT EXISTS training_sessions_trainee_slot_key
  ON public.training_sessions (trainee_id, slot_id) WHERE slot_id IS NOT NULL;

-- Deliberately NO unique index on the slotless case. slot_id is ON DELETE SET
-- NULL, so deleting a slot turns its sessions slotless, and a trainee who
-- already had a slotless session that day would make the slot deletion fail on
-- a unique violation nobody could read. ON DELETE CASCADE would avoid that by
-- destroying an individually built session on a slot delete, which is worse.
-- Slotless sessions are the rare shape (one row in the whole table) and
-- upsertSessionAction reuses the most recent one, so nothing accumulates.

-- The fan-out now finds a session by slot rather than by date, and has no
-- other-slot case left to refuse.
CREATE OR REPLACE FUNCTION public.apply_slot_workout_to_trainee(
  p_slot_id UUID,
  p_trainee_id UUID
) RETURNS TEXT
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_date DATE;
  v_notes TEXT;
  v_by UUID;
  v_by_name TEXT;
  v_has_exercises BOOLEAN;
  v_session_id UUID;
  v_synced TIMESTAMPTZ;
  v_completed TIMESTAMPTZ;
BEGIN
  SELECT s.schedule_date, s.workout_notes_he, s.workout_built_by, s.workout_built_by_name
    INTO v_date, v_notes, v_by, v_by_name
    FROM daily_schedule_slots s WHERE s.id = p_slot_id;
  IF NOT FOUND THEN RETURN 'skip_no_workout'; END IF;

  SELECT EXISTS (SELECT 1 FROM slot_workout_exercises e WHERE e.slot_id = p_slot_id)
    INTO v_has_exercises;
  IF NOT v_has_exercises OR v_by IS NULL THEN RETURN 'skip_no_workout'; END IF;

  -- By slot, not by date. This is the whole change.
  SELECT ts.id, ts.slot_workout_synced_at, ts.completed_at
    INTO v_session_id, v_synced, v_completed
    FROM training_sessions ts
    WHERE ts.trainee_id = p_trainee_id AND ts.slot_id = p_slot_id;

  IF v_session_id IS NOT NULL THEN
    IF v_completed IS NOT NULL THEN RETURN 'skip_completed'; END IF;
    IF v_synced IS NULL THEN RETURN 'skip_custom'; END IF;

    UPDATE training_sessions
      SET notes_he = v_notes,
          built_by = v_by,
          built_by_name = v_by_name,
          slot_workout_synced_at = now()
      WHERE id = v_session_id;
  ELSE
    INSERT INTO training_sessions
      (trainee_id, session_date, slot_id, built_by, built_by_name, notes_he, slot_workout_synced_at)
      VALUES (p_trainee_id, v_date, p_slot_id, v_by, v_by_name, v_notes, now())
      RETURNING id INTO v_session_id;
  END IF;

  -- Merged, never replaced: exercise_logs.session_exercise_id is ON DELETE SET
  -- NULL, so dropping and re-inserting would unlink everything the trainee had
  -- already logged. Unchanged from the previous migration.
  DELETE FROM training_session_exercises tse
    WHERE tse.session_id = v_session_id
      AND NOT EXISTS (
        SELECT 1 FROM slot_workout_exercises e
         WHERE e.slot_id = p_slot_id AND e.exercise_id = tse.exercise_id);

  UPDATE training_session_exercises tse
     SET order_index = e.order_index,
         target_sets = e.target_sets,
         target_reps_he = e.target_reps_he,
         target_load_he = e.target_load_he,
         notes_he = e.notes_he,
         target_reps = e.target_reps,
         target_weight_kg = e.target_weight_kg,
         target_duration_seconds = e.target_duration_seconds,
         target_distance_m = e.target_distance_m
    FROM slot_workout_exercises e
   WHERE tse.session_id = v_session_id
     AND e.slot_id = p_slot_id
     AND e.exercise_id = tse.exercise_id;

  INSERT INTO training_session_exercises
    (session_id, exercise_id, order_index, target_sets, target_reps_he, target_load_he,
     notes_he, target_reps, target_weight_kg, target_duration_seconds, target_distance_m)
  SELECT v_session_id, e.exercise_id, e.order_index, e.target_sets, e.target_reps_he,
         e.target_load_he, e.notes_he, e.target_reps, e.target_weight_kg,
         e.target_duration_seconds, e.target_distance_m
    FROM slot_workout_exercises e
   WHERE e.slot_id = p_slot_id
     AND NOT EXISTS (
       SELECT 1 FROM training_session_exercises tse
        WHERE tse.session_id = v_session_id AND tse.exercise_id = e.exercise_id)
   ORDER BY e.order_index;

  RETURN CASE WHEN v_synced IS NULL THEN 'create' ELSE 'refresh' END;
END $$;
```

Do **not** run `supabase db push` in this task.

- [ ] **Step 6: Type-check, lint, commit**

Run: `npx tsc --noEmit && npm run lint`

```bash
git add src/lib/schedule/slot-workout-fanout.ts src/lib/schedule/__tests__/slot-workout-fanout.test.ts supabase/migrations/20260922160000_session_per_slot.sql
git commit -m "feat(schedule): a slot's workout is looked up by slot, not by day"
```

---

### Task 3: The trainee's side

**Files:**
- Modify: `src/lib/actions/trainee-workout.ts`
- Modify: `src/app/dashboard/workout/page.tsx`
- Modify: `src/components/dashboard/workout/TodayWorkout.tsx`
- Modify: `src/app/dashboard/scan/[code]/page.tsx`
- Modify: `src/types/training-session.ts`

**Interfaces:**
- Consumes: `pickOpenSession`, `sortTodaySessions` from Task 1.
- Produces:
  - `getMyTodaySessionsAction(): Promise<{ success: true; data: TodaySession[] } | { error: string }>`
  - `interface TodaySession extends TrainingSession { slotStartTime: string | null }`

- [ ] **Step 1: Add the session shape**

In `src/types/training-session.ts`, append:

```ts
/**
 * One of the trainee's sessions for today, with the hour it belongs to.
 *
 * The hour comes from the slot and is what orders the list and decides which
 * one the screen opens, so it travels with the session rather than being
 * looked up again per render.
 */
export interface TodaySession extends TrainingSession {
  /** HH:MM, or null for a session that belongs to no slot. */
  slotStartTime: string | null;
}
```

- [ ] **Step 2: Return every session for today**

In `src/lib/actions/trainee-workout.ts`, replace `getMyTodaySessionAction` with:

```ts
/**
 * The caller's sessions for today (Israel date), earliest hour first.
 *
 * Plural since a session belongs to a slot: a trainee booked into two hours
 * has two. The slot's start_time comes along because it orders the list and
 * decides which one the screen opens.
 */
export async function getMyTodaySessionsAction(): Promise<MySessionsResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "לא מחובר" };

  const { data, error } = await typedFrom(supabase, "training_sessions")
    .select(`${SESSION_SELECT_WITH_EXERCISES}, slot:daily_schedule_slots(start_time)`)
    .eq("trainee_id", user.id)
    .eq("session_date", israelToday());

  if (error) {
    console.error("Get my sessions error:", error);
    return { error: "שגיאה בטעינת האימון" };
  }

  const rows = (data ?? []) as (TrainingSession & {
    slot: { start_time: string } | null;
  })[];

  const sessions = rows.map((row) => ({
    ...row,
    slotStartTime: row.slot?.start_time?.slice(0, 5) ?? null,
    exercises: [...(row.exercises ?? [])].sort(
      (a, b) => a.order_index - b.order_index,
    ),
  }));

  return { success: true, data: sortTodaySessions(sessions) };
}
```

Add the result type beside the existing ones:

```ts
type MySessionsResult =
  | { success: true; data: TodaySession[] }
  | { error: string };
```

Add the imports:

```ts
import { sortTodaySessions } from "@/lib/schedule/open-session";
import type { TodaySession } from "@/types/training-session";
```

and remove the now-unused `MySessionResult` type.

- [ ] **Step 3: Open one and collapse the rest**

In `src/app/dashboard/workout/page.tsx`, swap the action and resolve the open session:

```tsx
  const [sessionsResult, equipmentResult] = await Promise.all([
    getMyTodaySessionsAction(),
    equipmentId ? getEquipmentExercisesAction(equipmentId) : null,
  ]);

  if ("error" in sessionsResult && sessionsResult.error === "לא מחובר") {
    redirect("/auth/login?redirect=/dashboard/workout");
  }

  const sessions = "success" in sessionsResult ? sessionsResult.data : [];
  const loadError = "error" in sessionsResult ? sessionsResult.error : null;

  // The clock is read here, on the server, so the pure picker stays testable.
  const openId = pickOpenSession(
    sessions.map((session) => ({
      id: session.id,
      startTime: session.slotStartTime,
      exerciseIds: session.exercises.map((exercise) => exercise.id),
    })),
    israelMinutesOfDay(new Date()),
    focusId,
  );
```

Imports to add:

```tsx
import { getMyTodaySessionsAction } from "@/lib/actions/trainee-workout";
import { pickOpenSession } from "@/lib/schedule/open-session";
import { israelMinutesOfDay } from "@/lib/utils/israel-time";
```

Pass both down, replacing the single `session` prop:

```tsx
      sessions={sessions}
      openId={openId}
```

- [ ] **Step 4: Render the open one and the others**

In `src/components/dashboard/workout/TodayWorkout.tsx`, replace the `session` prop:

```tsx
interface TodayWorkoutProps {
  /** Today's sessions, earliest hour first. */
  sessions: TodaySession[];
  /** Which one renders open; the rest are headers that link to it. */
  openId: string | null;
  loadError: string | null;
  /** Session exercise to auto-open (arrived via QR scan). */
  focusId: string | null;
  /** Equipment scanned, for free-log mode and log attribution. */
  equipmentId: string | null;
  equipmentExercises: { id: string; name_he: string | null; name_en: string | null }[];
  /** The trainee's last log per exercise, for the "בפעם הקודמת" hint. */
  previousLogs: PreviousLogMap;
  /** Profile of the scanned machine, so free logs get a measure-aware form. */
  freeLogEquipment: SessionEquipmentRef | null;
}
```

Inside the component, derive the open session and keep every existing render path working against it unchanged:

```tsx
  const session = sessions.find((candidate) => candidate.id === openId) ?? null;
  const others = sessions.filter((candidate) => candidate.id !== openId);
```

Above the existing session render, when `others.length > 0`, show the other hours as a short strip. Each is a button that opens that session in place, so the trainee never leaves the page:

```tsx
      {others.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="אימונים נוספים היום">
          {others.map((other) => (
            <li key={other.id}>
              <Link
                href={`/dashboard/workout?open=${other.id}`}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border px-3 text-sm transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Clock className="h-4 w-4 shrink-0 text-muted-foreground" />
                {other.slotStartTime ?? "אימון נוסף"}
                <span className="text-xs text-muted-foreground">
                  {other.completed_at ? "הושלם" : `${other.exercises.length} תרגילים`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
```

Add `Clock` to the `lucide-react` import and `Link` from `next/link`, and `TodaySession` to the type imports.

The `?open=` param needs honouring, so in `src/app/dashboard/workout/page.tsx` widen the search params to `{ focus?: string; equipment?: string; open?: string }` and let an explicit choice beat the clock:

```tsx
  const requestedId =
    params.open && isValidUUID(params.open) ? params.open : null;
  const chosen =
    requestedId && sessions.some((session) => session.id === requestedId)
      ? requestedId
      : null;

  // An explicit choice beats the clock; a stale id from an old link does not.
  const openId =
    chosen ??
    pickOpenSession(
      sessions.map((session) => ({
        id: session.id,
        startTime: session.slotStartTime,
        exerciseIds: session.exercises.map((exercise) => exercise.id),
      })),
      israelMinutesOfDay(new Date()),
      focusId,
    );
```

This replaces the `openId` assignment from Step 3 rather than sitting beside it; Step 3's version exists only so that step compiles on its own.

- [ ] **Step 5: Make a scan search every session**

In `src/app/dashboard/scan/[code]/page.tsx`, flatten the candidates across all of today's sessions. `findScanTarget` already takes a flat list, so it needs no change, and the workout page opens whichever session holds the match because `focusId` beats the clock in `pickOpenSession`:

```tsx
  const sessionsResult = await getMyTodaySessionsAction();
  const sessions = "success" in sessionsResult ? sessionsResult.data : [];

  // Across every session today, not just the open one: a trainee standing at a
  // machine that belongs to their second hour should still land on their
  // prescribed exercise rather than on a free log.
  const target = findScanTarget(
    sessions.flatMap((session) =>
      session.exercises.map((exercise) => ({
        sessionExerciseId: exercise.id,
        equipmentId: exercise.exercise?.equipment_id ?? null,
        hasLog: (exercise.logs?.length ?? 0) > 0,
      })),
    ),
    equipment.id,
  );

  if (target) {
    redirect(`/dashboard/workout?focus=${target}&equipment=${equipment.id}`);
  }

  redirect(`/dashboard/workout?equipment=${equipment.id}`);
```

- [ ] **Step 6: Type-check, lint, build, commit**

Run: `npx tsc --noEmit && npm run lint && npm run build`

```bash
git add src/lib/actions/trainee-workout.ts src/app/dashboard/workout/page.tsx src/components/dashboard/workout/TodayWorkout.tsx "src/app/dashboard/scan/[code]/page.tsx" src/types/training-session.ts
git commit -m "feat(workout): a trainee with two hours sees both, one open"
```

---

### Task 4: The staff's side

Every staff read that was keyed by trainee id is keyed by slot and trainee. The signatures and their callers move together, because a half-migrated key leaves the tree red.

**Files:**
- Modify: `src/lib/actions/training-sessions-list.ts`
- Modify: `src/lib/actions/training-sessions-mutate.ts`
- Modify: `src/lib/schedule/day-session-status.ts`
- Modify: `src/lib/schedule/__tests__/day-session-status.test.ts`
- Modify: `src/lib/schedule/session-worklist.ts`
- Modify: `src/lib/schedule/__tests__/session-worklist.test.ts`
- Modify: `src/app/admin/schedule/page.tsx`
- Modify: `src/app/admin/calendar/page.tsx`
- Modify: `src/app/admin/schedule/session/[traineeId]/page.tsx`
- Modify: `src/components/admin/calendar/RosterSheet.tsx`
- Modify: `src/components/admin/calendar/DaySlotCard.tsx`
- Modify: `src/components/admin/calendar/CalendarView.tsx`
- Modify: `src/components/admin/calendar/CalendarDayList.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `getSessionAction(traineeId: string, date: string, slotId: string | null)`
  - `getSessionSummariesAction(date: string): Record<string, Record<string, SessionSummary>>` keyed slot then trainee, with `""` for slotless
  - `getWeekSessionStatusesAction: DaySessionStatuses` keyed date, then slot, then trainee
  - `getRosterSessionsAction(slotId: string, traineeIds: string[])`
  - `WorklistRow` unchanged in shape; `buildSessionWorklist(slots, summariesBySlot)`

- [ ] **Step 1: Write the failing tests for the pure re-keying**

In `src/lib/schedule/__tests__/day-session-status.test.ts`, change every expectation to the three-level key. A row now carries `slot_id`:

```ts
  test("keys by date, then slot, then trainee", () => {
    const statuses = toDaySessionStatuses([
      { trainee_id: NOAM, session_date: "2026-09-22", slot_id: "slot-a", completed_at: null, exercises: [{ id: "e1" }] },
      { trainee_id: NOAM, session_date: "2026-09-22", slot_id: "slot-b", completed_at: "2026-09-22T18:00:00Z", exercises: [{ id: "e2" }] },
    ]);
    expect(statuses["2026-09-22"]["slot-a"][NOAM].status).toBe("built");
    expect(statuses["2026-09-22"]["slot-b"][NOAM].status).toBe("completed");
  });

  test("a session with no slot lands under the empty key", () => {
    const statuses = toDaySessionStatuses([
      { trainee_id: NOAM, session_date: "2026-09-22", slot_id: null, completed_at: null, exercises: [] },
    ]);
    expect(statuses["2026-09-22"][""][NOAM].exerciseCount).toBe(0);
  });
```

In `src/lib/schedule/__tests__/session-worklist.test.ts`, the summaries argument becomes a map of maps. Change the `summary()` helper's call sites so each is nested under its slot id, e.g. `{ "slot-1": { [NOAM]: summary(NOAM) } }`, and the fixture slot's id is `"slot-1"`.

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npm run test:run -- src/lib/schedule/__tests__/day-session-status.test.ts src/lib/schedule/__tests__/session-worklist.test.ts`
Expected: FAIL on the new key shape.

- [ ] **Step 3: Re-key the pure modules**

In `src/lib/schedule/day-session-status.ts`:

```ts
/** date -> slot id ("" when the session has no slot) -> trainee id -> status. */
export type DaySessionStatuses = Record<
  string,
  Record<string, Record<string, DaySessionStatus>>
>;

/** A session row as the week query selects it. */
export interface SessionStatusRow {
  trainee_id: string;
  session_date: string;
  slot_id: string | null;
  completed_at: string | null;
  exercises: { id: string }[] | null;
}

/**
 * A session belongs to a slot, so a trainee can hold more than one on a date
 * and the trainee id alone no longer identifies a status. The empty string
 * keys the rare session that belongs to no slot.
 */
export function toDaySessionStatuses(rows: SessionStatusRow[]): DaySessionStatuses {
  return rows.reduce<DaySessionStatuses>((statuses, row) => {
    const day = statuses[row.session_date] ?? {};
    const slotKey = row.slot_id ?? "";
    const slot = day[slotKey] ?? {};
    return {
      ...statuses,
      [row.session_date]: {
        ...day,
        [slotKey]: {
          ...slot,
          [row.trainee_id]: {
            status: row.completed_at ? "completed" : "built",
            exerciseCount: row.exercises?.length ?? 0,
          },
        },
      },
    };
  }, {});
}
```

In `src/lib/schedule/session-worklist.ts`, change the second parameter and the lookup:

```ts
/** Sessions belong to slots, so the summaries arrive keyed by slot first. */
export function buildSessionWorklist(
  slots: ScheduleSlot[],
  summaries: Record<string, Record<string, SessionSummary>>,
): WorklistGroup[] {
```

and inside the row map:

```ts
        const summary = summaries[slot.id]?.[entry.trainee_id];
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `npm run test:run -- src/lib/schedule/__tests__/day-session-status.test.ts src/lib/schedule/__tests__/session-worklist.test.ts`
Expected: PASS.

- [ ] **Step 5: Re-key the actions**

In `src/lib/actions/training-sessions-list.ts`:

`getSessionAction` takes the slot and looks up by it:

```ts
export async function getSessionAction(
  traineeId: string,
  date: string,
  slotId: string | null,
): Promise<SessionResult> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  if (!isValidUUID(traineeId)) return { error: "מזהה מתאמן לא תקין" };
  if (!isValidDateString(date)) return { error: "תאריך לא תקין" };
  if (slotId !== null && !isValidUUID(slotId)) return { error: "מזהה סלוט לא תקין" };

  const scopeError = await assertTraineeInScope(traineeId);
  if (scopeError) return { error: scopeError };

  const supabase = await createClient();
  const base = typedFrom(supabase, "training_sessions")
    .select(SESSION_SELECT_WITH_EXERCISES)
    .eq("trainee_id", traineeId);

  // With a slot the pair is unique. Without one there is deliberately no
  // unique index (see the migration), so take the most recent rather than
  // failing on a second row a deleted slot left behind.
  const { data, error } = slotId
    ? await base.eq("slot_id", slotId).maybeSingle()
    : await base
        .eq("session_date", date)
        .is("slot_id", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
```

`getSessionSummariesAction` selects `slot_id` and nests the map:

```ts
    .select(
      "id, trainee_id, slot_id, completed_at, slot_workout_synced_at, exercises:training_session_exercises(id)",
    )
```

```ts
  const summaries = rows.reduce<Record<string, Record<string, SessionSummary>>>(
    (acc, row) => {
      const slotKey = row.slot_id ?? "";
      return {
        ...acc,
        [slotKey]: {
          ...(acc[slotKey] ?? {}),
          [row.trainee_id]: {
            id: row.id,
            trainee_id: row.trainee_id,
            exerciseCount: row.exercises?.length ?? 0,
            completed_at: row.completed_at,
            isCustom: row.slot_workout_synced_at === null,
          },
        },
      };
    },
    {},
  );
```

with `slot_id: string | null` added to the row type.

`getWeekSessionStatusesAction` adds `slot_id` to its select:

```ts
    .select("trainee_id, session_date, slot_id, completed_at, exercises:training_session_exercises(id)")
```

`getRosterSessionsAction(date, traineeIds)` becomes `(slotId, traineeIds)`: replace the date validation with `if (!isValidUUID(slotId)) return { error: "מזהה סלוט לא תקין" };` and the query filter `.eq("session_date", date)` with `.eq("slot_id", slotId)`.

`getPreviousSessionAction` gains a tiebreak, since a day can now hold two:

```ts
    .order("session_date", { ascending: false })
    .order("created_at", { ascending: false })
```

In `src/lib/actions/training-sessions-mutate.ts`, `upsertSessionAction`'s `findExisting` keys by slot:

```ts
  // By slot where there is one: that pair is unique. Without a slot, the most
  // recent of the day, because the slotless case carries no unique index.
  const findExisting = () => {
    const base = typedFrom(supabase, "training_sessions")
      .select("id")
      .eq("trainee_id", traineeId);
    return slotId
      ? base.eq("slot_id", slotId).maybeSingle()
      : base
          .eq("session_date", sessionDate)
          .is("slot_id", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
  };
```

- [ ] **Step 6: Follow the callers**

- `src/app/admin/schedule/page.tsx` — `buildSessionWorklist(slots, summaries)` needs no call change; the summaries now arrive nested.
- `src/app/admin/schedule/session/[traineeId]/page.tsx` — pass the slot: `getSessionAction(traineeId, date, slotId)`.
- `src/app/admin/calendar/page.tsx` — no signature change; `sessionStatuses` is now three levels deep.
- `src/components/admin/calendar/CalendarView.tsx` and `CalendarDayList.tsx` — where a day's statuses are handed to `DaySlotCard`, pass the slot's map: `statuses={sessionStatuses[day.date]?.[slot.id] ?? {}}`.
- `src/components/admin/calendar/DaySlotCard.tsx` — its `statuses` prop is already `Record<string, DaySessionStatus>` keyed by trainee, so with the line above it needs no change.
- `src/components/admin/calendar/RosterSheet.tsx` — `getRosterSessionsAction(slot.id, ids)` instead of `(date, ids)`, and the effect's dependency becomes `slot?.id` alongside `linkedIdsKey`.

- [ ] **Step 7: Type-check, lint, test, build, commit**

Run: `npx tsc --noEmit && npm run lint && npm run test:run && npm run build`
Expected: clean apart from the 20 baseline failures.

```bash
git add src/lib src/app src/components
git commit -m "feat(schedule): staff reads are keyed by slot and trainee, not by trainee"
```

---

### Task 5: Apply and verify

**Files:**
- Regenerate: `src/types/database.generated.ts`, `supabase/schema.sql`

- [ ] **Step 1: Push the migration**

Run: `supabase db push`
Expected: `20260922160000_session_per_slot.sql` applies.

- [ ] **Step 2: Verify the constraint swap**

Run:

```bash
supabase db query --linked "SELECT conname FROM pg_constraint WHERE conrelid = 'public.training_sessions'::regclass AND contype = 'u'; SELECT indexname FROM pg_indexes WHERE tablename = 'training_sessions' AND indexname = 'training_sessions_trainee_slot_key';"
```

Expected: no `training_sessions_trainee_id_session_date_key`, and the new index present.

- [ ] **Step 3: Regenerate types and the snapshot**

Run: `npm run db:types && npm run db:schema && npx tsc --noEmit`

- [ ] **Step 4: Verify the behaviour against the database**

Run a rolled-back transaction that puts one trainee on two slots the same day, gives each slot a different group workout, and checks the outcome. Write it to the scratchpad and run it with `supabase db query --linked "$(cat …)"`:

```sql
BEGIN;

-- The busiest date in the board, and two of its slots. Chosen by query so this
-- needs no editing and no knowledge of what is in the table.
CREATE TEMP TABLE ctx AS
WITH busiest AS (
  SELECT schedule_date FROM daily_schedule_slots
  GROUP BY schedule_date HAVING count(*) >= 2
  ORDER BY schedule_date DESC LIMIT 1
), two AS (
  SELECT s.id, row_number() OVER (ORDER BY s.start_time) AS n
    FROM daily_schedule_slots s JOIN busiest b ON b.schedule_date = s.schedule_date
   LIMIT 2
)
SELECT
  (SELECT schedule_date FROM busiest) AS d,
  (SELECT id FROM two WHERE n = 1) AS slot_a,
  (SELECT id FROM two WHERE n = 2) AS slot_b,
  (SELECT p.id FROM profiles p WHERE p.role = 'trainee' AND p.is_active AND p.deleted_at IS NULL LIMIT 1) AS trainee,
  (SELECT p.id FROM profiles p WHERE p.role IN ('admin','trainer') AND p.deleted_at IS NULL LIMIT 1) AS staff;

CREATE TEMP TABLE ex AS SELECT id, row_number() OVER () AS n FROM workout_exercises LIMIT 2;
CREATE TEMP TABLE report(step text, detail text);

-- One trainee on both hours, with a clean day.
DELETE FROM training_sessions ts USING ctx c WHERE ts.trainee_id = c.trainee AND ts.session_date = c.d;
DELETE FROM daily_schedule_slot_trainees t USING ctx c WHERE t.trainee_id = c.trainee AND t.slot_id IN (c.slot_a, c.slot_b);
INSERT INTO daily_schedule_slot_trainees (slot_id, trainee_id, trainee_name, order_index, source)
SELECT c.slot_a, c.trainee, 'בדיקה', 99, 'staff' FROM ctx c
UNION ALL SELECT c.slot_b, c.trainee, 'בדיקה', 99, 'staff' FROM ctx c;

-- A different workout on each hour.
INSERT INTO report SELECT '1_save_a', string_agg(r.action || '=' || r.trainee_count, ', ')
FROM ctx c, LATERAL save_slot_workout(c.slot_a, NULL, c.staff, 'בדיקה',
  (SELECT jsonb_agg(jsonb_build_object('exercise_id', e.id, 'order_index', 0)) FROM ex e WHERE e.n = 1)) r;

INSERT INTO report SELECT '2_save_b', string_agg(r.action || '=' || r.trainee_count, ', ')
FROM ctx c, LATERAL save_slot_workout(c.slot_b, NULL, c.staff, 'בדיקה',
  (SELECT jsonb_agg(jsonb_build_object('exercise_id', e.id, 'order_index', 0)) FROM ex e WHERE e.n = 2)) r;

INSERT INTO report SELECT '3_two_sessions',
       'sessions=' || (SELECT count(*) FROM ctx c JOIN training_sessions ts ON ts.trainee_id=c.trainee AND ts.session_date=c.d)
    || ' distinct_slots=' || (SELECT count(DISTINCT ts.slot_id) FROM ctx c JOIN training_sessions ts ON ts.trainee_id=c.trainee AND ts.session_date=c.d)
    || ' distinct_exercises=' || (SELECT count(DISTINCT tse.exercise_id) FROM ctx c JOIN training_sessions ts ON ts.trainee_id=c.trainee AND ts.session_date=c.d JOIN training_session_exercises tse ON tse.session_id=ts.id);

-- Leaving one hour does not touch the other.
INSERT INTO report SELECT '4_after_drop_a', (SELECT drop_slot_workout_session(c.slot_a, c.trainee))::text
    || ' remaining=' || (SELECT count(*) FROM ctx c2 JOIN training_sessions ts ON ts.trainee_id=c2.trainee AND ts.session_date=c2.d)
FROM ctx c;

-- An individual edit of the survivor stays individual, and re-saving that hour
-- skips it rather than overwriting the trainer's work.
UPDATE training_sessions ts SET slot_workout_synced_at = NULL
FROM ctx c WHERE ts.trainee_id = c.trainee AND ts.slot_id = c.slot_b;

INSERT INTO report SELECT '5_resave_b', string_agg(r.action || '=' || r.trainee_count, ', ')
FROM ctx c, LATERAL apply_slot_workout(c.slot_b) r;

-- A slot delete that leaves a slotless session beside an existing one must not
-- fail: that is why there is no unique index on the slotless case.
INSERT INTO training_sessions (trainee_id, session_date, slot_id, built_by, built_by_name)
SELECT c.trainee, c.d, NULL, c.staff, 'בדיקה' FROM ctx c;
UPDATE training_sessions ts SET slot_id = NULL FROM ctx c
  WHERE ts.trainee_id = c.trainee AND ts.slot_id = c.slot_b;

INSERT INTO report SELECT '6_two_slotless_allowed',
       'slotless=' || (SELECT count(*) FROM ctx c JOIN training_sessions ts ON ts.trainee_id=c.trainee AND ts.session_date=c.d AND ts.slot_id IS NULL);

SELECT step, detail FROM report ORDER BY step;
ROLLBACK;
```

Expected: `3_two_sessions` reports `sessions=2 distinct_slots=2 distinct_exercises=2`; `4_after_drop_a` reports `true remaining=1`; `5_resave_b` reports `skip_custom=1`; `6_two_slotless_allowed` reports `slotless=2` rather than raising a unique violation.

- [ ] **Step 5: Confirm the rollback left production untouched**

Run:

```bash
supabase db query --linked "SELECT count(*)::int AS sessions, count(*) FILTER (WHERE slot_workout_synced_at IS NOT NULL)::int AS synced FROM training_sessions;"
```

Compare against the counts from before Step 4.

- [ ] **Step 6: Commit and hand over**

```bash
git add src/types/database.generated.ts
git commit -m "chore(schedule): regenerate types after the per-slot session migration"
```

Then report to Itay, and list the browser walkthrough as owed by him (login needs a WhatsApp OTP): build group workouts on two slots that share a date, put one trainee on both, and confirm the trainee's workout screen shows one open with the other in the strip above it, that the strip switches between them, and that a QR scan for a machine in the second hour opens the second hour.
