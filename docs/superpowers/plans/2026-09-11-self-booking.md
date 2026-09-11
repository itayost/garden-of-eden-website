# Self-Booking for קריית אתא Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** קריית אתא trainees book and cancel their own training slots in the app within their plan; slots for bookable bands exist 14 days ahead; staff see seats and bookings on the board they already use.

**Architecture:** Bands gain capacity and a bookable flag; a daily projector materializes bookable slots; trainee server actions (session-proven, service-role) enforce the rules, with capacity inside a locking Postgres function; roster rows gain booking columns; a `/dashboard/schedule` tab and a home card for trainees.

**Tech Stack:** Next.js 16 server actions, Supabase (plpgsql `book_slot`), Zod, Vitest for the pure rules, Vercel cron, WhatsApp template.

**Spec:** `docs/superpowers/specs/2026-09-11-self-booking-design.md`. ADR: `docs/adr/0007-self-booking-kiryat-ata.md`.

## Global Constraints

- Hebrew UI, logical CSS, no emojis, immutability, `typedFrom()`, `isValidUUID()`.
- Trainee actions: `createClient()` (server) to get the user, then `createAdminClient()` for the reads and writes; never trust a client-supplied trainee id.
- Numbers: window 14 days, cancel cutoff 3 hours, close 60 minutes before start, weekly cap 2 for `subscription` and `term`, default capacity 8, max 40.
- Tests for pure functions only. Baseline: 20 known localStorage failures; 11 lint warnings.
- One commit per task with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

---

### Task 1: Migration, `book_slot`, types

**Files:** Create `supabase/migrations/20260912120000_self_booking.sql`; modify `src/types/schedule.ts`, `src/types/weekly-schedule.ts`.

- [ ] Migration: bands `max_trainees SMALLINT NOT NULL DEFAULT 8 CHECK (BETWEEN 1 AND 40)`, `is_bookable BOOLEAN NOT NULL DEFAULT false`; slots `band_id UUID REFERENCES weekly_schedule_bands(id) ON DELETE SET NULL`, `max_trainees SMALLINT CHECK (NULL OR BETWEEN 1 AND 40)`, index `idx_schedule_slots_band_date (band_id, schedule_date)`; roster `source TEXT NOT NULL DEFAULT 'staff' CHECK IN ('staff','self')`, `booked_at TIMESTAMPTZ`, `cancelled_at TIMESTAMPTZ`, `late_cancel BOOLEAN NOT NULL DEFAULT false`, `reminded_at TIMESTAMPTZ`, index `idx_schedule_slot_trainees_trainee_active (trainee_id, slot_id) WHERE trainee_id IS NOT NULL AND cancelled_at IS NULL`; table `daily_schedule_slot_tombstones (band_id UUID NOT NULL REFERENCES weekly_schedule_bands(id) ON DELETE CASCADE, schedule_date DATE NOT NULL, created_by UUID, created_at TIMESTAMPTZ DEFAULT now(), PRIMARY KEY (band_id, schedule_date))` with RLS staff select/insert (admin/trainer, is_active); function:

```sql
CREATE OR REPLACE FUNCTION public.book_slot(p_slot_id UUID, p_trainee_id UUID, p_trainee_name TEXT)
RETURNS TABLE (roster_id UUID, seats_taken INTEGER, max_trainees INTEGER)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_max INTEGER; v_taken INTEGER; v_id UUID; v_next INTEGER;
BEGIN
  SELECT s.max_trainees INTO v_max FROM daily_schedule_slots s WHERE s.id = p_slot_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'slot_not_found'; END IF;
  IF v_max IS NULL THEN RAISE EXCEPTION 'slot_not_bookable'; END IF;
  SELECT count(*) INTO v_taken FROM daily_schedule_slot_trainees t WHERE t.slot_id = p_slot_id AND t.cancelled_at IS NULL;
  SELECT t.id INTO v_id FROM daily_schedule_slot_trainees t WHERE t.slot_id = p_slot_id AND t.trainee_id = p_trainee_id;
  IF v_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM daily_schedule_slot_trainees t WHERE t.id = v_id AND t.cancelled_at IS NULL) THEN RAISE EXCEPTION 'already_booked'; END IF;
    IF v_taken >= v_max THEN RAISE EXCEPTION 'capacity_full'; END IF;
    UPDATE daily_schedule_slot_trainees SET cancelled_at = NULL, late_cancel = false, booked_at = now(), source = 'self', reminded_at = NULL WHERE id = v_id;
  ELSE
    IF v_taken >= v_max THEN RAISE EXCEPTION 'capacity_full'; END IF;
    SELECT COALESCE(max(t.order_index), -1) + 1 INTO v_next FROM daily_schedule_slot_trainees t WHERE t.slot_id = p_slot_id;
    INSERT INTO daily_schedule_slot_trainees (slot_id, trainee_id, trainee_name, order_index, source, booked_at)
      VALUES (p_slot_id, p_trainee_id, p_trainee_name, v_next, 'self', now()) RETURNING id INTO v_id;
  END IF;
  RETURN QUERY SELECT v_id, v_taken + 1, v_max;
END $$;
REVOKE ALL ON FUNCTION public.book_slot(UUID, UUID, TEXT) FROM PUBLIC, anon, authenticated;
```
  The function is called only with the service role. `REVOKE` keeps it out of reach of the anon and user keys.

- [ ] Types: `WeeklyBand` + `max_trainees: number; is_bookable: boolean`; `ScheduleSlot` + `band_id: string | null; max_trainees: number | null`; `SlotTrainee` + `source: "staff" | "self"; booked_at: string | null; cancelled_at: string | null; late_cancel: boolean; reminded_at: string | null`; `SLOT_SELECT_WITH_TRAINEES` lists the new roster columns. Grep every `SlotTrainee`/`WeeklyBand` literal in tests and fixtures and add the fields.
- [ ] `supabase db push`; tsc; commit `feat(schedule): booking columns, capacity, tombstones, and book_slot`.

### Task 2: Pure booking rules with tests

**Files:** Create `src/lib/schedule/booking-rules.ts`, `src/lib/schedule/__tests__/booking-rules.test.ts`; modify `src/lib/plans/plan-status.ts` (+ its test).

```ts
export const BOOKING_WINDOW_DAYS = 14; export const CANCEL_CUTOFF_HOURS = 3; export const CLOSE_BEFORE_MINUTES = 60;
export const WEEKLY_CAP_KINDS: readonly PlanKind[] = ["subscription", "term"]; export const WEEKLY_CAP = 2;
export interface RosterRowLite { schedule_date: string; start_time: string; branch_id: string | null; cancelled_at: string | null; late_cancel: boolean }
export function weekBounds(date: string): { start: string; end: string }   // Sunday..Saturday containing date
export function slotStartMs(date: string, time: string): number              // Israel wall clock -> epoch ms (use Date.UTC on the parts minus the Israel offset from israel-time helpers; document the assumption)
export function isWithinBookingWindow(date: string, today: string): boolean  // today <= date <= today+14
export function bookingCloses(date: string, time: string, nowMs: number): boolean   // nowMs >= start - 60min
export function cancelState(date: string, time: string, nowMs: number): "open" | "late" | "closed"
export function weeklyBookingCount(rows: readonly RosterRowLite[], date: string, branchId: string): number  // not cancelled, same branch, in weekBounds
export function countReservedFromRows(rows, plan, today): number            // date > today, not cancelled, in window and branch
export type BookingBlock = "no_plan" | "plan_cancelled" | "plan_not_running" | "addon" | "no_sessions_left" | "weekly_cap" | "full" | "closed" | "outside_window" | "wrong_branch";
export function bookingEligibility(input: { plan: TraineePlan | null; productKind: PlanKind | null; used: number; reserved: number; weekCount: number; slotDate: string; today: string }): { ok: true } | { ok: false; block: BookingBlock }
export const BOOKING_BLOCK_LABELS_HE: Record<BookingBlock, string>
```
`countSessionsUsedFromRows` accepts rows with optional `cancelled_at`/`late_cancel` and counts a row when `cancelled_at === null || late_cancel`.

- [ ] Tests first (window edges, week bounds across a month, cutoff 3h and 1h edges, cap counts staff rows too, card with reserved, subscription ignores sessions, addon blocked, cancelled/late counting). Run, fail, implement, pass. Commit `feat(schedule): booking rules`.

### Task 3: Materialization, tombstones, band settings

**Files:** Create `src/lib/schedule/materialization.ts` (+ test), `src/features/booking/lib/materialize.ts`, `src/app/api/cron/materialize-slots/route.ts`; modify `vercel.json`, `src/lib/actions/daily-schedule-mutate.ts` (tombstone on delete), `src/lib/actions/daily-schedule-build.ts` (copy `band_id`, `max_trainees`), `src/lib/validations/weekly-schedule.ts`, `src/lib/actions/weekly-schedule-mutate.ts`, `src/components/admin/schedule/week/BandFormDialog.tsx`, `BandCard.tsx`.

- [ ] Pure `materializationPlan({ dates, bands, exceptions, existingByDateBand: Set<"date|bandId">, tombstones: Set<"date|bandId"> }): { date; band: WeeklyBand }[]` using `deriveOnDuty` per date, bookable non-standby bands only. Test: absence skips, existing skipped, tombstone skipped, standby never.
- [ ] `materializeBookableSlots(db, branchId, today)` inserts slots (`created_by` = the first admin id found or a `SYSTEM_ACTOR` env; simplest: nullable? `created_by` is NOT NULL: use the band's `created_by`). Returns the inserted count.
- [ ] Cron route (`CRON_SECRET`), vercel.json `30 1 * * *` (03:30 Israel), runs for every branch that has a bookable band; also sends booking reminders (Task 7 adds).
- [ ] `deleteSlotAction`: when the slot has `band_id`, insert a tombstone first. `slotRowsFor` in build: include `band_id: band.id` and `max_trainees: band.isBookable ? band.maxTrainees : null` (extend `OnDutyBand` with `maxTrainees`, `isBookable`, carried by `deriveOnDuty`).
- [ ] Band schema: `maxTrainees: z.number().int().min(1).max(40).default(8)`, `isBookable: z.boolean().default(false)`; actions write them; form: number input + switch, card shows "8 מקומות · הרשמה עצמית".
- [ ] Commit `feat(schedule): bookable bands project two weeks of slots`.

### Task 4: Trainee actions

**Files:** Create `src/features/booking/lib/actions/schedule.ts`, `src/features/booking/lib/actions/book.ts`, `src/features/booking/lib/queries.ts`; modify `src/lib/rate-limit.ts` (add `booking` 20/10m fail open).

```ts
export interface BookableSlotView { id; date; time /*HH:MM*/; trainerName; label; location; seatsTaken; maxTrainees; booked: boolean; closed: boolean }
export interface MyBooking { slotId; date; time; trainerName; location; cancelState: "open"|"late"|"closed" }
export interface TraineeScheduleView { canBook: boolean; branchId: string | null; plan: { name; status; sessionsLeft: number|null; weekCount: number; weeklyCap: number|null; renewUrl: string|null } | null; block: BookingBlock | null; bookings: MyBooking[]; days: { date: string; slots: BookableSlotView[] }[] }
export async function getMyScheduleAction(): Promise<TraineeScheduleView | { error: string }>
export async function bookSlotAction(slotId: string): Promise<{ ok: true; sessionsLeft: number|null } | { error: string; block?: BookingBlock }>
export async function cancelBookingAction(slotId: string): Promise<{ ok: true; late: boolean } | { error: string }>
```
`queries.ts`: `loadTraineeBranch(db, userId)` (first branch with a bookable band), `loadBookableSlots(db, branchId, from, to)` with roster rows, `loadTraineeRosterRows(db, userId)`. `getMyScheduleAction` calls `materializeBookableSlots` for the branch first. `bookSlotAction`: rate limit, session, slot load, rules (Task 2), then `db.rpc("book_slot", …)`, map exceptions (`capacity_full`, `already_booked`, `slot_not_bookable`) to Hebrew, `revalidatePath("/dashboard/schedule")` and `/admin/schedule`. `cancelBookingAction`: own not-cancelled row, `cancelState`, update `cancelled_at`, `late_cancel`.

- [ ] Commit `feat(booking): trainee schedule, book, and cancel actions`.

### Task 5: Trainee UI

**Files:** Create `src/app/dashboard/schedule/page.tsx`, `src/features/booking/components/{PlanStrip,MyBookings,DateStrip,DaySlots,BookConfirmSheet,CancelSheet,NextTrainingCard}.tsx`; modify `src/lib/navigation/dashboard-nav.ts`, `src/app/dashboard/layout.tsx` (compute `canBook` and filter nav), `src/app/dashboard/page.tsx` (NextTrainingCard).

- [ ] Nav: `{ href: "/dashboard/schedule", label: "אימונים", icon: CalendarCheck, mobilePrimary: true, mobileOrder: 2, requires: "booking" }`; layout filters items with `requires` when `canBook` is false (`canBook` = trainee has a branch with a bookable band; one cached query).
- [ ] Page: server component loads `getMyScheduleAction()`; client `ScheduleClient` holds selected date (default today or first day with slots), renders `PlanStrip`, `MyBookings`, `DateStrip`, `DaySlots`; sheets use `SheetDialogContent`; `useTransition` + toast + `router.refresh()`.
- [ ] Home card: next booking or the empty prompt; hidden when `!canBook`.
- [ ] Commit `feat(booking): trainees book their trainings from the app`.

### Task 6: Staff board

**Files:** modify `src/components/admin/schedule/SlotCard.tsx`, `SlotFormDialog.tsx`, `src/lib/validations/schedule.ts` (`maxTrainees` optional on slot form), `src/lib/actions/daily-schedule-mutate.ts` (write it; `replace_slot_roster` must preserve `source/booked_at/cancelled_at/late_cancel` for rows it keeps: rewrite the RPC to upsert by `(slot_id, trainee_id)` for linked rows and delete only rows absent from the new list), `src/lib/utils/schedule-text.ts` (skip cancelled), `src/components/admin/schedule/week/WeekSlotCard.tsx` (seat count), `src/features/plans/components/staff/PlanSheet.tsx` (this week's bookings).

- [ ] Roster display: active rows only in chips; late-cancelled rows as struck chips "ביטול מאוחר"; self-booked chip icon `CalendarCheck`; header "5/8" when `max_trainees`.
- [ ] Form: "מקומות" number field shown when the slot has `max_trainees`; over-capacity note.
- [ ] Commit `feat(schedule): seats, self-booked chips, and late cancels on the board`.

### Task 7: Reminders and copy

**Files:** modify `src/lib/whatsapp/plan-templates.ts` (`sendBookingReminder`), `src/features/booking/lib/reminders.ts` (new), cron route from Task 3, `content/landing-kiryat-ata.ts` (FAQ override for `faq-14` stays true; Haifa gets an override "דרך הצוות בוואטסאפ"), `docs/superpowers/specs/2026-09-11-self-booking-design.md` (template wording), `src/lib/env.ts` (`WHATSAPP_BOOKING_REMINDER_TEMPLATE_NAME` optional), CLAUDE.md.

- [ ] Reminder: tomorrow's not-cancelled self bookings without `reminded_at`; send to the trainee's login phone; stamp.
- [ ] Commit `feat(booking): day-before reminder and landing copy`.

### Task 8: Verification and delivery

- [ ] tsc, lint, tests, build; security + code review agents on `git diff main...HEAD`; fix; push; PR; merge; watch deploy.
- [ ] Owner: mark bookable bands and seats on `/admin/weekly-schedule`; submit `booking_reminder` to Meta; smoke test as a Kiryat Ata trainee (needs a trainee with an active plan).
