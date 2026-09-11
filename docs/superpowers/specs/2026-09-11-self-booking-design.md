# Self-booking for קריית אתא trainees

Date: 2026-09-11. Builds on `2026-09-10-kiryat-ata-signup-design.md`
(plans) and `2026-09-11-staff-payments-design.md`. Amends ADR-0003 for one
branch (see `docs/adr/0007-self-booking-kiryat-ata.md`).

## Problem

Kiryat Ata trainees buy a plan in the app and are told "קובעים אימונים דרך
האפליקציה", but the app has no schedule surface for a trainee: no route,
no navigation entry, no read access to slots, no reminders. Staff type
every roster by hand. חיפה keeps that model; קריית אתא needs the trainee
to pick their own slots within what they paid for.

## Decisions made with the owner

- Only קריית אתא. חיפה's board stays staff-authored and hand-built.
- A trainee books dated slots (not a standing weekday registration).
- Eligibility: an active plan on the slot's date with a session left; an
  expired or used-up plan shows the renewal button instead of "book".
- A monthly subscription (and the 4-month term) allows 2 bookings per
  week, Sunday to Saturday. Cards are limited by sessions left.
- Booking window 14 days ahead; cancellation until 3 hours before the
  slot. A late cancel or a no-show still counts as a used session.
- Default capacity 8 per band, editable on the weekly page.

## Section 1: Data model

### `weekly_schedule_bands`

- `max_trainees SMALLINT NOT NULL DEFAULT 8 CHECK (max_trainees BETWEEN 1 AND 40)`
- `is_bookable BOOLEAN NOT NULL DEFAULT false`: this band's slots accept
  self-booking. Staff set it per band; חיפה bands stay false.

### `daily_schedule_slots`

- `band_id UUID REFERENCES weekly_schedule_bands(id) ON DELETE SET NULL`:
  provenance, so materialization can tell which bands a day already has.
- `max_trainees SMALLINT CHECK (max_trainees IS NULL OR BETWEEN 1 AND 40)`:
  copied from the band when materialized or built. Null means "staff
  only", which is every חיפה slot and any slot staff create by hand
  without a band. A slot is bookable when `max_trainees` is set, its date
  is inside the window, and its branch is the trainee's.
- Index on `(band_id, schedule_date)`.

### `daily_schedule_slot_trainees`

- `source TEXT NOT NULL DEFAULT 'staff' CHECK (source IN ('staff', 'self'))`
- `booked_at TIMESTAMPTZ`: when the trainee booked.
- `cancelled_at TIMESTAMPTZ`: a self-cancel keeps the row so a late
  cancel can still count. Rows with `cancelled_at` set do not occupy a
  seat and do not appear on the board roster; they show as a struck
  "ביטול מאוחר" chip when `late_cancel` is true.
- `late_cancel BOOLEAN NOT NULL DEFAULT false`: cancelled inside the
  3-hour cutoff.
- The existing partial unique index `(slot_id, trainee_id)` stays the
  double-tap guard. A cancelled row is reused by a re-book (set
  `cancelled_at = NULL, late_cancel = false, booked_at = now()`), so the
  index never blocks a second booking of the same slot.

### RLS

Unchanged. Trainees keep no direct access to slot tables. Every trainee
read and write goes through a server action that proves the session and
then uses the service role, the pattern `loadOwnPlanWithUsage` already
uses because the roster tables are staff-only. This keeps the board's
RLS story simple and puts every rule in one place.

### Plan usage

`countSessionsUsedFromRows` counts roster rows in the window up to today
that are either not cancelled or late-cancelled. `countReservedFromRows`
(new) counts future, not-cancelled rows in the window: sessions the
trainee has promised to use. Eligibility for a card is
`sessions_total - used - reserved >= 1`. A booking on a past date is not
possible, so nothing is charged retroactively.

## Section 2: Materialization for קריית אתא

`materializeBookableSlots(db, branchId, today)` runs in a daily cron
(`/api/cron/materialize-slots`, 03:30 Israel) and on demand from the
trainee schedule page (cheap: it only inserts what is missing). For every
date from today to today + 14 and every band with `is_bookable` in that
branch, it derives on-duty staffing with `deriveOnDuty` (absences and
extras respected) and inserts a slot with `band_id`, the band's trainer,
location, label as focus, `max_trainees`, and no roster, unless a slot
with that `band_id` already exists on that date. Standby bands are never
materialized. A slot staff deleted is not recreated: deletion writes a
`daily_schedule_slot_tombstones (band_id, schedule_date)` row and the
materializer skips it. Staff can still build, duplicate, edit, and delete
exactly as today; a hand-made slot on the same day coexists.

This is the one departure from ADR-0003: for a bookable branch the week
is projected forward so that there is something to book. חיפה has no
bookable bands, so nothing changes there.

## Section 3: Booking rules

`bookSlotAction(slotId)` and `cancelBookingAction(slotId)` are trainee
actions (`verifyUserAccess`-style session check, then service role):

1. Slot exists, `max_trainees` set, `schedule_date` between today and
   today + 14, and its `start_time` on today is at least 1 hour away.
2. The trainee belongs to the slot's branch (`profile_branches`).
3. The trainee's relevant plan (`pickRelevantPlan`) is not cancelled and
   runs on the slot's date (`starts_on <= date <= ends_on`), and the
   product is not an add-on.
4. Card kinds (`session_card`, `intro_pack` via `once_per_trainee` is
   still a card): `sessions_total - used - reserved >= 1`.
5. Subscription and term kinds: fewer than 2 not-cancelled rows for the
   trainee in the slot's Sunday-to-Saturday week in that branch, counting
   staff-added rosters too.
6. Capacity: seats taken = rows with `cancelled_at IS NULL`; must be less
   than `max_trainees`. Checked inside one Postgres function
   `book_slot(p_slot_id, p_trainee_id, p_trainee_name)` that locks the
   slot row (`SELECT ... FOR UPDATE`), re-counts, and inserts or reuses a
   cancelled row. Two parents tapping the last seat at once cannot both
   win. The duplicate index is the backstop.
7. Cancel: sets `cancelled_at`; `late_cancel = true` when now is within
   3 hours of the slot's date and time in Israel. A late cancel shows the
   cost before confirming.

Staff on the board are not bound by capacity or eligibility: they may
add a ninth child or a trainee with no plan, as today. The card shows the
count so they know they are overriding.

Rate limit: a `booking` limiter, 20 per 10 minutes per user, fail open.

## Section 4: Trainee UX

**Navigation.** New primary tab "אימונים" (`/dashboard/schedule`) for
trainees whose branch has bookable bands; hidden otherwise, so חיפה sees
no change. The dashboard home gets an "האימון הבא" card: next booking
with time, trainer, location, and a cancel link; or "עדיין לא נרשמת
לאימון השבוע" with a button.

**Schedule page.** Phone-first. A plan strip at the top: plan name,
sessions left or "2 אימונים השבוע: 1 נוצל", and the renewal button when
the plan blocks booking. Then "האימונים שלי": upcoming bookings as cards.
Then a 14-day strip of dates (Sunday to Saturday, two weeks) with a dot
on days that have open slots; tapping a day lists its slots as cards:
time, trainer, group label, location, "נותרו 3 מקומות" or "מלא", and a
"הרשמה" button or a "רשום" state. Tapping "הרשמה" opens a confirm sheet
that restates the slot and what it costs ("ינוצל אימון אחד מהכרטיסייה,
יישארו 6" or "אימון 2 מתוך 2 השבוע") with one button. Success is a toast
and the card turns to "רשום"; the booking appears in "האימונים שלי".

**Cancel.** From the booking card. Before the cutoff: a plain confirm.
Inside the cutoff: the sheet says "ביטול מאוחר: האימון ייחשב כמנוצל" and
requires a second tap. After the slot started: no cancel.

**Blocked states** are explained, never silent: "המסלול פג ב-3.10, חדשו
כדי להירשם" (button), "נוצלו כל האימונים בכרטיסייה" (button), "הגעת ל-2
אימונים השבוע", "האימון מלא", "ההרשמה נסגרת שעה לפני האימון".

**Reminder.** WhatsApp the day before at 18:00 Israel to the trainee's
login phone: "מחר ב-16:00 עם לידור, מגרש קריית אתא. לביטול: קישור".
Template `booking_reminder` (pending Meta). Sent by the same cron as the
materializer, stamped `reminded_at` on the roster row.

## Section 5: Staff UX

- Weekly page, band form: "פתוח להרשמה עצמית" switch and "מקומות" number
  (default 8), shown on the band card as "8 מקומות · הרשמה עצמית".
- Daily board, slot card: "5/8" seat count on bookable slots; self-booked
  chips carry a small calendar-check icon; late-cancelled chips are
  struck through with "ביטול מאוחר"; the plan sheet (from the chip) shows
  the trainee's bookings this week.
- Staff adding a trainee to a bookable slot past capacity see "מעבר
  לקיבולת (9/8)" on the form, not a block.
- Slot form: a "מקומות" field on slots that have one; staff may raise it
  for one day.
- Dated week view: seat counts per slot; days materialized from bookable
  bands show a "הרשמה עצמית" marker so a trainer knows rosters fill
  themselves.

## Section 6: Error handling

Every rule returns a Hebrew message that names the fix. `book_slot`
raising `capacity_full` maps to "האימון התמלא רגע לפני". A `23505` from
the duplicate index maps to "כבר נרשמת לאימון הזה". The materializer logs
and continues per band; one bad band never blocks the day. Reminders are
best-effort and stamped only on success.

## Section 7: Testing

Pure: `isBookable(slot, today)`, `bookingWindow`, `cancelCutoff(slot,
now)`, `weeklyBookingCount(rows, date)`, `countReservedFromRows`,
`bookingEligibility(plan, product, used, reserved, weekCount)` with every
blocked state, `materializationPlan(bands, exceptions, existing,
tombstones, dates)` returning the rows to insert. Existing
`countSessionsUsedFromRows` tests extended for cancelled and late rows.
The SQL function is exercised by hand in the sandbox before launch.

## Out of scope

Waitlists, standing weekly registration, trainers editing capacity from
the board, booking on behalf of a sibling, push notifications, חיפה.

## Dependencies on the owner

Mark which קריית אתא bands are bookable and confirm 8 seats; approve the
`booking_reminder` template wording for Meta; confirm the 1-hour close
before a slot for new bookings.
