# Many Trainers Per Slot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A training hour can carry any number of trainers instead of exactly one.

**Architecture:** Two junction tables, `daily_schedule_slot_trainers` and `weekly_schedule_band_trainers`, replace the single `trainer_id`/`trainer_name` columns on slots and bands. There is no primary trainer: first is a position (`order_index`), and it is what gives a card its colour. Expand and contract — migration A adds the tables and backfills while leaving the old columns in place, the code ships, then migration B re-backfills and drops them.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Supabase Postgres with RLS, Tailwind 4, Radix, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-22-many-trainers-per-slot-design.md`

## Global Constraints

- All user-facing text is Hebrew; the app is RTL; logical CSS properties only.
- No emojis in code, comments, or docs. Immutability throughout. Path alias `@/` maps to `src/`.
- Staff actions call `verifyAdminOrTrainer()`; band writes call `verifyAdmin()`, as they do today. Ids are checked with `isValidUUID()`.
- Action result shape: `{ success: true, data }` or `{ error: "הודעה בעברית" }`.
- No mock-based tests. Only pure functions get unit tests.
- **There is no staging database. `supabase db push` writes to production.** Migration A is additive and safe to push early; migration B drops columns and runs only after the code is deployed.
- Baseline: 20 `localStorage` tests in goals and streak-tracking fail on `main`. Not a regression signal.
- Data at the time of writing: 34 bands, all with a trainer; 267 slots, 9 without one.

---

### Task 1: Migration A, additive only

**Files:**
- Create: `supabase/migrations/20260922180000_slot_trainers_expand.sql`
- Regenerate: `src/types/database.generated.ts`, `supabase/schema.sql`

**Interfaces:**
- Consumes: nothing.
- Produces: tables `daily_schedule_slot_trainers` and `weekly_schedule_band_trainers`, both backfilled.

- [ ] **Step 1: Write the migration**

Create `supabase/migrations/20260922180000_slot_trainers_expand.sql`:

```sql
-- Many trainers on one training hour, step 1 of 2 (spec 2026-09-22).
--
-- Additive on purpose. The old trainer_id / trainer_name columns stay exactly
-- where they are, so the code running in production right now keeps reading
-- them and never notices this ran. Migration B drops them, after the new code
-- is deployed. Splitting it this way is what keeps the window shut: there is
-- never a moment when the schema and the running code disagree.

CREATE TABLE IF NOT EXISTS public.daily_schedule_slot_trainers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id UUID NOT NULL REFERENCES public.daily_schedule_slots(id) ON DELETE CASCADE,
  -- Nullable with SET NULL, not NOT NULL with CASCADE. trainer_name is a
  -- snapshot kept on purpose so the board stays readable after a trainer is
  -- renamed or deleted; CASCADE would take the row and the name with it.
  trainer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  trainer_name TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT slot_trainers_name_length CHECK (char_length(trainer_name) <= 100)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_slot_trainers_unique
  ON public.daily_schedule_slot_trainers (slot_id, trainer_id) WHERE trainer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_slot_trainers_slot
  ON public.daily_schedule_slot_trainers (slot_id, order_index);
CREATE INDEX IF NOT EXISTS idx_slot_trainers_trainer
  ON public.daily_schedule_slot_trainers (trainer_id) WHERE trainer_id IS NOT NULL;

ALTER TABLE public.daily_schedule_slot_trainers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "slot_trainers_staff_select" ON public.daily_schedule_slot_trainers;
CREATE POLICY "slot_trainers_staff_select" ON public.daily_schedule_slot_trainers
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role IN ('admin','trainer') AND p.deleted_at IS NULL));

DROP POLICY IF EXISTS "slot_trainers_staff_write" ON public.daily_schedule_slot_trainers;
CREATE POLICY "slot_trainers_staff_write" ON public.daily_schedule_slot_trainers
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role IN ('admin','trainer')
      AND p.is_active = true AND p.deleted_at IS NULL))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role IN ('admin','trainer')
      AND p.is_active = true AND p.deleted_at IS NULL));

CREATE TABLE IF NOT EXISTS public.weekly_schedule_band_trainers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  band_id UUID NOT NULL REFERENCES public.weekly_schedule_bands(id) ON DELETE CASCADE,
  trainer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  trainer_name TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT band_trainers_name_length CHECK (char_length(trainer_name) <= 100)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_band_trainers_unique
  ON public.weekly_schedule_band_trainers (band_id, trainer_id) WHERE trainer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_band_trainers_band
  ON public.weekly_schedule_band_trainers (band_id, order_index);
CREATE INDEX IF NOT EXISTS idx_band_trainers_trainer
  ON public.weekly_schedule_band_trainers (trainer_id) WHERE trainer_id IS NOT NULL;

ALTER TABLE public.weekly_schedule_band_trainers ENABLE ROW LEVEL SECURITY;

-- A band is an admin decision today and stays one: staff read, admins write.
DROP POLICY IF EXISTS "band_trainers_staff_select" ON public.weekly_schedule_band_trainers;
CREATE POLICY "band_trainers_staff_select" ON public.weekly_schedule_band_trainers
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role IN ('admin','trainer') AND p.deleted_at IS NULL));

DROP POLICY IF EXISTS "band_trainers_admin_write" ON public.weekly_schedule_band_trainers;
CREATE POLICY "band_trainers_admin_write" ON public.weekly_schedule_band_trainers
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
      AND p.is_active = true AND p.deleted_at IS NULL))
  WITH CHECK (EXISTS (SELECT 1 FROM profiles p
    WHERE p.id = (SELECT auth.uid()) AND p.role = 'admin'
      AND p.is_active = true AND p.deleted_at IS NULL));

-- Backfill. Every band has a trainer today; nine slots have none and get no row.
INSERT INTO public.weekly_schedule_band_trainers (band_id, trainer_id, trainer_name, order_index)
SELECT b.id, b.trainer_id, b.trainer_name, 0 FROM public.weekly_schedule_bands b
ON CONFLICT DO NOTHING;

INSERT INTO public.daily_schedule_slot_trainers (slot_id, trainer_id, trainer_name, order_index)
SELECT s.id, s.trainer_id, COALESCE(s.trainer_name, 'מאמן'), 0
  FROM public.daily_schedule_slots s
 WHERE s.trainer_id IS NOT NULL
ON CONFLICT DO NOTHING;
```

- [ ] **Step 2: Push it**

Run: `supabase db push`

This is safe to push before any code ships: nothing reads these tables yet, and the old columns are untouched.

- [ ] **Step 3: Verify the backfill**

Run:

```bash
supabase db query --linked "SELECT (SELECT count(*)::int FROM weekly_schedule_band_trainers) AS band_links, (SELECT count(*)::int FROM weekly_schedule_bands) AS bands, (SELECT count(*)::int FROM daily_schedule_slot_trainers) AS slot_links, (SELECT count(*)::int FROM daily_schedule_slots WHERE trainer_id IS NOT NULL) AS slots_with_trainer;"
```

Expected: `band_links` equals `bands`, and `slot_links` equals `slots_with_trainer`.

- [ ] **Step 4: Regenerate and commit**

Run: `npm run db:types && npm run db:schema && npx tsc --noEmit`

```bash
git add supabase/migrations/20260922180000_slot_trainers_expand.sql src/types/database.generated.ts
git commit -m "feat(schedule): junction tables for a slot's and a band's trainers"
```

---

### Task 2: The types and every derived read

The heart of the change. The types, the select strings and every pure function that asks "who coaches here" move together, because a half-migrated shape leaves the tree red.

**Files:**
- Modify: `src/types/schedule.ts`, `src/types/weekly-schedule.ts`
- Modify: `src/lib/utils/weekly-schedule.ts`, `src/lib/utils/schedule-text.ts`, `src/lib/schedule/session-worklist.ts`
- Modify: `src/lib/utils/__tests__/weekly-schedule.test.ts`, `src/lib/utils/__tests__/schedule-text.test.ts`, `src/lib/utils/__tests__/schedule-week.test.ts`, `src/lib/schedule/__tests__/session-worklist.test.ts`, `src/lib/schedule/__tests__/materialization.test.ts`

**Interfaces:**
- Consumes: the tables from Task 1.
- Produces:
  - `interface SlotTrainer { id: string; trainer_id: string | null; trainer_name: string; order_index: number }`
  - `ScheduleSlot.trainers: SlotTrainer[]` replacing `trainer_id` / `trainer_name`
  - `WeeklyBand.trainers: SlotTrainer[]` replacing the same two
  - `OnDutyBand.trainers: { id: string | null; name: string }[]` replacing `trainerId` / `trainerName`
  - `firstTrainerId(trainers)` and `trainerNames(trainers)` in `src/lib/utils/trainer-color.ts`

- [ ] **Step 1: Write the failing tests**

In `src/lib/utils/__tests__/weekly-schedule.test.ts`, add to the `deriveOnDuty` block:

```ts
  test("a band keeps working when only one of its trainers is away", () => {
    const onDuty = deriveOnDuty(
      SUNDAY,
      [band({ trainers: [trainer(LIDOR, "לידור"), trainer(NADAV, "נדב")] })],
      [absence(LIDOR, "לידור")],
    );

    expect(onDuty.bands).toHaveLength(1);
    expect(onDuty.bands[0].trainers.map((t) => t.name)).toEqual(["נדב"]);
  });

  test("a band drops only when every one of its trainers is away", () => {
    const onDuty = deriveOnDuty(
      SUNDAY,
      [band({ trainers: [trainer(LIDOR, "לידור"), trainer(NADAV, "נדב")] })],
      [absence(LIDOR, "לידור"), absence(NADAV, "נדב")],
    );

    expect(onDuty.bands).toHaveLength(0);
  });

  test("an absence counts as expected when the trainer is any of a band's trainers", () => {
    const onDuty = deriveOnDuty(
      SUNDAY,
      [band({ trainers: [trainer(LIDOR, "לידור"), trainer(NADAV, "נדב")] })],
      [absence(NADAV, "נדב")],
    );

    expect(onDuty.absences.map((a) => a.trainerName)).toEqual(["נדב"]);
  });
```

Add the two helpers beside the file's existing fixtures:

```ts
function trainer(id: string, name: string) {
  return { id: `link-${id}`, trainer_id: id, trainer_name: name, order_index: 0 };
}
```

and change the file's `band()` fixture to build `trainers: [trainer(LIDOR, "לידור")]` instead of `trainer_id` / `trainer_name`, and `absence()` to whatever the file already uses for an `absent` exception.

In `src/lib/utils/__tests__/schedule-text.test.ts`:

```ts
  test("lists every trainer on the hour", () => {
    const text = buildScheduleWhatsAppText([
      slot({ trainers: [trainer(DIN, "דין"), trainer(LIDOR, "לידור")] }),
    ]);

    expect(text).toContain("דין, לידור");
  });
```

In `src/lib/schedule/__tests__/session-worklist.test.ts`:

```ts
  test("sorts two slots at the same hour by their first trainer's name", () => {
    const groups = buildSessionWorklist(
      [
        slot({ id: "nadav", start_time: "17:00:00", trainers: [trainer(NADAV, "נדב")] }),
        slot({ id: "lidor", start_time: "17:00:00", trainers: [trainer(LIDOR, "לידור")] }),
      ],
      {},
    );

    expect(groups.map((group) => group.slotId)).toEqual(["lidor", "nadav"]);
  });

  test("a slot with no trainers sorts as an empty name rather than throwing", () => {
    const groups = buildSessionWorklist(
      [
        slot({ id: "named", start_time: "17:00:00", trainers: [trainer(LIDOR, "לידור")] }),
        slot({ id: "none", start_time: "17:00:00", trainers: [] }),
      ],
      {},
    );

    expect(groups.map((group) => group.slotId)).toEqual(["none", "named"]);
  });

  test("'mine' matches a slot where I am the second trainer", () => {
    const groups = buildSessionWorklist(
      [slot({ trainers: [trainer(NADAV, "נדב"), trainer(LIDOR, "לידור")], trainees: [entry()] })],
      {},
    );

    expect(
      filterWorklist(groups, { mineOnly: true, pendingOnly: false, currentUserId: LIDOR }),
    ).toHaveLength(1);
  });
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npm run test:run -- src/lib/utils/__tests__ src/lib/schedule/__tests__`
Expected: FAIL on `trainers` not existing on the types.

- [ ] **Step 3: Change the types and the select strings**

In `src/types/schedule.ts`, replace `trainer_id` and `trainer_name` on `ScheduleSlot` with:

```ts
  /** Everyone coaching this hour, in order. First is a position, not a role. */
  trainers: SlotTrainer[];
```

and add above it:

```ts
/**
 * One trainer on one slot or band.
 *
 * `trainer_id` is nullable and the name is a snapshot: a deleted trainer
 * leaves the row and the name behind, which is what keeps a past board
 * readable. Never treat a null id as "no trainer" — the name is the trainer.
 */
export interface SlotTrainer {
  id: string;
  trainer_id: string | null;
  trainer_name: string;
  order_index: number;
}
```

Extend the select string so the trainers come with the slot:

```ts
export const SLOT_SELECT_WITH_TRAINEES =
  "*, trainees:daily_schedule_slot_trainees(id, slot_id, trainee_id, trainee_name, order_index, source, booked_at, cancelled_at, late_cancel, reminded_at), trainers:daily_schedule_slot_trainers(id, trainer_id, trainer_name, order_index), workout_exercises:slot_workout_exercises(id)";
```

In `src/types/weekly-schedule.ts`, replace `trainer_id` / `trainer_name` on `WeeklyBand` with `trainers: SlotTrainer[]` (imported from `@/types/schedule`), and on `OnDutyBand` replace `trainerId` / `trainerName` with:

```ts
  /** Everyone on this stretch. An exception always yields exactly one. */
  trainers: { id: string | null; name: string }[];
```

- [ ] **Step 4: Add the two shared helpers**

Append to `src/lib/utils/trainer-color.ts`:

```ts
/**
 * The id that gives a card its colour: the first trainer in order.
 *
 * First is a position, not a role. A slot with no trainers, or whose first
 * trainer was deleted, falls back to the neutral palette through
 * trainerColor's own null handling.
 */
export function firstTrainerId(
  trainers: readonly { trainer_id: string | null; order_index: number }[],
): string | null {
  const ordered = [...trainers].sort((a, b) => a.order_index - b.order_index);
  return ordered[0]?.trainer_id ?? null;
}

/** "דין, לידור" — every name on the hour, in order. Empty when there are none. */
export function trainerNames(
  trainers: readonly { trainer_name: string; order_index: number }[],
): string {
  return [...trainers]
    .sort((a, b) => a.order_index - b.order_index)
    .map((trainer) => trainer.trainer_name)
    .join(", ");
}
```

- [ ] **Step 5: Change the derived reads**

In `src/lib/utils/weekly-schedule.ts`:

```ts
function bandToOnDuty(band: WeeklyBand): OnDutyBand {
  return {
    id: band.id,
    source: "band",
    startTime: toHhMm(band.start_time),
    endTime: band.end_time ? toHhMm(band.end_time) : null,
    trainers: [...band.trainers]
      .sort((a, b) => a.order_index - b.order_index)
      .map((trainer) => ({ id: trainer.trainer_id, name: trainer.trainer_name })),
    locationHe: band.location_he,
    labelHe: band.label_he,
    isStandby: band.is_standby,
    maxTrainees: band.max_trainees,
    isBookable: band.is_bookable,
  };
}
```

`extraToOnDuty` gets `trainers: [{ id: exception.trainer_id, name: exception.trainer_name }]` in place of the two fields — an exception belongs to one trainer by definition and that does not change.

`byStartThenName` compares the first name:

```ts
function byStartThenName(a: OnDutyBand, b: OnDutyBand): number {
  if (a.startTime !== b.startTime) return a.startTime.localeCompare(b.startTime);
  return (a.trainers[0]?.name ?? "").localeCompare(b.trainers[0]?.name ?? "", "he");
}
```

In `deriveOnDuty`, a band survives while any of its trainers is present, and every trainer counts as expected:

```ts
  const standing = bands
    .filter((band) => band.weekday === weekday)
    // A band with two trainers is still happening when one of them is away.
    // It drops only when there is nobody left to take it.
    .filter((band) =>
      band.trainers.some((trainer) => !absentTrainerIds.has(trainer.trainer_id ?? "")),
    )
    .map(bandToOnDuty);
```

```ts
  const expectedTrainerIds = new Set(
    bands
      .filter((band) => band.weekday === weekday)
      .flatMap((band) => band.trainers.flatMap((t) => (t.trainer_id ? [t.trainer_id] : []))),
  );
```

Note the `?? ""` in the first filter: a band whose only trainer was deleted has a null id, which is never in `absentTrainerIds`, so the band stays on the board with its snapshot name. That is the intended reading.

In `src/lib/utils/schedule-text.ts`, the header uses every name:

```ts
  const header = [
    trainerNames(slot.trainers) || null,
    slot.location_he ? `(${slot.location_he})` : null,
  ]
    .filter(Boolean)
    .join(" ");
```

In `src/lib/schedule/session-worklist.ts`, the group carries the list and "mine" matches any of them:

```ts
export interface WorklistGroup {
  slotId: string;
  startTime: string;
  /** Everyone coaching this hour, in order. */
  trainers: { id: string | null; name: string }[];
  locationHe: string | null;
  hasGroupWorkout: boolean;
  groupExerciseCount: number;
  rows: WorklistRow[];
}
```

```ts
function compareSlots(a: ScheduleSlot, b: ScheduleSlot): number {
  return (
    a.start_time.localeCompare(b.start_time) ||
    trainerNames(a.trainers).localeCompare(trainerNames(b.trainers), "he")
  );
}
```

```ts
    trainers: [...slot.trainers]
      .sort((x, y) => x.order_index - y.order_index)
      .map((trainer) => ({ id: trainer.trainer_id, name: trainer.trainer_name })),
```

```ts
    .filter(
      (group) =>
        !filters.mineOnly ||
        group.trainers.some((trainer) => trainer.id === filters.currentUserId),
    )
```

Delete `trainerId` and `trainerName` from `WorklistGroup`.

- [ ] **Step 6: Fix every fixture the new shape breaks**

Run `npx tsc --noEmit` and work through it. Each slot or band fixture that set `trainer_id` / `trainer_name` sets `trainers: [trainer(<id>, "<name>")]` instead; a slot that had no trainer sets `trainers: []`.

- [ ] **Step 7: Run the tests and verify they pass**

Run: `npm run test:run -- src/lib/utils/__tests__ src/lib/schedule/__tests__ && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/types src/lib/utils src/lib/schedule
git commit -m "feat(schedule): an hour carries a list of trainers, not one"
```

---

### Task 3: The write paths

**Files:**
- Modify: `src/lib/validations/schedule.ts`, `src/lib/validations/weekly-schedule.ts`
- Modify: `src/lib/actions/daily-schedule-mutate.ts`, `src/lib/actions/weekly-schedule-mutate.ts`
- Modify: `src/lib/actions/daily-schedule-build.ts`, `src/features/booking/lib/materialize.ts`

**Interfaces:**
- Consumes: the types from Task 2.
- Produces: `trainerIds: string[]` on the slot and band input schemas, replacing `trainerId`.

- [ ] **Step 1: Widen the schemas**

In `src/lib/validations/schedule.ts`, replace the slot's `trainerId` field with:

```ts
  // No minimum: a slot with nobody assigned is legitimate today and stays so.
  // The cap is a guardrail, not a rule anyone will meet.
  trainerIds: z.array(uuidSchema).max(10, "יותר מדי מאמנים לשעה אחת").default([]),
```

Do the same in the band schema in `src/lib/validations/weekly-schedule.ts`.

- [ ] **Step 2: Resolve every name, not one**

In `src/lib/actions/daily-schedule-mutate.ts`, generalise `resolveTrainerName` to a list, keeping its existing reasoning verbatim in the comment (admin client because the profiles policy hides other trainers; no `is_active` filter so a slot already carrying a deactivated trainer stays editable):

```ts
/**
 * Resolves the display-name snapshots for a slot's trainers, in the order
 * they were given.
 *
 * Admin client on purpose: the profiles SELECT policies let a trainer read
 * only their own row and active trainer rows, so a trainer assigning a slot to
 * an admin-who-coaches would be told "המאמן שנבחר אינו קיים" — a lie. Safe
 * because every caller is gated on verifyAdminOrTrainer, and this reads names.
 *
 * Deliberately does not filter on is_active: a deactivated trainer cannot be
 * newly assigned (they are absent from the form's list), but a slot that
 * already carries one must stay editable, or it is frozen on the board.
 */
async function resolveTrainerNames(
  trainerIds: readonly string[],
): Promise<{ names: { trainerId: string; name: string }[] } | { error: string }> {
  if (trainerIds.length === 0) return { names: [] };

  const { data, error } = await createAdminClient()
    .from("profiles")
    .select("id, full_name")
    .in("id", [...trainerIds])
    .in("role", ["trainer", "admin"])
    .is("deleted_at", null);

  if (error) {
    console.error("Resolve trainer names error:", error);
    return { error: "שגיאה באימות המאמן" };
  }

  const byId = new Map((data ?? []).map((row) => [row.id, row.full_name ?? "מאמן"]));
  const missing = trainerIds.filter((id) => !byId.has(id));
  if (missing.length > 0) return { error: "אחד המאמנים שנבחרו אינו קיים" };

  // The caller's order is the order on the card, so it is preserved here
  // rather than taken from whatever the query returned.
  return { names: trainerIds.map((id) => ({ trainerId: id, name: byId.get(id)! })) };
}
```

- [ ] **Step 3: Replace the slot's trainer on write**

In `createSlotAction` and `updateSlotAction`, drop `trainer_id` / `trainer_name` from the insert and update payloads, and after the slot row is written, replace its trainer links:

```ts
/**
 * The slot's trainers, replaced wholesale. Delete-then-insert rather than a
 * merge: the list is short, the order is the payload's order, and there is
 * nothing hanging off these rows for a merge to protect.
 */
async function replaceSlotTrainers(
  supabase: ServerClient,
  slotId: string,
  names: { trainerId: string; name: string }[],
): Promise<{ error: string | null }> {
  const { error: deleteError } = await typedFrom(supabase, "daily_schedule_slot_trainers")
    .delete()
    .eq("slot_id", slotId);
  if (deleteError) {
    console.error("Clear slot trainers error:", deleteError);
    return { error: "שגיאה בשמירת המאמנים" };
  }

  if (names.length === 0) return { error: null };

  const { error: insertError } = await typedFrom(supabase, "daily_schedule_slot_trainers")
    .insert(
      names.map((entry, index) => ({
        slot_id: slotId,
        trainer_id: entry.trainerId,
        trainer_name: entry.name,
        order_index: index,
      })),
    );
  if (insertError) {
    console.error("Insert slot trainers error:", insertError);
    return { error: "שגיאה בשמירת המאמנים" };
  }

  return { error: null };
}
```

Do the same in `src/lib/actions/weekly-schedule-mutate.ts` against `weekly_schedule_band_trainers`, with `band_id`.

- [ ] **Step 4: Carry the list through materialization**

In `src/features/booking/lib/materialize.ts`, the slot insert loses `trainer_id` / `trainer_name`, and after the slots are created their trainer rows are inserted from the band's:

```ts
  // The projected slot inherits the band's whole staffing, in the band's order.
  const trainerRows = created.flatMap((slot) => {
    const band = bandsById.get(slot.band_id!);
    return (band?.trainers ?? []).map((trainer, index) => ({
      slot_id: slot.id,
      trainer_id: trainer.trainer_id,
      trainer_name: trainer.trainer_name,
      order_index: index,
    }));
  });
  if (trainerRows.length > 0) {
    const { error } = await typedFrom(db, "daily_schedule_slot_trainers").insert(trainerRows);
    if (error) console.error("Materialise slot trainers error:", error);
  }
```

In `src/lib/actions/daily-schedule-build.ts`, the day builder does the same from `OnDutyBand.trainers`, whose entries are `{ id, name }`.

- [ ] **Step 5: Type-check, lint, commit**

Run: `npx tsc --noEmit && npm run lint`

```bash
git add src/lib/validations src/lib/actions src/features/booking/lib/materialize.ts
git commit -m "feat(schedule): writing an hour writes its list of trainers"
```

---

### Task 4: The staff screens

**Files:**
- Modify: `src/components/admin/schedule/SlotFormDialog.tsx`, `src/components/admin/schedule/week/BandFormDialog.tsx`
- Create: `src/components/admin/schedule/TrainerCheckboxGroup.tsx`
- Modify: `src/components/admin/calendar/DaySlotCard.tsx`, `src/components/admin/calendar/RosterSheet.tsx`, `src/components/admin/schedule/week/WeekSlotCard.tsx`, `src/components/admin/schedule/week/BandCard.tsx`, `src/components/admin/schedule/week/WeekDayColumn.tsx`, `src/components/admin/schedule/OnDutyStrip.tsx`, `src/components/admin/schedule/SessionWorklist.tsx`, `src/components/admin/calendar/CalendarDayList.tsx`, `src/components/admin/schedule/SlotWorkoutEditor.tsx`

**Interfaces:**
- Consumes: `firstTrainerId`, `trainerNames`, the `trainers` fields from Task 2.
- Produces: `TrainerCheckboxGroup`, the multi-select used by both forms.

- [ ] **Step 1: Write the picker**

Create `src/components/admin/schedule/TrainerCheckboxGroup.tsx`, modelled on `BranchCheckboxGroup` — whose toggle appends to the end, which is exactly the ordering rule the spec wants:

```tsx
"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { TrainerOption } from "@/lib/actions/admin-trainers-list";

interface TrainerCheckboxGroupProps {
  trainers: readonly TrainerOption[];
  value: readonly string[];
  onChange: (next: string[]) => void;
  disabled?: boolean;
  idPrefix?: string;
}

/**
 * One checkbox per trainer. Zero, one or several may be checked: an hour with
 * nobody assigned is legitimate, and an hour with two is the whole reason this
 * is not a select.
 *
 * Selection order is the order on the card, and the first of them gives the
 * card its colour, so ticking appends rather than sorting.
 */
export function TrainerCheckboxGroup({
  trainers,
  value,
  onChange,
  disabled = false,
  idPrefix = "trainer",
}: TrainerCheckboxGroupProps) {
  const toggle = (trainerId: string, checked: boolean) => {
    const without = value.filter((id) => id !== trainerId);
    onChange(checked ? [...without, trainerId] : without);
  };

  if (trainers.length === 0) {
    return <p className="text-sm text-muted-foreground">אין מאמנים פעילים</p>;
  }

  return (
    <div className="flex flex-wrap gap-4">
      {trainers.map((trainer) => {
        const id = `${idPrefix}-${trainer.id}`;
        return (
          <div key={trainer.id} className="flex items-center gap-2">
            <Checkbox
              id={id}
              checked={value.includes(trainer.id)}
              onCheckedChange={(checked) => toggle(trainer.id, checked === true)}
              disabled={disabled}
            />
            <Label htmlFor={id} className="cursor-pointer">
              {trainer.full_name ?? "ללא שם"}
            </Label>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Swap both forms**

In `SlotFormDialog.tsx`, replace the `trainerId` state and its `Select` with `trainerIds: string[]` and `TrainerCheckboxGroup`. The existing suggestion from `trainersAtTime(onDuty, time)` stays and now seeds every trainer the standing week puts on that hour:

```tsx
  const [trainerIds, setTrainerIds] = useState<string[]>(() => {
    if (slot) return [...slot.trainers].sort((a, b) => a.order_index - b.order_index)
      .flatMap((t) => (t.trainer_id ? [t.trainer_id] : []));
    // The standing week's answer for this hour, which is right far more often
    // than empty is. Still only a default — the picker is right there.
    return suggested.flatMap((band) => band.trainers.flatMap((t) => (t.id ? [t.id] : [])));
  });
```

`suggested` currently de-duplicates by `band.trainerId`; change it to de-duplicate across each band's `trainers`.

In `BandFormDialog.tsx`, do the same with `trainerIds` and drop the "בחר מאמן" required-field refusal, since a band with no trainer is now expressible. Keep the submit disabled only on the fields that are still required.

- [ ] **Step 3: Rename on every card**

Each of these renders one trainer today. Replace `slot.trainer_name ?? "ללא מאמן"` with `trainerNames(slot.trainers) || "ללא מאמן"`, and `trainerColor(slot.trainer_id)` with `trainerColor(firstTrainerId(slot.trainers))`:

- `DaySlotCard.tsx`, `WeekSlotCard.tsx`, `RosterSheet.tsx` (both the header and the delete dialog's sentence), `SlotWorkoutEditor.tsx` (the subtitle), `CalendarDayList.tsx` (the absent-trainer marker, which now checks whether *every* trainer is absent).
- `BandCard.tsx` and `WeekDayColumn.tsx` read `band.trainers` the same way.
- `OnDutyStrip.tsx` reads `OnDutyBand.trainers` and joins the names.
- `SessionWorklist.tsx` renders `group.trainers` — the dot uses `trainerColor(group.trainers[0]?.id ?? null)`.

- [ ] **Step 4: Type-check, lint, test, build, commit**

Run: `npx tsc --noEmit && npm run lint && npm run test:run && npm run build`

```bash
git add src/components
git commit -m "feat(schedule): the calendar shows and picks every trainer on an hour"
```

---

### Task 5: The trainee-facing surfaces

Three reads outside the admin screens take `slot.trainer_name` straight from the column, and they are what a parent sees.

**Files:**
- Modify: `src/features/booking/lib/queries.ts`, `src/features/booking/lib/reminders.ts`, `src/features/booking/lib/actions/schedule.ts`

- [ ] **Step 1: Embed the trainers instead of the column**

In each of the three, the `slot:daily_schedule_slots!inner(...)` embed drops `trainer_name` and gains `trainers:daily_schedule_slot_trainers(trainer_name, order_index)`. The row type changes to match:

```ts
    trainers: { trainer_name: string; order_index: number }[] | null;
```

and every `slot.trainer_name ?? "הצוות"` becomes:

```ts
      trainerName: trainerNames(slot.trainers ?? []) || "הצוות",
```

with `trainerNames` imported from `@/lib/utils/trainer-color`. The `"הצוות"` fallback is unchanged and still covers an hour with nobody assigned.

- [ ] **Step 2: Type-check, lint, build, commit**

Run: `npx tsc --noEmit && npm run lint && npm run build`

```bash
git add src/features/booking/lib
git commit -m "feat(booking): a trainee sees every trainer on their hour"
```

---

### Task 6: Deploy, then migration B

**Files:**
- Create: `supabase/migrations/20260922200000_slot_trainers_contract.sql`
- Regenerate: `src/types/database.generated.ts`, `supabase/schema.sql`

- [ ] **Step 1: Ship the code first**

Open the PR, confirm `ci` and Vercel pass, merge, and deploy to production. Migration A is already live and additive, so the new code has everything it reads.

- [ ] **Step 2: Write migration B**

Create `supabase/migrations/20260922200000_slot_trainers_contract.sql`:

```sql
-- Many trainers on one training hour, step 2 of 2 (spec 2026-09-22).
--
-- Runs only after the code that reads the junction tables is deployed. The
-- re-backfill closes the one window the split leaves: a slot or band written
-- by the OLD code between migration A and the deploy carries the column and no
-- link row, and without this it would read from now on as having no trainer.

INSERT INTO public.weekly_schedule_band_trainers (band_id, trainer_id, trainer_name, order_index)
SELECT b.id, b.trainer_id, b.trainer_name, 0
  FROM public.weekly_schedule_bands b
 WHERE b.trainer_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM public.weekly_schedule_band_trainers t WHERE t.band_id = b.id)
ON CONFLICT DO NOTHING;

INSERT INTO public.daily_schedule_slot_trainers (slot_id, trainer_id, trainer_name, order_index)
SELECT s.id, s.trainer_id, COALESCE(s.trainer_name, 'מאמן'), 0
  FROM public.daily_schedule_slots s
 WHERE s.trainer_id IS NOT NULL
   AND NOT EXISTS (
     SELECT 1 FROM public.daily_schedule_slot_trainers t WHERE t.slot_id = s.id)
ON CONFLICT DO NOTHING;

ALTER TABLE public.weekly_schedule_bands
  DROP COLUMN IF EXISTS trainer_id,
  DROP COLUMN IF EXISTS trainer_name;

ALTER TABLE public.daily_schedule_slots
  DROP COLUMN IF EXISTS trainer_id,
  DROP COLUMN IF EXISTS trainer_name;
```

The `NOT EXISTS` guard is on the parent rather than on the pair: a row written by the new code already has its links, and re-adding the old column's trainer would append a duplicate under a different order.

- [ ] **Step 3: Apply and verify**

Run: `supabase db push`, then:

```bash
supabase db query --linked "SELECT (SELECT count(*)::int FROM information_schema.columns WHERE table_name='daily_schedule_slots' AND column_name IN ('trainer_id','trainer_name')) AS slot_columns_left, (SELECT count(*)::int FROM information_schema.columns WHERE table_name='weekly_schedule_bands' AND column_name IN ('trainer_id','trainer_name')) AS band_columns_left, (SELECT count(*)::int FROM daily_schedule_slots s WHERE NOT EXISTS (SELECT 1 FROM daily_schedule_slot_trainers t WHERE t.slot_id = s.id)) AS slots_without_trainers, (SELECT count(*)::int FROM weekly_schedule_bands b WHERE NOT EXISTS (SELECT 1 FROM weekly_schedule_band_trainers t WHERE t.band_id = b.id)) AS bands_without_trainers;"
```

Expected: both `*_columns_left` are 0, `slots_without_trainers` is 9 (the slots that never had one), and `bands_without_trainers` is 0.

- [ ] **Step 4: Verify the behaviour against the database**

A rolled-back transaction that puts two trainers on a band and checks the consequences:

```sql
BEGIN;
CREATE TEMP TABLE ctx AS
SELECT
  (SELECT id FROM weekly_schedule_bands ORDER BY created_at DESC LIMIT 1) AS band,
  (SELECT id FROM profiles WHERE role IN ('trainer','admin') AND deleted_at IS NULL ORDER BY created_at LIMIT 1) AS t1,
  (SELECT id FROM profiles WHERE role IN ('trainer','admin') AND deleted_at IS NULL ORDER BY created_at DESC LIMIT 1) AS t2;
CREATE TEMP TABLE report(step text, detail text);

DELETE FROM weekly_schedule_band_trainers t USING ctx c WHERE t.band_id = c.band;
INSERT INTO weekly_schedule_band_trainers (band_id, trainer_id, trainer_name, order_index)
SELECT c.band, c.t1, 'ראשון', 0 FROM ctx c
UNION ALL SELECT c.band, c.t2, 'שני', 1 FROM ctx c;

INSERT INTO report SELECT '1_two_trainers',
  'links=' || (SELECT count(*) FROM ctx c JOIN weekly_schedule_band_trainers t ON t.band_id = c.band);

-- Deleting a trainer keeps the band and keeps the name snapshot.
DELETE FROM profiles p USING ctx c WHERE p.id = c.t2;

INSERT INTO report SELECT '2_after_trainer_delete',
       'band_alive=' || (SELECT (count(*) = 1)::text FROM ctx c JOIN weekly_schedule_bands b ON b.id = c.band)
    || ' links=' || (SELECT count(*) FROM ctx c JOIN weekly_schedule_band_trainers t ON t.band_id = c.band)
    || ' name_kept=' || (SELECT string_agg(t.trainer_name, ',' ORDER BY t.order_index) FROM ctx c JOIN weekly_schedule_band_trainers t ON t.band_id = c.band)
    || ' id_nulled=' || (SELECT count(*) FROM ctx c JOIN weekly_schedule_band_trainers t ON t.band_id = c.band AND t.trainer_id IS NULL);

-- A band with two trainers projects a slot that carries both, in order.
INSERT INTO daily_schedule_slots (schedule_date, start_time, branch_id, band_id, created_by, max_trainees)
SELECT CURRENT_DATE + 30, '17:00', b.branch_id, b.id, c.t1, b.max_trainees
  FROM ctx c JOIN weekly_schedule_bands b ON b.id = c.band;

INSERT INTO daily_schedule_slot_trainers (slot_id, trainer_id, trainer_name, order_index)
SELECT s.id, t.trainer_id, t.trainer_name, t.order_index
  FROM ctx c
  JOIN daily_schedule_slots s ON s.band_id = c.band AND s.schedule_date = CURRENT_DATE + 30
  JOIN weekly_schedule_band_trainers t ON t.band_id = c.band;

INSERT INTO report SELECT '3_materialised',
       'slot_trainers=' || (SELECT count(*) FROM ctx c
          JOIN daily_schedule_slots s ON s.band_id = c.band AND s.schedule_date = CURRENT_DATE + 30
          JOIN daily_schedule_slot_trainers t ON t.slot_id = s.id)
    || ' order_kept=' || (SELECT string_agg(t.trainer_name, ',' ORDER BY t.order_index) FROM ctx c
          JOIN daily_schedule_slots s ON s.band_id = c.band AND s.schedule_date = CURRENT_DATE + 30
          JOIN daily_schedule_slot_trainers t ON t.slot_id = s.id);

SELECT step, detail FROM report ORDER BY step;
ROLLBACK;
```

Expected: `1_two_trainers` reports `links=2`; `2_after_trainer_delete` reports `band_alive=true links=2 name_kept=ראשון,שני id_nulled=1`; `3_materialised` reports `slot_trainers=2 order_kept=ראשון,שני` — the band survives a trainer deletion that would have destroyed it before, and the deleted trainer's name is still on the board.

- [ ] **Step 5: Regenerate, commit, hand over**

Run: `npm run db:types && npm run db:schema && npx tsc --noEmit`

```bash
git add supabase/migrations/20260922200000_slot_trainers_contract.sql src/types/database.generated.ts
git commit -m "chore(schedule): drop the single-trainer columns now the code reads the lists"
```

Then tell Itay the browser walkthrough is his (login needs a WhatsApp OTP): put two trainers on one hour in the calendar and in the standing week, check the card shows both names and takes the first one's colour, check "רק שלי" finds the hour for the second trainer, mark one of them away for a date and confirm the hour still appears with the other, and copy the day's WhatsApp text to see both names in the header.
