# Slot Group Workout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A staff member writes one workout on a schedule slot and every trainee booked into that slot receives it as their own session for that day.

**Architecture:** The slot holds the exercise list (`slot_workout_exercises`) and is the source of truth. Saving it is also the fan-out: one Postgres function writes a `training_sessions` row per active roster member, because `exercise_logs` and the trainee RLS policy both key off `training_session_exercises`, so a trainee cannot see or log a workout that has no session row of their own. A session that a trainer edited individually is marked by `slot_workout_synced_at IS NULL` and later group saves skip it.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Supabase Postgres with RLS, Tailwind 4, Radix, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-22-slot-group-workout-design.md`

## Global Constraints

- All user-facing text is Hebrew. The app is RTL (`dir="rtl"` on `<html>`).
- Use logical CSS properties (`ms`/`me`/`start`/`end`), never `left`/`right`.
- No emojis in code, comments, or docs.
- Immutability: never mutate an object or array; build a new one.
- Path alias `@/` maps to `src/`.
- Every server action calls `verifyAdminOrTrainer()` from `@/lib/actions/shared` and early-returns on `error`.
- Every id from a client is checked with `isValidUUID()` from `@/lib/validations/common`.
- A slot's branch is checked with `assertBranchReadable(slot.branch_id)` from `@/lib/actions/shared/assert-branch`.
- Never expose `SUPABASE_SERVICE_ROLE_KEY` to the client.
- No mock-based tests. Only pure functions get unit tests.
- Action result shape: `{ success: true, data }` or `{ error: "הודעה בעברית" }`.
- Files stay 200-400 lines, 800 max.
- Conventional commits with a feature scope, e.g. `feat(schedule):`.
- Do not edit `.env*` files; a PreToolUse hook blocks it.

---

### Task 1: The fan-out planner

The one pure decision in the feature: given a slot's roster and whatever sessions those trainees already have that day, what happens to each of them. The Postgres function in Task 2 implements exactly these five outcomes, and this module is what pins them down and what the Hebrew toast is built from.

**Files:**
- Create: `src/lib/schedule/slot-workout-fanout.ts`
- Test: `src/lib/schedule/__tests__/slot-workout-fanout.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type FanoutAction = "create" | "refresh" | "skip_custom" | "skip_completed" | "skip_other_slot"`
  - `interface FanoutCandidate { traineeId: string; traineeName: string }`
  - `interface ExistingSession { slotId: string | null; slotWorkoutSyncedAt: string | null; completedAt: string | null }`
  - `interface FanoutDecision { traineeId: string; traineeName: string; action: FanoutAction }`
  - `type FanoutCounts = Partial<Record<FanoutAction, number>>`
  - `planSlotWorkoutFanout(slotId: string, candidates: readonly FanoutCandidate[], existing: Readonly<Record<string, ExistingSession>>): FanoutDecision[]`
  - `countFanout(decisions: readonly FanoutDecision[]): FanoutCounts`
  - `describeFanout(counts: FanoutCounts): string`

- [ ] **Step 1: Write the failing test**

Create `src/lib/schedule/__tests__/slot-workout-fanout.test.ts`:

```ts
import { describe, expect, test } from "vitest";

import {
  countFanout,
  describeFanout,
  planSlotWorkoutFanout,
  type ExistingSession,
} from "../slot-workout-fanout";

const SLOT = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const OTHER_SLOT = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const NOAM = "11111111-1111-4111-8111-111111111111";
const OMER = "22222222-2222-4222-8222-222222222222";

const candidates = [
  { traineeId: NOAM, traineeName: "נועם" },
  { traineeId: OMER, traineeName: "עומר" },
];

function session(overrides: Partial<ExistingSession> = {}): ExistingSession {
  return {
    slotId: SLOT,
    slotWorkoutSyncedAt: "2026-09-22T10:00:00.000Z",
    completedAt: null,
    ...overrides,
  };
}

describe("planSlotWorkoutFanout", () => {
  test("creates a session for a trainee with nothing that day", () => {
    const decisions = planSlotWorkoutFanout(SLOT, candidates, {});
    expect(decisions.map((d) => d.action)).toEqual(["create", "create"]);
  });

  test("refreshes a session this slot already wrote", () => {
    const decisions = planSlotWorkoutFanout(SLOT, candidates, { [NOAM]: session() });
    expect(decisions[0].action).toBe("refresh");
  });

  test("skips a session a trainer edited individually", () => {
    const decisions = planSlotWorkoutFanout(SLOT, candidates, {
      [NOAM]: session({ slotWorkoutSyncedAt: null }),
    });
    expect(decisions[0].action).toBe("skip_custom");
  });

  test("skips a completed session even when it came from this slot", () => {
    const decisions = planSlotWorkoutFanout(SLOT, candidates, {
      [NOAM]: session({ completedAt: "2026-09-22T18:00:00.000Z" }),
    });
    expect(decisions[0].action).toBe("skip_completed");
  });

  test("a completed session that was edited individually reads as completed", () => {
    const decisions = planSlotWorkoutFanout(SLOT, candidates, {
      [NOAM]: session({ slotWorkoutSyncedAt: null, completedAt: "2026-09-22T18:00:00.000Z" }),
    });
    expect(decisions[0].action).toBe("skip_completed");
  });

  test("skips a session another slot wrote the same day", () => {
    const decisions = planSlotWorkoutFanout(SLOT, candidates, {
      [NOAM]: session({ slotId: OTHER_SLOT }),
    });
    expect(decisions[0].action).toBe("skip_other_slot");
  });

  test("a session with no slot at all is individual work, not another slot", () => {
    const decisions = planSlotWorkoutFanout(SLOT, candidates, {
      [NOAM]: session({ slotId: null, slotWorkoutSyncedAt: null }),
    });
    expect(decisions[0].action).toBe("skip_custom");
  });

  test("keeps the caller's order and carries the name through", () => {
    const decisions = planSlotWorkoutFanout(SLOT, candidates, {});
    expect(decisions.map((d) => d.traineeName)).toEqual(["נועם", "עומר"]);
  });
});

describe("countFanout", () => {
  test("counts one entry per action that occurred", () => {
    const decisions = planSlotWorkoutFanout(SLOT, candidates, {
      [NOAM]: session({ slotWorkoutSyncedAt: null }),
    });
    expect(countFanout(decisions)).toEqual({ skip_custom: 1, create: 1 });
  });

  test("an empty roster counts nothing", () => {
    expect(countFanout([])).toEqual({});
  });
});

describe("describeFanout", () => {
  test("names how many received the workout", () => {
    expect(describeFanout({ create: 3 })).toBe("האימון נשלח ל-3 מתאמנים");
  });

  test("counts a refresh as received", () => {
    expect(describeFanout({ create: 1, refresh: 2 })).toBe("האימון נשלח ל-3 מתאמנים");
  });

  test("uses the singular for one trainee", () => {
    expect(describeFanout({ create: 1 })).toBe("האימון נשלח למתאמן אחד");
  });

  test("says why trainees were skipped", () => {
    expect(describeFanout({ create: 2, skip_custom: 1, skip_completed: 1 })).toBe(
      "האימון נשלח ל-2 מתאמנים. דילוג: 1 עם אימון אישי, 1 שכבר הושלם",
    );
  });

  test("reports a slot clash on its own", () => {
    expect(describeFanout({ skip_other_slot: 2 })).toBe(
      "איש לא קיבל את האימון. דילוג: 2 עם אימון מסלוט אחר באותו יום",
    );
  });

  test("an empty roster says so plainly", () => {
    expect(describeFanout({})).toBe("אין רשומים לסלוט, האימון נשמר בלבד");
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm run test:run -- src/lib/schedule/__tests__/slot-workout-fanout.test.ts`
Expected: FAIL, "Failed to resolve import ... ../slot-workout-fanout".

- [ ] **Step 3: Write the implementation**

Create `src/lib/schedule/slot-workout-fanout.ts`:

```ts
/**
 * What a slot's group workout does to each roster member, as one pure
 * decision.
 *
 * A trainee cannot see or log a workout that has no training_sessions row of
 * their own, so saving a group workout writes one session per roster member.
 * Three things must never be overwritten by that: a session a trainer built
 * for this trainee individually, a session the trainee already completed, and
 * a session another slot wrote the same day (training_sessions is UNIQUE on
 * trainee and date, so there is only one to go round).
 *
 * The apply_slot_workout_to_trainee Postgres function implements exactly these
 * outcomes with these names. This module is where they are pinned down and
 * tested, and where the Hebrew summary is built.
 */

export type FanoutAction =
  | "create"
  | "refresh"
  | "skip_custom"
  | "skip_completed"
  | "skip_other_slot";

export interface FanoutCandidate {
  traineeId: string;
  traineeName: string;
}

/** The trainee's session for the slot's date, when they already have one. */
export interface ExistingSession {
  slotId: string | null;
  /** Null means a trainer edited this session individually. */
  slotWorkoutSyncedAt: string | null;
  completedAt: string | null;
}

export interface FanoutDecision {
  traineeId: string;
  traineeName: string;
  action: FanoutAction;
}

export type FanoutCounts = Partial<Record<FanoutAction, number>>;

/**
 * Completion is checked before authorship: a finished session is history
 * whoever wrote it. Individual editing is checked before the slot, so a
 * session with no slot at all reads as individual work rather than as a clash
 * with some other slot.
 */
function decide(slotId: string, existing: ExistingSession | undefined): FanoutAction {
  if (!existing) return "create";
  if (existing.completedAt !== null) return "skip_completed";
  if (existing.slotWorkoutSyncedAt === null) return "skip_custom";
  if (existing.slotId !== slotId) return "skip_other_slot";
  return "refresh";
}

export function planSlotWorkoutFanout(
  slotId: string,
  candidates: readonly FanoutCandidate[],
  existing: Readonly<Record<string, ExistingSession>>,
): FanoutDecision[] {
  return candidates.map((candidate) => ({
    traineeId: candidate.traineeId,
    traineeName: candidate.traineeName,
    action: decide(slotId, existing[candidate.traineeId]),
  }));
}

export function countFanout(decisions: readonly FanoutDecision[]): FanoutCounts {
  return decisions.reduce<FanoutCounts>(
    (counts, decision) => ({
      ...counts,
      [decision.action]: (counts[decision.action] ?? 0) + 1,
    }),
    {},
  );
}

const SKIP_LABELS: { action: FanoutAction; label: string }[] = [
  { action: "skip_custom", label: "עם אימון אישי" },
  { action: "skip_completed", label: "שכבר הושלם" },
  { action: "skip_other_slot", label: "עם אימון מסלוט אחר באותו יום" },
];

/** "האימון נשלח ל-3 מתאמנים. דילוג: 1 עם אימון אישי" */
export function describeFanout(counts: FanoutCounts): string {
  const received = (counts.create ?? 0) + (counts.refresh ?? 0);
  const skipped = SKIP_LABELS.flatMap(({ action, label }) => {
    const count = counts[action] ?? 0;
    return count > 0 ? [`${count} ${label}`] : [];
  });

  if (received === 0 && skipped.length === 0) {
    return "אין רשומים לסלוט, האימון נשמר בלבד";
  }

  const head =
    received === 0
      ? "איש לא קיבל את האימון"
      : received === 1
        ? "האימון נשלח למתאמן אחד"
        : `האימון נשלח ל-${received} מתאמנים`;

  return skipped.length === 0 ? head : `${head}. דילוג: ${skipped.join(", ")}`;
}
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `npm run test:run -- src/lib/schedule/__tests__/slot-workout-fanout.test.ts`
Expected: PASS, 16 tests.

- [ ] **Step 5: Type-check**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add src/lib/schedule/slot-workout-fanout.ts src/lib/schedule/__tests__/slot-workout-fanout.test.ts
git commit -m "feat(schedule): the rule for who receives a slot's group workout"
```

---

### Task 2: Migration

The table, the four slot columns, the session marker, and the five functions. `save_slot_workout` is the only write path the app uses: it replaces the exercise rows, stamps the slot, and fans out in one transaction, so a saved group workout that reached nobody is not a state this schema can be in.

None of the new functions is `SECURITY DEFINER`. Staff already have a `FOR ALL` policy on `training_sessions`, so the existing RLS stays the gate. `book_slot` is `SECURITY DEFINER` and a function it calls runs with the definer's rights, which is what lets a trainee's own booking write their session.

**Files:**
- Create: `supabase/migrations/20260922100000_slot_group_workout.sql`
- Regenerate: `src/types/database.generated.ts`, `supabase/schema.sql`

**Interfaces:**
- Consumes: the five action names from Task 1.
- Produces, callable through `supabase.rpc()`:
  - `save_slot_workout(p_slot_id uuid, p_notes text, p_built_by uuid, p_built_by_name text, p_exercises jsonb) -> setof (action text, trainee_count int)`
  - `clear_slot_workout(p_slot_id uuid) -> int` (sessions removed)
  - `apply_slot_workout(p_slot_id uuid) -> setof (action text, trainee_count int)`
  - `apply_slot_workout_to_trainee(p_slot_id uuid, p_trainee_id uuid) -> text`
  - `drop_slot_workout_session(p_slot_id uuid, p_trainee_id uuid) -> boolean`

- [ ] **Step 1: Read the current book_slot body**

The migration replaces `book_slot` wholesale, so start from what production runs.

Run: `sed -n '3046,3118p' supabase/schema.sql`

Keep that output. Step 2 reuses the body verbatim with one line added.

- [ ] **Step 2: Write the migration**

Create `supabase/migrations/20260922100000_slot_group_workout.sql`:

```sql
-- A group workout on a schedule slot (spec 2026-09-22).
--
-- Kiryat Ata is group training: everyone booked into a slot does the same
-- workout. The slot holds that list and is the source of truth, but a trainee
-- cannot see or log a workout that has no training_sessions row of their own
-- (exercise_logs.session_exercise_id and the trainee RLS policy both key off
-- training_session_exercises), so saving the slot's list also writes one
-- session per active roster member.
--
-- training_sessions.slot_workout_synced_at NOT NULL means "this session was
-- written by the group and nobody has touched it individually since". Saving
-- from the individual builder clears it, and that is the exception the client
-- asked for: a trainer's own edit survives every later group save.

CREATE TABLE IF NOT EXISTS public.slot_workout_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id UUID NOT NULL REFERENCES public.daily_schedule_slots(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES public.workout_exercises(id) ON DELETE CASCADE,
  order_index INTEGER NOT NULL DEFAULT 0,
  target_sets INTEGER,
  target_reps_he TEXT,
  target_load_he TEXT,
  target_reps INTEGER,
  target_weight_kg NUMERIC(5,2),
  target_duration_seconds INTEGER,
  target_distance_m INTEGER,
  notes_he TEXT,
  -- Same bounds as training_session_exercises: a target that passes here and
  -- fails there would break the fan-out after the trainer already saved.
  CONSTRAINT slot_workout_exercises_targets_range CHECK (
    (target_reps IS NULL OR target_reps BETWEEN 1 AND 999)
    AND (target_weight_kg IS NULL OR target_weight_kg BETWEEN 0 AND 500)
    AND (target_duration_seconds IS NULL OR target_duration_seconds BETWEEN 1 AND 86400)
    AND (target_distance_m IS NULL OR target_distance_m BETWEEN 1 AND 100000)
  )
);

CREATE INDEX IF NOT EXISTS idx_slot_workout_exercises_slot
  ON public.slot_workout_exercises (slot_id, order_index);

ALTER TABLE public.slot_workout_exercises ENABLE ROW LEVEL SECURITY;

-- Staff only, and no trainee policy at all: a trainee reads the copy that was
-- written for them, never the slot's list.
DROP POLICY IF EXISTS "slot_workout_exercises_staff_all" ON public.slot_workout_exercises;
CREATE POLICY "slot_workout_exercises_staff_all" ON public.slot_workout_exercises
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('admin', 'trainer')
      AND p.deleted_at IS NULL))
  WITH CHECK (EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = (SELECT auth.uid())
      AND p.role IN ('admin', 'trainer')
      AND p.deleted_at IS NULL));

-- workout_built_by is not bookkeeping. training_sessions.built_by is NOT NULL,
-- and a trainee booking themselves in brings no staff user with the request,
-- so a fanned-out session is credited to whoever wrote the group workout.
ALTER TABLE public.daily_schedule_slots
  ADD COLUMN IF NOT EXISTS workout_notes_he TEXT,
  ADD COLUMN IF NOT EXISTS workout_built_by UUID REFERENCES public.profiles(id),
  ADD COLUMN IF NOT EXISTS workout_built_by_name TEXT,
  ADD COLUMN IF NOT EXISTS workout_updated_at TIMESTAMPTZ;

ALTER TABLE public.daily_schedule_slots
  DROP CONSTRAINT IF EXISTS slot_workout_notes_length;
ALTER TABLE public.daily_schedule_slots
  ADD CONSTRAINT slot_workout_notes_length
  CHECK (char_length(workout_notes_he) <= 300);

ALTER TABLE public.training_sessions
  ADD COLUMN IF NOT EXISTS slot_workout_synced_at TIMESTAMPTZ;

-- One roster member's copy. Returns the action it took, using the same five
-- names as planSlotWorkoutFanout() in src/lib/schedule/slot-workout-fanout.ts,
-- plus skip_no_workout for a slot that has no group workout to give.
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
  v_session_slot UUID;
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

  SELECT ts.id, ts.slot_id, ts.slot_workout_synced_at, ts.completed_at
    INTO v_session_id, v_session_slot, v_synced, v_completed
    FROM training_sessions ts
    WHERE ts.trainee_id = p_trainee_id AND ts.session_date = v_date;

  IF v_session_id IS NOT NULL THEN
    IF v_completed IS NOT NULL THEN RETURN 'skip_completed'; END IF;
    IF v_synced IS NULL THEN RETURN 'skip_custom'; END IF;
    IF v_session_slot IS DISTINCT FROM p_slot_id THEN RETURN 'skip_other_slot'; END IF;

    -- The credit stays with whoever wrote the group workout, not with whoever
    -- pressed save this time.
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

  DELETE FROM training_session_exercises WHERE session_id = v_session_id;
  INSERT INTO training_session_exercises
    (session_id, exercise_id, order_index, target_sets, target_reps_he, target_load_he,
     notes_he, target_reps, target_weight_kg, target_duration_seconds, target_distance_m)
  SELECT v_session_id, e.exercise_id, e.order_index, e.target_sets, e.target_reps_he,
         e.target_load_he, e.notes_he, e.target_reps, e.target_weight_kg,
         e.target_duration_seconds, e.target_distance_m
    FROM slot_workout_exercises e
    WHERE e.slot_id = p_slot_id
    ORDER BY e.order_index;

  -- v_synced is only set when the SELECT above found a row to refresh.
  RETURN CASE WHEN v_synced IS NULL THEN 'create' ELSE 'refresh' END;
END $$;

REVOKE ALL ON FUNCTION public.apply_slot_workout_to_trainee(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_slot_workout_to_trainee(UUID, UUID) TO authenticated, service_role;

-- The whole roster, as counts per action.
CREATE OR REPLACE FUNCTION public.apply_slot_workout(p_slot_id UUID)
RETURNS TABLE (action TEXT, trainee_count INTEGER)
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT r.action, count(*)::int
    FROM (
      SELECT apply_slot_workout_to_trainee(p_slot_id, t.trainee_id) AS action
        FROM daily_schedule_slot_trainees t
        WHERE t.slot_id = p_slot_id
          AND t.trainee_id IS NOT NULL
          AND t.cancelled_at IS NULL
        ORDER BY t.order_index
    ) r
   GROUP BY r.action;
END $$;

REVOKE ALL ON FUNCTION public.apply_slot_workout(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.apply_slot_workout(UUID) TO authenticated, service_role;

-- Saving the group workout is the fan-out. Separating them would allow a saved
-- workout that reached nobody, which is the whole failure this design avoids.
CREATE OR REPLACE FUNCTION public.save_slot_workout(
  p_slot_id UUID,
  p_notes TEXT,
  p_built_by UUID,
  p_built_by_name TEXT,
  p_exercises JSONB
) RETURNS TABLE (action TEXT, trainee_count INTEGER)
LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  DELETE FROM slot_workout_exercises WHERE slot_id = p_slot_id;

  INSERT INTO slot_workout_exercises
    (slot_id, exercise_id, order_index, target_sets, target_reps_he, target_load_he, notes_he,
     target_reps, target_weight_kg, target_duration_seconds, target_distance_m)
  SELECT
    p_slot_id,
    (elem->>'exercise_id')::uuid,
    (elem->>'order_index')::int,
    NULLIF(elem->>'target_sets', '')::int,
    NULLIF(elem->>'target_reps_he', ''),
    NULLIF(elem->>'target_load_he', ''),
    NULLIF(elem->>'notes_he', ''),
    NULLIF(elem->>'target_reps', '')::int,
    NULLIF(elem->>'target_weight_kg', '')::numeric,
    NULLIF(elem->>'target_duration_seconds', '')::int,
    NULLIF(elem->>'target_distance_m', '')::int
  FROM jsonb_array_elements(p_exercises) AS elem;

  UPDATE daily_schedule_slots
    SET workout_notes_he = p_notes,
        workout_built_by = p_built_by,
        workout_built_by_name = p_built_by_name,
        workout_updated_at = now()
    WHERE id = p_slot_id;

  RETURN QUERY SELECT * FROM apply_slot_workout(p_slot_id);
END $$;

REVOKE ALL ON FUNCTION public.save_slot_workout(UUID, TEXT, UUID, TEXT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_slot_workout(UUID, TEXT, UUID, TEXT, JSONB) TO authenticated, service_role;

-- Removing the group workout removes the copies it wrote, and only those:
-- never a session a trainer edited individually, never one already completed.
CREATE OR REPLACE FUNCTION public.clear_slot_workout(p_slot_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_removed INTEGER;
BEGIN
  DELETE FROM slot_workout_exercises WHERE slot_id = p_slot_id;

  UPDATE daily_schedule_slots
    SET workout_notes_he = NULL,
        workout_built_by = NULL,
        workout_built_by_name = NULL,
        workout_updated_at = NULL
    WHERE id = p_slot_id;

  WITH removed AS (
    DELETE FROM training_sessions ts
      WHERE ts.slot_id = p_slot_id
        AND ts.slot_workout_synced_at IS NOT NULL
        AND ts.completed_at IS NULL
      RETURNING 1
  )
  SELECT count(*)::int INTO v_removed FROM removed;

  RETURN v_removed;
END $$;

REVOKE ALL ON FUNCTION public.clear_slot_workout(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.clear_slot_workout(UUID) TO authenticated, service_role;

-- One trainee leaves the slot, by their own cancellation or by staff removing
-- them, so the workout leaves their app. Same two exemptions as above.
CREATE OR REPLACE FUNCTION public.drop_slot_workout_session(
  p_slot_id UUID,
  p_trainee_id UUID
) RETURNS BOOLEAN
LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM training_sessions ts
    WHERE ts.slot_id = p_slot_id
      AND ts.trainee_id = p_trainee_id
      AND ts.slot_workout_synced_at IS NOT NULL
      AND ts.completed_at IS NULL;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted > 0;
END $$;

REVOKE ALL ON FUNCTION public.drop_slot_workout_session(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.drop_slot_workout_session(UUID, UUID) TO authenticated, service_role;
```

- [ ] **Step 3: Add the book_slot hook to the same migration**

Append to `supabase/migrations/20260922100000_slot_group_workout.sql` a `CREATE OR REPLACE FUNCTION public.book_slot(...)` that is the Step 1 output verbatim, minus its trailing `-- execute: service_role` comment line, with exactly one statement added. The tail of the function changes from this:

```sql
  IF v_id IS NOT NULL THEN
    UPDATE daily_schedule_slot_trainees
      SET cancelled_at = NULL, late_cancel = false, booked_at = now(), source = 'self', reminded_at = NULL
      WHERE id = v_id;
  ELSE
    SELECT COALESCE(max(t.order_index), -1) + 1 INTO v_next
      FROM daily_schedule_slot_trainees t WHERE t.slot_id = p_slot_id;
    INSERT INTO daily_schedule_slot_trainees (slot_id, trainee_id, trainee_name, order_index, source, booked_at)
      VALUES (p_slot_id, p_trainee_id, p_trainee_name, v_next, 'self', now())
      RETURNING id INTO v_id;
  END IF;

  RETURN QUERY SELECT v_id, v_taken + 1, v_max;
END $function$;
```

to this:

```sql
  IF v_id IS NOT NULL THEN
    UPDATE daily_schedule_slot_trainees
      SET cancelled_at = NULL, late_cancel = false, booked_at = now(), source = 'self', reminded_at = NULL
      WHERE id = v_id;
  ELSE
    SELECT COALESCE(max(t.order_index), -1) + 1 INTO v_next
      FROM daily_schedule_slot_trainees t WHERE t.slot_id = p_slot_id;
    INSERT INTO daily_schedule_slot_trainees (slot_id, trainee_id, trainee_name, order_index, source, booked_at)
      VALUES (p_slot_id, p_trainee_id, p_trainee_name, v_next, 'self', now())
      RETURNING id INTO v_id;
  END IF;

  -- A trainee who books after the group workout was written still gets it,
  -- in this transaction. No-ops when the slot has no group workout.
  PERFORM apply_slot_workout_to_trainee(p_slot_id, p_trainee_id);

  RETURN QUERY SELECT v_id, v_taken + 1, v_max;
END $$;
```

Every line above that one statement stays byte for byte what Step 1 printed: the same nine-parameter signature, the same `RETURNS TABLE`, `SECURITY DEFINER`, `SET search_path TO 'public'`, the advisory lock, and all four plan and capacity checks. `$function$` is how `pg_get_functiondef` prints the body quoting; `$$` in a migration is equivalent, so either delimiter is fine as long as the opening and closing match.

Add no GRANT for `book_slot`. Its execute privilege is already `service_role` only, and `CREATE OR REPLACE` keeps it.

- [ ] **Step 4: Push the migration**

Run: `supabase db push`
Expected: the migration applies with no error.

- [ ] **Step 5: Verify the functions exist and are not SECURITY DEFINER**

Run:

```bash
supabase db query --linked "SELECT p.proname, p.prosecdef FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname IN ('save_slot_workout','clear_slot_workout','apply_slot_workout','apply_slot_workout_to_trainee','drop_slot_workout_session','book_slot') ORDER BY p.proname;"
```

Expected: six rows. `prosecdef` is `f` for the five new functions and `t` for `book_slot`.

- [ ] **Step 6: Refresh the generated types and the schema snapshot**

Run: `npm run db:types && npm run db:schema`
Expected: `src/types/database.generated.ts` gains `slot_workout_exercises` and the new columns; `supabase/schema.sql` (gitignored) is rewritten.

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: no output.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20260922100000_slot_group_workout.sql src/types/database.generated.ts
git commit -m "feat(schedule): a slot can hold a group workout that fans out to its roster"
```

---

### Task 3: Types, validation, and the slot workout actions

**Files:**
- Modify: `src/types/schedule.ts`
- Modify: `src/types/training-session.ts`
- Modify: `src/lib/schedule/__tests__/materialization.test.ts`, `src/lib/schedule/__tests__/session-worklist.test.ts`, `src/lib/utils/__tests__/schedule-text.test.ts`, `src/lib/utils/__tests__/schedule-week.test.ts`, `src/lib/utils/__tests__/weekly-schedule.test.ts` (slot fixtures)
- Modify: `src/lib/utils/session-import.ts`
- Create: `src/lib/validations/slot-workout.ts`
- Create: `src/lib/actions/slot-workout.ts`
- Modify: `src/lib/actions/training-sessions-mutate.ts`

**Interfaces:**
- Consumes: the RPCs from Task 2; `FanoutCounts`, `countFanout` is not used here (the DB returns counts directly), `FanoutAction` from Task 1.
- Produces:
  - `SLOT_WORKOUT_SELECT` and `interface SlotWorkoutExercise`, `interface SlotWorkout` in `src/types/schedule.ts`
  - `saveSlotWorkoutSchema`, `type SaveSlotWorkoutInput` in `src/lib/validations/slot-workout.ts`
  - `getSlotWorkoutAction(slotId: string): Promise<{ success: true; data: SlotWorkout } | { error: string }>`
  - `saveSlotWorkoutAction(input: SaveSlotWorkoutInput): Promise<{ success: true; data: { counts: FanoutCounts } } | { error: string; fieldErrors?: Record<string, string[]> }>`
  - `clearSlotWorkoutAction(slotId: string): Promise<{ success: true; data: { removed: number } } | { error: string }>`
  - `slotWorkoutToBuilderRows(workout: SlotWorkout): SessionBuilderRow[]`

- [ ] **Step 1: Extend the slot and session types**

In `src/types/schedule.ts`, extend the calendar's select so a slot carries how many exercises its group workout has. The calendar and the build list both label the workout with that number, and a second round trip per slot to get it would be one query per card:

```ts
export const SLOT_SELECT_WITH_TRAINEES =
  "*, trainees:daily_schedule_slot_trainees(id, slot_id, trainee_id, trainee_name, order_index, source, booked_at, cancelled_at, late_cancel, reminded_at), workout_exercises:slot_workout_exercises(id)";
```

Add these five fields to `ScheduleSlot`, after `max_trainees`:

```ts
  /** The group workout's notes; null when the slot has none. */
  workout_notes_he: string | null;
  /** Who wrote the group workout. Credits the sessions it fans out. */
  workout_built_by: string | null;
  workout_built_by_name: string | null;
  /** Null means this slot has no group workout. */
  workout_updated_at: string | null;
  /** Ids only, for the count. Absent on selects that do not embed them. */
  workout_exercises?: { id: string }[];
```

Append to the same file:

```ts
/**
 * PostgREST select for a slot's group workout, with the library row and the
 * machine profile each exercise needs to render its own target inputs. Same
 * embed as TEMPLATE_SELECT_WITH_EXERCISES, for the same reason: without it the
 * editor would show a free-text load field and the saved numeric targets would
 * have nowhere to go.
 */
export const SLOT_WORKOUT_SELECT =
  `*, exercises:slot_workout_exercises(id, slot_id, exercise_id, order_index, target_sets, target_reps_he, target_load_he, target_reps, target_weight_kg, target_duration_seconds, target_distance_m, notes_he, exercise:workout_exercises(id, name_he, name_en, main_category, sub_category, equipment, equipment_id, cues_he, equipment_ref:equipment(${EQUIPMENT_PROFILE_COLUMNS})))`;

export interface SlotWorkoutExercise {
  id: string;
  slot_id: string;
  exercise_id: string;
  order_index: number;
  target_sets: number | null;
  target_reps_he: string | null;
  target_load_he: string | null;
  target_reps: number | null;
  target_weight_kg: number | null;
  target_duration_seconds: number | null;
  target_distance_m: number | null;
  notes_he: string | null;
  exercise?: {
    id: string;
    name_he: string | null;
    name_en: string | null;
    main_category: string;
    sub_category: string | null;
    equipment: string | null;
    equipment_id?: string | null;
    cues_he?: string | null;
    equipment_ref?: EquipmentProfile | null;
  } | null;
}

/** One slot with its group workout, as the editor screen reads it. */
export interface SlotWorkout {
  slot: ScheduleSlot;
  exercises: SlotWorkoutExercise[];
  /** Active, linked roster members: how many would receive a save. */
  rosterCount: number;
}
```

Add at the top of `src/types/schedule.ts`:

```ts
import {
  EQUIPMENT_PROFILE_COLUMNS,
  type EquipmentProfile,
} from "@/types/equipment";
```

In `src/types/training-session.ts`, add to `TrainingSession` after `completed_at`:

```ts
  /** Not null while this session is the slot's group workout, untouched. */
  slot_workout_synced_at: string | null;
```

and to `SessionSummary`:

```ts
  /** A trainer edited this session individually, so group saves skip it. */
  isCustom: boolean;
```

- [ ] **Step 2: Run the tests to see the fixtures break**

Run: `npx tsc --noEmit`
Expected: FAIL. Errors in the five test files listed under **Files**, of the form "Type ... is missing the following properties from type 'ScheduleSlot': workout_notes_he, workout_built_by, workout_built_by_name, workout_updated_at".

- [ ] **Step 3: Fix the slot fixtures**

In each of the five test files, find the object literal that builds a whole `ScheduleSlot` (search for `max_trainees:`) and add these four lines beside it:

```ts
    workout_notes_he: null,
    workout_built_by: null,
    workout_built_by_name: null,
    workout_updated_at: null,
```

Run: `npm run test:run`
Expected: PASS except the 20 pre-existing localStorage failures in the goals and streak-tracking suites, which fail on `main` too and are not a regression.

- [ ] **Step 4: Add the builder-row converter**

In `src/lib/utils/session-import.ts`, add the import `import type { SlotWorkout } from "@/types/schedule";` and append:

```ts
/**
 * A slot's group workout as builder rows. Same full restore as
 * templateToBuilderRows: every numeric target and the machine profile, so the
 * editor reopens showing the inputs the trainer filled in.
 */
export function slotWorkoutToBuilderRows(workout: SlotWorkout): SessionBuilderRow[] {
  return workout.exercises.map((exercise, index) =>
    makeBuilderRow({
      key: `slot-${exercise.exercise_id}-${index}`,
      exerciseId: exercise.exercise_id,
      exerciseName:
        exercise.exercise?.name_he ?? exercise.exercise?.name_en ?? "תרגיל",
      targetSets: exercise.target_sets,
      targetReps: exercise.target_reps_he ?? "",
      targetLoad: exercise.target_load_he ?? "",
      targetRepsNum: numText(exercise.target_reps),
      targetWeightKg: numText(exercise.target_weight_kg),
      targetDurationSeconds: numText(exercise.target_duration_seconds),
      targetDistanceM: numText(exercise.target_distance_m),
      notes: exercise.notes_he ?? "",
      equipment: exercise.exercise?.equipment_ref ?? null,
      seededFromEquipment: false,
    }),
  );
}
```

- [ ] **Step 5: Add the validation schema**

Create `src/lib/validations/slot-workout.ts`:

```ts
import { z } from "zod";

import {
  MAX_EXERCISES_PER_SESSION,
  MAX_TEXT_LENGTH,
  optionalText,
  sessionExerciseSchema,
  uuidSchema,
} from "@/lib/validations/training-session";

/**
 * A slot's group workout.
 *
 * Deliberately without the `.min(1)` that upsertSessionSchema carries: an
 * empty list here is not a mistake but the request to remove the group
 * workout, and the action routes it to clear_slot_workout.
 */
export const saveSlotWorkoutSchema = z.object({
  slotId: uuidSchema,
  notes: optionalText(MAX_TEXT_LENGTH),
  exercises: z
    .array(sessionExerciseSchema)
    .max(MAX_EXERCISES_PER_SESSION, "יותר מדי תרגילים באימון"),
});

export type SaveSlotWorkoutInput = z.input<typeof saveSlotWorkoutSchema>;
```

- [ ] **Step 6: Write the actions**

Create `src/lib/actions/slot-workout.ts`:

```ts
"use server";

import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { assertBranchReadable } from "@/lib/actions/shared/assert-branch";
import { revalidateScheduleSurfaces } from "@/lib/actions/shared/revalidate-schedule";
import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import type { FanoutCounts } from "@/lib/schedule/slot-workout-fanout";
import { isValidUUID } from "@/lib/validations/common";
import {
  saveSlotWorkoutSchema,
  type SaveSlotWorkoutInput,
} from "@/lib/validations/slot-workout";
import {
  SLOT_WORKOUT_SELECT,
  type ScheduleSlot,
  type SlotWorkout,
  type SlotWorkoutExercise,
} from "@/types/schedule";

/**
 * The group workout of one slot: everyone booked into that hour does the same
 * thing, and saving it writes a personal session for each of them.
 *
 * Every write is one RPC, so the exercise list, the slot stamp and the fan-out
 * land together or not at all. The RPCs are not SECURITY DEFINER: staff
 * already hold a FOR ALL policy on training_sessions, and that stays the gate.
 */

type WorkoutResult = { success: true; data: SlotWorkout } | { error: string };

type SaveResult =
  | { success: true; data: { counts: FanoutCounts } }
  | { error: string; fieldErrors?: Record<string, string[]> };

type ClearResult = { success: true; data: { removed: number } } | { error: string };

/** Minimal typed shape for RPCs missing from the generated Supabase types. */
type RpcClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

type SlotRow = ScheduleSlot & {
  exercises: SlotWorkoutExercise[] | null;
  trainees: { trainee_id: string | null; cancelled_at: string | null }[] | null;
};

function toCounts(data: unknown): FanoutCounts {
  const rows = (data ?? []) as { action: string; trainee_count: number }[];
  return rows.reduce<FanoutCounts>(
    (counts, row) => ({ ...counts, [row.action]: row.trainee_count }),
    {},
  );
}

/**
 * Loads the slot with its group workout and how many roster members a save
 * would reach. The roster is read through the same select rather than counted
 * separately, so the number on screen and the number the fan-out acts on come
 * from one read.
 */
export async function getSlotWorkoutAction(slotId: string): Promise<WorkoutResult> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  if (!isValidUUID(slotId)) return { error: "מזהה סלוט לא תקין" };

  const supabase = await createClient();
  const { data, error } = await typedFrom(supabase, "daily_schedule_slots")
    .select(
      `${SLOT_WORKOUT_SELECT}, trainees:daily_schedule_slot_trainees(trainee_id, cancelled_at)`,
    )
    .eq("id", slotId)
    .maybeSingle();

  if (error) {
    console.error("Get slot workout error:", error);
    return { error: "שגיאה בטעינת האימון הקבוצתי" };
  }

  const row = data as SlotRow | null;
  if (!row) return { error: "הסלוט לא נמצא" };

  if (row.branch_id) {
    const scopeCheck = await assertBranchReadable(row.branch_id);
    if (scopeCheck.error) return { error: scopeCheck.error };
  }

  const rosterCount = (row.trainees ?? []).filter(
    (entry) => entry.trainee_id !== null && entry.cancelled_at === null,
  ).length;

  return {
    success: true,
    data: {
      slot: row,
      exercises: [...(row.exercises ?? [])].sort(
        (a, b) => a.order_index - b.order_index,
      ),
      rosterCount,
    },
  };
}

/**
 * Saves the group workout and fans it out in one transaction.
 *
 * An empty exercise list means "remove the group workout", which is why the
 * schema allows it and this is where the two paths part. Keeping the two in
 * one action keeps the screen's single save button honest.
 */
export async function saveSlotWorkoutAction(
  input: SaveSlotWorkoutInput,
): Promise<SaveResult> {
  const { error: authError, user, profile } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  const validated = saveSlotWorkoutSchema.safeParse(input);
  if (!validated.success) {
    return {
      error: "אימות נתונים נכשל",
      fieldErrors: validated.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  const { slotId, notes, exercises } = validated.data;

  const slotResult = await getSlotWorkoutAction(slotId);
  if ("error" in slotResult) return { error: slotResult.error };

  const supabase = await createClient();
  const rpcClient = supabase as unknown as RpcClient;

  if (exercises.length === 0) {
    const cleared = await clearSlotWorkoutAction(slotId);
    if ("error" in cleared) return { error: cleared.error };
    return { success: true, data: { counts: {} } };
  }

  const { data, error } = await rpcClient.rpc("save_slot_workout", {
    p_slot_id: slotId,
    p_notes: notes,
    p_built_by: user!.id,
    p_built_by_name: profile!.full_name ?? "מאמן",
    p_exercises: exercises.map((exercise, index) => ({
      exercise_id: exercise.exerciseId,
      order_index: index,
      target_sets: exercise.targetSets,
      target_reps_he: exercise.targetReps,
      target_load_he: exercise.targetLoad,
      target_reps: exercise.targetRepsNum,
      target_weight_kg: exercise.targetWeightKg,
      target_duration_seconds: exercise.targetDurationSeconds,
      target_distance_m: exercise.targetDistanceM,
      notes_he: exercise.notes,
    })),
  });

  if (error) {
    console.error("save_slot_workout failed:", error);
    return { error: "שגיאה בשמירת האימון הקבוצתי" };
  }

  revalidateScheduleSurfaces();
  return { success: true, data: { counts: toCounts(data) } };
}

/** Removes the group workout and the sessions it wrote. */
export async function clearSlotWorkoutAction(slotId: string): Promise<ClearResult> {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  if (!isValidUUID(slotId)) return { error: "מזהה סלוט לא תקין" };

  const slotResult = await getSlotWorkoutAction(slotId);
  if ("error" in slotResult) return { error: slotResult.error };

  const supabase = await createClient();
  const rpcClient = supabase as unknown as RpcClient;

  const { data, error } = await rpcClient.rpc("clear_slot_workout", {
    p_slot_id: slotId,
  });

  if (error) {
    console.error("clear_slot_workout failed:", error);
    return { error: "שגיאה במחיקת האימון הקבוצתי" };
  }

  revalidateScheduleSurfaces();
  return { success: true, data: { removed: typeof data === "number" ? data : 0 } };
}
```

- [ ] **Step 7: Make an individual save mark the session as custom**

In `src/lib/actions/training-sessions-mutate.ts`, in `upsertSessionAction`, find the metadata update near the end (`.update({ slot_id: slotId, built_by: user!.id, ... })`) and add one field:

```ts
      .update({
        slot_id: slotId,
        built_by: user!.id,
        built_by_name: builderName,
        notes_he: notes,
        // A trainer editing one trainee takes them out of the group: later
        // group saves must not overwrite this.
        slot_workout_synced_at: null,
      })
```

The insert path needs nothing: the column defaults to NULL, which already means individual.

Also add `slot_workout_synced_at` to the select in `getSessionSummariesAction` in `src/lib/actions/training-sessions-list.ts`:

```ts
    .select("id, trainee_id, completed_at, slot_workout_synced_at, exercises:training_session_exercises(id)")
```

and to the row type and the mapped summary in that function:

```ts
  const rows = (data ?? []) as {
    id: string;
    trainee_id: string;
    completed_at: string | null;
    slot_workout_synced_at: string | null;
    exercises: { id: string }[];
  }[];
```

```ts
      {
        id: row.id,
        trainee_id: row.trainee_id,
        exerciseCount: row.exercises?.length ?? 0,
        completed_at: row.completed_at,
        isCustom: row.slot_workout_synced_at === null,
      },
```

- [ ] **Step 8: Type-check and test**

Run: `npx tsc --noEmit && npm run lint && npm run test:run`
Expected: no type errors, no new lint errors, and no new test failures beyond the 20 pre-existing localStorage ones.

- [ ] **Step 9: Commit**

```bash
git add src/types/schedule.ts src/types/training-session.ts src/lib/validations/slot-workout.ts src/lib/actions/slot-workout.ts src/lib/actions/training-sessions-mutate.ts src/lib/actions/training-sessions-list.ts src/lib/utils/session-import.ts src/lib/schedule/__tests__ src/lib/utils/__tests__
git commit -m "feat(schedule): actions to read, save and clear a slot's group workout"
```

---

### Task 4: Roster and booking hooks

Three moments where the roster changes under a group workout that already exists. Without these the feature is correct only at the instant it is saved.

**Files:**
- Modify: `src/lib/actions/daily-schedule-roster.ts`
- Modify: `src/features/booking/lib/actions/book.ts`

**Interfaces:**
- Consumes: `apply_slot_workout_to_trainee`, `drop_slot_workout_session` from Task 2.
- Produces: no new exports. Behaviour only.

Note: the booking action already runs on the admin client (`createAdminClient()`), which is how a trainee writes roster rows at all; the RPC call goes on that same client. `book_slot` already covers the booking case from inside the database, so `book.ts` only needs the cancel side.

- [ ] **Step 1: Give a staff-added trainee the group workout**

In `src/lib/actions/daily-schedule-roster.ts`, inside `addSlotTraineeAction`, after the `if ((written?.length ?? 0) === 0)` guard and before `revalidateScheduleSurfaces()`:

```ts
  // Staff adding someone to a slot that already has a group workout is the
  // same event as a trainee booking into it, so it has the same consequence.
  // A slot with no group workout returns skip_no_workout and changes nothing.
  if (traineeId) {
    const { error: applyError } = await (
      supabase as unknown as {
        rpc: (fn: string, args: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
      }
    ).rpc("apply_slot_workout_to_trainee", {
      p_slot_id: slotId,
      p_trainee_id: traineeId,
    });
    // The trainee is on the roster either way; a failed copy is logged and
    // fixed by re-saving the group workout, not by refusing the add.
    if (applyError) console.error("apply_slot_workout_to_trainee failed:", applyError);
  }
```

- [ ] **Step 2: Take the workout back when staff remove a trainee**

In the same file, inside `removeSlotTraineeAction`, after the removal succeeds and before its `revalidateScheduleSurfaces()`:

```ts
  // The workout leaves with them. drop_slot_workout_session refuses to touch
  // an individually edited or completed session, so this can only take back
  // what the group gave.
  if (row.trainee_id) {
    const { error: dropError } = await (
      supabase as unknown as {
        rpc: (fn: string, args: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
      }
    ).rpc("drop_slot_workout_session", {
      p_slot_id: row.slot_id,
      p_trainee_id: row.trainee_id,
    });
    if (dropError) console.error("drop_slot_workout_session failed:", dropError);
  }
```

- [ ] **Step 3: Take the workout back when a trainee cancels**

In `src/features/booking/lib/actions/book.ts`, inside `cancelBookingAction`, after the `if (error || !data?.length) return { error: "הביטול נכשל. נסו שוב." };` guard and before `revalidate()`:

```ts
  // The cancelled trainee stops seeing the slot's workout. A late cancel still
  // counts as a used session; that is the roster row's business, not this one.
  const { error: dropError } = await (
    db as unknown as {
      rpc: (fn: string, args: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
    }
  ).rpc("drop_slot_workout_session", {
    p_slot_id: slotId,
    p_trainee_id: user.id,
  });
  if (dropError) console.error("drop_slot_workout_session failed:", dropError);
```

- [ ] **Step 4: Type-check and lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: no output from tsc, no new lint errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/daily-schedule-roster.ts src/features/booking/lib/actions/book.ts
git commit -m "feat(schedule): the group workout follows the roster in and out"
```

---

### Task 5: The group workout screen

Modelled directly on `SessionTemplateEditor`, which already pairs `SessionRowsEditor` with `ExercisePicker` and owns the save. Nothing about a row is re-implemented: a group row, a session row and a template row must stay literally the same control.

**Files:**
- Create: `src/app/admin/schedule/slot/[slotId]/page.tsx`
- Create: `src/components/admin/schedule/SlotWorkoutEditor.tsx`

**Interfaces:**
- Consumes: `getSlotWorkoutAction`, `saveSlotWorkoutAction`, `clearSlotWorkoutAction`, `slotWorkoutToBuilderRows`, `describeFanout`.
- Produces: the route `/admin/schedule/slot/<slotId>?branch=<branchId>`, which Task 6 links to.

- [ ] **Step 1: Write the page**

Create `src/app/admin/schedule/slot/[slotId]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";

import { SlotWorkoutEditor } from "@/components/admin/schedule/SlotWorkoutEditor";
import { getSlotWorkoutAction } from "@/lib/actions/slot-workout";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { isValidUUID } from "@/lib/validations/common";

export const metadata: Metadata = {
  title: "אימון קבוצתי | Garden of Eden",
};

interface PageProps {
  params: Promise<{ slotId: string }>;
  searchParams: Promise<{ branch?: string }>;
}

export default async function SlotWorkoutPage({ params, searchParams }: PageProps) {
  const { error: authError } = await verifyAdminOrTrainer();
  if (authError) redirect("/dashboard");

  const { slotId } = await params;
  if (!isValidUUID(slotId)) notFound();

  const query = await searchParams;
  const branchId = query.branch && isValidUUID(query.branch) ? query.branch : null;

  const result = await getSlotWorkoutAction(slotId);
  if ("error" in result) {
    return <p className="py-12 text-center text-destructive">{result.error}</p>;
  }

  return (
    <SlotWorkoutEditor
      // The editor seeds its rows on mount, so a navigation between two slots
      // must not carry the first slot's exercises into the second.
      key={slotId}
      workout={result.data}
      branchId={branchId}
    />
  );
}
```

- [ ] **Step 2: Write the editor**

Create `src/components/admin/schedule/SlotWorkoutEditor.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Plus, Users } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SessionRowsEditor } from "@/components/admin/schedule/SessionRowsEditor";
import { ExercisePicker } from "@/features/workouts/components/ExercisePicker";
import type { WorkoutExercise } from "@/features/workouts/lib/types";
import {
  clearSlotWorkoutAction,
  saveSlotWorkoutAction,
} from "@/lib/actions/slot-workout";
import { describeFanout } from "@/lib/schedule/slot-workout-fanout";
import {
  exerciseToBuilderRow,
  rowsToExerciseInput,
  slotWorkoutToBuilderRows,
} from "@/lib/utils/session-import";
import { formatDate } from "@/lib/utils/date";
import { MAX_EXERCISES_PER_SESSION } from "@/lib/validations/training-session";
import type { SlotWorkout } from "@/types/schedule";
import type { SessionBuilderRow } from "@/types/training-session";

interface SlotWorkoutEditorProps {
  workout: SlotWorkout;
  branchId: string | null;
}

/**
 * The workout everyone booked into one hour does.
 *
 * Saving is also the fan-out, so there is one button and no "apply" step: a
 * saved group workout that reached nobody is the state this whole feature
 * exists to avoid. Clearing the list removes the workout and takes back the
 * sessions it wrote, which is why the empty list asks for confirmation instead
 * of refusing the way the individual builder does.
 */
export function SlotWorkoutEditor({ workout, branchId }: SlotWorkoutEditorProps) {
  const router = useRouter();
  const { slot, rosterCount } = workout;
  const [notes, setNotes] = useState(slot.workout_notes_he ?? "");
  const [rows, setRows] = useState<SessionBuilderRow[]>(() =>
    slotWorkoutToBuilderRows(workout),
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [clearOpen, setClearOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const time = slot.start_time.slice(0, 5);
  const backHref = `/admin/calendar?date=${slot.schedule_date}${branchId ? `&branch=${branchId}` : ""}`;
  const hadWorkout = slot.workout_updated_at !== null;

  /**
   * Reads `rows` from the render rather than a setRows updater: it toasts, and
   * React may call an updater more than once. The picker confirm is a user
   * event, so `rows` is current. Same idiom as SessionTemplateEditor.
   */
  const addExercises = (exercises: WorkoutExercise[]) => {
    const room = MAX_EXERCISES_PER_SESSION - rows.length;
    const incoming = exercises.map((exercise, index) =>
      exerciseToBuilderRow(
        exercise,
        `new-${exercise.id}-${rows.length + index}-${Date.now()}`,
      ),
    );
    if (incoming.length > room) {
      toast.error(
        `אפשר עד ${MAX_EXERCISES_PER_SESSION} תרגילים באימון — ${incoming.length - Math.max(room, 0)} לא נוספו`,
      );
    }
    if (room <= 0) return;
    setRows([...rows, ...incoming.slice(0, room)]);
  };

  const handleSave = async () => {
    if (rows.length === 0) {
      setClearOpen(true);
      return;
    }
    setSaving(true);
    try {
      const result = await saveSlotWorkoutAction({
        slotId: slot.id,
        notes,
        exercises: rowsToExerciseInput(rows),
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(describeFanout(result.data.counts));
      router.push(backHref);
      router.refresh();
    } catch {
      toast.error("שגיאה בשמירת האימון הקבוצתי");
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setSaving(true);
    try {
      const result = await clearSlotWorkoutAction(slot.id);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      toast.success(
        result.data.removed === 0
          ? "האימון הקבוצתי נמחק"
          : `האימון הקבוצתי נמחק והוסר מ-${result.data.removed} מתאמנים`,
      );
      setClearOpen(false);
      router.push(backHref);
      router.refresh();
    } catch {
      toast.error("שגיאה במחיקת האימון הקבוצתי");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl text-forest">אימון קבוצתי</h1>
          <p className="text-sm text-muted-foreground">
            {formatDate(slot.schedule_date)} בשעה {time}
            {slot.trainer_name ? ` · ${slot.trainer_name}` : ""}
          </p>
        </div>
        <Button variant="ghost" asChild>
          <Link href={backHref}>
            <ArrowRight className="me-2 h-4 w-4" />
            חזרה ליומן
          </Link>
        </Button>
      </div>

      <p className="flex items-center gap-2 rounded-xl border bg-muted/40 px-4 py-3 text-sm">
        <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
        {rosterCount === 0
          ? "אין רשומים לסלוט. האימון יישמר ויינתן לכל מי שיירשם."
          : rosterCount === 1
            ? "השמירה תשלח את האימון למתאמן אחד הרשום לסלוט."
            : `השמירה תשלח את האימון ל-${rosterCount} הרשומים לסלוט.`}
      </p>

      <div className="space-y-2">
        <Label htmlFor="slot-workout-notes">הערות לאימון (לא חובה)</Label>
        <Input
          id="slot-workout-notes"
          value={notes}
          maxLength={300}
          onChange={(event) => setNotes(event.target.value)}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => setPickerOpen(true)}>
          <Plus className="me-2 h-4 w-4" />
          הוספת תרגילים
        </Button>
      </div>

      <SessionRowsEditor
        rows={rows}
        onRowsChange={setRows}
        emptyMessage="אין תרגילים באימון הקבוצתי — הוסף מהמאגר."
      />

      <div className="flex justify-end">
        <Button
          className="rounded-xl bg-forest font-bold hover:bg-forest-light md:px-8"
          onClick={handleSave}
          disabled={saving || (rows.length === 0 && !hadWorkout)}
        >
          {saving && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
          {rows.length === 0 ? "מחיקת האימון הקבוצתי" : "שמירה ושליחה לקבוצה"}
        </Button>
      </div>

      <ExercisePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onAdd={addExercises}
        alreadyAddedIds={rows.map((row) => row.exerciseId)}
      />

      <AlertDialog open={clearOpen} onOpenChange={setClearOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>מחיקת האימון הקבוצתי</AlertDialogTitle>
            <AlertDialogDescription>
              האימון של {time} יימחק, ויוסר מהמתאמנים שקיבלו אותו. אימון שמאמן
              ערך למתאמן בודד, ואימון שכבר הושלם, יישארו.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>ביטול</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                handleClear();
              }}
              disabled={saving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {saving ? "מוחק..." : "מחיקה"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
```

- [ ] **Step 3: Type-check, lint, and build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: all three clean.

- [ ] **Step 4: Commit**

```bash
git add "src/app/admin/schedule/slot/[slotId]/page.tsx" src/components/admin/schedule/SlotWorkoutEditor.tsx
git commit -m "feat(schedule): a screen for the workout a whole slot does"
```

---

### Task 6: Entry points

The screen exists but nothing reaches it. This is the part that answers the original report: Eden opened a slot and saw only names.

**Files:**
- Modify: `src/lib/schedule/session-worklist.ts`
- Modify: `src/lib/schedule/__tests__/session-worklist.test.ts`
- Modify: `src/components/admin/calendar/RosterSheet.tsx`
- Modify: `src/components/admin/schedule/SessionWorklist.tsx`

**Interfaces:**
- Consumes: the route from Task 5, `SessionSummary.isCustom` from Task 3.
- Produces: `WorklistGroup.hasGroupWorkout: boolean`, `WorklistGroup.groupExerciseCount: number`, and `WorklistRow.isCustom: boolean`.

- [ ] **Step 1: Write the failing test**

In `src/lib/schedule/__tests__/session-worklist.test.ts`, add inside the `buildSessionWorklist` describe block:

```ts
  test("marks a group whose slot carries a workout", () => {
    const groups = buildSessionWorklist(
      [slot({ workout_updated_at: "2026-09-22T09:00:00.000Z" })],
      {},
    );
    expect(groups[0].hasGroupWorkout).toBe(true);
  });

  test("carries how many exercises the group workout has", () => {
    const groups = buildSessionWorklist(
      [slot({ workout_updated_at: "2026-09-22T09:00:00.000Z", workout_exercises: [{ id: "e1" }, { id: "e2" }] })],
      {},
    );
    expect(groups[0].groupExerciseCount).toBe(2);
  });

  test("counts zero when the slot embeds no exercises", () => {
    expect(buildSessionWorklist([slot()], {})[0].groupExerciseCount).toBe(0);
  });

  test("a slot with no group workout says so", () => {
    expect(buildSessionWorklist([slot()], {})[0].hasGroupWorkout).toBe(false);
  });

  test("marks a row whose session was edited individually", () => {
    const entry1 = entry({ trainee_id: NOAM });
    const groups = buildSessionWorklist([slot({ trainees: [entry1] })], {
      [NOAM]: {
        id: "session-1",
        trainee_id: NOAM,
        exerciseCount: 3,
        completed_at: null,
        isCustom: true,
      },
    });
    expect(groups[0].rows[0].isCustom).toBe(true);
  });

  test("a trainee with nothing built is not custom", () => {
    const groups = buildSessionWorklist([slot({ trainees: [entry({ trainee_id: NOAM })] })], {});
    expect(groups[0].rows[0].isCustom).toBe(false);
  });
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm run test:run -- src/lib/schedule/__tests__/session-worklist.test.ts`
Expected: FAIL, "Property 'hasGroupWorkout' does not exist on type 'WorklistGroup'".

- [ ] **Step 3: Extend the worklist builder**

In `src/lib/schedule/session-worklist.ts`, add to `WorklistRow`:

```ts
  /** A trainer built this one individually, so group saves skip it. */
  isCustom: boolean;
```

add to `WorklistGroup`:

```ts
  /** The slot carries a workout for everyone on it. */
  hasGroupWorkout: boolean;
  /** How many exercises that workout has; zero when there is none. */
  groupExerciseCount: number;
```

in `buildSessionWorklist`, add both beside `locationHe`:

```ts
    hasGroupWorkout: slot.workout_updated_at !== null,
    groupExerciseCount: slot.workout_exercises?.length ?? 0,
```

and add to the mapped row:

```ts
          isCustom: summary ? summary.isCustom : false,
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `npm run test:run -- src/lib/schedule/__tests__/session-worklist.test.ts`
Expected: PASS.

- [ ] **Step 5: Add the row to the roster sheet**

In `src/components/admin/calendar/RosterSheet.tsx`, add `Dumbbell` to the `lucide-react` import and `import Link from "next/link";` at the top. Then, inside the scrolling body, immediately before the `{active.length === 0 ? (` block, insert:

```tsx
            <Link
              href={`/admin/schedule/slot/${slot.id}?branch=${branchId}`}
              className="flex min-h-12 items-center justify-between gap-3 rounded-xl border px-3 py-2 text-sm transition-colors hover:bg-muted/60 focus-visible:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex items-center gap-2 font-medium">
                <Dumbbell className="h-4 w-4 shrink-0 text-muted-foreground" />
                אימון קבוצתי
              </span>
              <span className="text-xs text-muted-foreground">
                {slot.workout_updated_at === null
                  ? "טרם נבנה"
                  : `${slot.workout_exercises?.length ?? 0} תרגילים · ${slot.workout_built_by_name ?? "הצוות"}`}
              </span>
            </Link>
```

- [ ] **Step 6: Add the row and the marker to the session-building list**

In `src/components/admin/schedule/SessionWorklist.tsx`, add `Dumbbell` to the `lucide-react` import. Immediately after the group's `</header>`, insert:

```tsx
                    <Link
                      href={`/admin/schedule/slot/${group.slotId}?branch=${branchId}`}
                      className="flex min-h-12 items-center justify-between gap-3 border-b px-4 py-2 text-sm transition-colors hover:bg-muted/60 focus-visible:bg-muted focus-visible:outline-none"
                    >
                      <span className="flex items-center gap-2 font-medium">
                        <Dumbbell className="h-4 w-4 shrink-0 text-muted-foreground" />
                        אימון קבוצתי
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {group.hasGroupWorkout
                          ? `${group.groupExerciseCount} תרגילים`
                          : "טרם נבנה"}
                      </span>
                    </Link>
```

and inside the row, immediately after `<span className="truncate font-medium">{row.traineeName}</span>`, insert the marker that explains a skip:

```tsx
                              {row.isCustom && group.hasGroupWorkout && (
                                <span
                                  className="shrink-0 rounded-full border px-1.5 py-0.5 text-[10px] text-muted-foreground"
                                  title="אימון אישי, עדכון קבוצתי לא ידרוס אותו"
                                >
                                  אישי
                                </span>
                              )}
```

- [ ] **Step 7: Type-check, lint, test, and build**

Run: `npx tsc --noEmit && npm run lint && npm run test:run && npm run build`
Expected: all clean apart from the 20 pre-existing localStorage failures.

- [ ] **Step 8: Verify in the browser**

Run `npm run dev`, then as an admin:

1. Open `/admin/calendar`, pick a קריית אתא date with a slot that has trainees, and open the slot. The sheet shows "אימון קבוצתי · טרם נבנה", and after a save it shows the exercise count.
2. Follow it, add two exercises, save. The toast names how many trainees received it.
3. Reopen the slot and check a trainee's own row expands to those exercises.
4. Open one trainee from the slot in the individual builder, change an exercise, save. Back in `/admin/schedule` that row now carries the "אישי" marker.
5. Save the group workout again with a third exercise. The toast reports one skip with the reason, and the edited trainee keeps their own list.
6. Empty the group list and save. The confirmation names what is removed; the edited trainee keeps their session.

- [ ] **Step 9: Commit**

```bash
git add src/lib/schedule/session-worklist.ts src/lib/schedule/__tests__/session-worklist.test.ts src/components/admin/calendar/RosterSheet.tsx src/components/admin/schedule/SessionWorklist.tsx
git commit -m "feat(schedule): reach the group workout from the calendar and the build list"
```
