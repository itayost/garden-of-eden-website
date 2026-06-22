# Shift "other-purposes" time — design

Date: 2026-06-22
Status: approved (design)

## Problem

Trainers spend part of a shift on non-training work (nutrition planning,
customer-retention calls, staff meetings, etc.). Today a `trainer_shifts` row
only records clock-in/clock-out, so all shift time reads as training time.
Trainers need to record how much of a shift went to "other purposes," with a
short categorised label, so admins can see training time separately from
other-purpose time.

## Requirements (locked with the user)

1. **One entry per shift.** A shift has a single other-purpose amount + category,
   not a list.
2. **Preset category, no free text.** The trainer picks from a fixed list:
   - תזונה
   - שימור לקוחות
   - ישיבות / פגישות צוות
   - אדמיניסטרציה (ניירת)
   - שיווק ותוכן
   - תחזוקת מתקן
3. **Edited later from the shifts table** — not at clock-out. Clock-in/out stays
   a single tap and the offline sync queue is untouched.
4. **Split from training time.** Training time = gross shift duration − other
   minutes. Shift views and per-trainer summaries show the two separately.
5. **Who edits:** a trainer edits the entry on **their own** ended shifts; an
   admin edits it on **any** ended shift. (Unlike clocked times, which trainers
   can only change via the existing request-and-approve flow, this self-reported
   metadata is set directly.)
6. **Time unit:** minutes, entered via quick-preset buttons (15/30/45/60/90) plus
   a free number field, capped at the shift length.

## Data model

Migration `supabase/migrations/<ts>_trainer_shifts_other_purpose.sql`:

```sql
ALTER TABLE trainer_shifts
  ADD COLUMN IF NOT EXISTS other_purpose_minutes integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS other_purpose_category text;

ALTER TABLE trainer_shifts
  ADD CONSTRAINT trainer_shifts_other_purpose_minutes_nonneg
    CHECK (other_purpose_minutes >= 0);

-- Category must be one of the presets (or NULL).
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

-- Both set together or both empty (single entry semantics).
ALTER TABLE trainer_shifts
  ADD CONSTRAINT trainer_shifts_other_purpose_paired
    CHECK (
      (other_purpose_minutes > 0 AND other_purpose_category IS NOT NULL)
      OR (other_purpose_minutes = 0 AND other_purpose_category IS NULL)
    );
```

Notes:
- `minutes ≤ shift duration` is enforced in the server action, not the DB (it
  depends on `end_time - start_time`, which is awkward to express as a stable
  CHECK and irrelevant while a shift is still open).
- No RLS change. The existing "Trainers can update own shifts" and "Admins can
  update all shifts" policies already cover this UPDATE.

`src/types/database.ts` — add `other_purpose_minutes: number` and
`other_purpose_category: string | null` to the `TrainerShift` type.

## Categories constant

`src/lib/constants/shifts.ts`:

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

Single source of truth for the Zod schema, the `<Select>`, and (by hand) the DB
CHECK list above.

## Server action

`setShiftOtherPurposeAction({ shiftId, minutes, category })` in
`src/lib/actions/trainer-shifts.ts`:

- `verifyAdminOrTrainer()`.
- Validate `shiftId` with `isValidUUID`.
- Load the shift (`id, trainer_id, start_time, end_time`).
- Authorize: admins → any shift; trainers → only `shift.trainer_id === user.id`.
- Reject if `end_time` is null ("לא ניתן לעדכן זמן למשמרת פעילה").
- Normalise a "clear" request (`minutes` 0 or `category` empty) to
  `minutes = 0, category = null`.
- Otherwise validate: `category ∈ SHIFT_OTHER_PURPOSE_CATEGORIES`,
  `minutes` is a non-negative integer, `minutes ≤ round((end_time − start_time)/60000)`.
- `update` the two columns; `revalidatePath("/admin/shifts")`.
- Return the `{ error } | { success: true }` shape used by the other shift actions.

Validation lives in a pure helper (`validateOtherPurpose`) so it can be unit
tested without the DB.

## UI

`ShiftOtherPurposeDialog` (new client component under
`src/components/admin/shifts/`):
- Category `<Select>` listing the 6 presets plus a "ללא / נקה" option that clears.
- Minutes: preset buttons (15/30/45/60/90) and a number `<Input>`; shows the
  shift length and blocks values above it client-side (server re-validates).
- Submits via `setShiftOtherPurposeAction`, then `router.refresh()`; remounts per
  shift via `key={shift.id}`.

`TrainerShiftsView` — add a per-shift trigger (icon button, ended shifts only),
in both the mobile card list and the desktop table:
- Trainers (non-admin): on their own shifts, next to "בקש שינוי".
- Admins: on any shift, next to edit/delete.

## Display (training vs other)

Pure helper `splitShiftMinutes(shift)` → `{ grossMinutes, otherMinutes, trainingMinutes }`
where `trainingMinutes = max(0, gross − other)`.

- Per-shift row: show training duration; when `otherMinutes > 0`, a badge
  `אחר: 30 ד׳ · תזונה`.
- Per-trainer summary + top cards: show **training (net)** and **מטרות אחרות**
  totals separately, both derived from `splitShiftMinutes`. `aggregateByTrainer`
  gains `trainingMinutes` and `otherMinutes` alongside `totalMinutes`.

## Edge cases

- Active (un-ended) shift: trigger hidden/disabled; action rejects.
- `minutes > duration`: rejected client- and server-side with a Hebrew message.
- Clearing: `minutes 0`, `category null` (paired CHECK holds).
- Offline: not part of the clock-out queue; a normal online edit.

## Testing (pure utilities only — project uses real Supabase, no mock-DB tests)

- `splitShiftMinutes`: gross/other/training math, clamping when other ≥ gross,
  open shift (no `end_time`).
- `validateOtherPurpose(minutes, category, durationMinutes)`: category-in-presets,
  minutes ≤ duration, non-negative integer, both-or-neither pairing, clear case.

## Out of scope

- Multiple entries per shift, free-text descriptions.
- CSV export of the split (possible follow-up).
- Changing the clock-in/out or offline-sync flows.
