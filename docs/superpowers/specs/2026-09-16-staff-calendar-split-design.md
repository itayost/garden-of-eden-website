# Staff calendar split: rostering and session building

Date: 2026-09-16. Builds on `2026-09-11-self-booking-design.md`. Touches
the surfaces described in ADR-0002, ADR-0003 and ADR-0007; none of their
decisions change.

## Problem

`/admin/schedule` does two jobs on one screen. Staff create and edit
Slots and their Rosters there, and every linked name on a slot card is
also the entry point to that Trainee's Training session builder. In חיפה
this is tolerable because staff type the roster and then build sessions
in one sitting. In קריית אתא trainees book themselves, so the same board
fills with names staff never added, and the screen reads as neither a
booking calendar nor a building list. The owner wants it to work like
Arbox: one screen to put trainees into slots, a separate one to build
their sessions.

## Decisions made with the owner

- Staff get two screens: a booking calendar (who is in which slot) and a
  session-building list (what each rostered trainee does).
- The split applies to both branches. One set of screens, no branch fork.
- The calendar is a day view with a date strip on phones and a week grid
  on desktop.
- The "השבוע הזה" tab on the weekly page is removed; the calendar's week
  grid replaces it. The weekly page keeps the standing template and the
  exceptions.

## Section 1: Routes and navigation

| Route | Screen | Nav label |
|-------|--------|-----------|
| `/admin/calendar` (new) | Booking calendar | יומן |
| `/admin/schedule` (repurposed) | Session-building list | בניית אימונים |
| `/admin/schedule/session/[traineeId]` | Session builder (unchanged) | - |
| `/admin/weekly-schedule` | Standing template + exceptions | לוח שבועי |

`/admin/schedule` keeps its URL so existing bookmarks and the session
builder's back link still land somewhere sensible. Nav order in the
"תפעול" section: יומן, בניית אימונים, לוח שבועי. Both pages use
`verifyAdminOrTrainer()` and the existing branch scope resolution
(`getBranchScopeAction`, `resolveRequestedBranch`, `BranchProvider`).

URL state: `/admin/calendar?date=YYYY-MM-DD&branch=<id>`. The week grid
shows the Sunday-to-Saturday week containing `date`, so one URL serves
both layouts and switching device width keeps the same day in view.
Invalid or out-of-range dates fall back to today, with the same
`MAX_WEEK_OFFSET_DAYS` bound the weekly page uses.

`revalidateScheduleSurfaces()` revalidates `/admin/calendar` and
`/admin/schedule`. `/admin/weekly-schedule` is dropped from it, because
after Section 4 that page no longer renders slots.

## Section 2: Booking calendar (`/admin/calendar`)

### Data

Server page loads, in parallel, for the visible week and branch:
`getSlotsForWeekAction(weekStart, branchId)`, the bands and exceptions
already used by `buildWeek`, `getSlotFormOptionsAction(branchId)`, and
`loadPlanStatusesForStaff(rosterIds)` for every linked trainee in the
week. The day view on a phone reads the selected day out of the same
week payload, so moving along the date strip within the week needs no
round trip; moving to another week changes `?date=`.

### Header

Branch switcher, previous/next (a day on phones, a week on desktop),
"היום", the safety-protocol shortcut, and the day actions moved from the
current board: "סלוט חדש", copy WhatsApp, duplicate day (admin), build
day from the weekly schedule (admin, when bands exist). On desktop the
week-level "build week" button from `BuildWeekButton` sits here too.
The `OnDutyStrip` shows for the selected day.

### Phone layout (below `md`)

- A 7-day strip (Sunday to Saturday; Saturday only when it holds a slot
  or an extra, as the current week view does). Each day shows weekday,
  date, and a dot when it has slots. Today and the selected day are
  visually distinct.
- Below it, the selected day's slots grouped by start time on the
  existing timeline rail.

### Desktop layout (`md` and up)

A 7-column week grid, reusing `WeekDayColumn` with a calendar variant of
`WeekSlotCard`. A day header click selects that day (updates `?date=`).

### Calendar slot card

Time, trainer name in `trainerColor`, location, focus, and occupancy:
`active/max` when `max_trainees` is set, otherwise the active count.
Over capacity renders in destructive colour. A trainer-absent flag shows
as today on `WeekSlotCard`. A slot with an empty roster shows "אין
רשומים" rather than looking broken. The card carries no session status
and no link to the session builder.

### Roster panel

Tapping a slot opens a sheet (side on desktop, bottom on phones):

- Header: time, trainer, location, occupancy, edit and delete buttons.
  Edit opens `SlotFormDialog` for slot details; delete uses the existing
  confirmation.
- Roster list: each entry shows the name, a "נרשם בעצמו" icon when
  `source = 'self'`, the plan chip (פג / מסתיים, opens `PlanSheet`), the
  medical icon (opens `HealthSheet`), and a remove button. Late cancels
  are listed separately, struck through, with no remove button.
- Add: the same trainee search as the slot form (branch trainees, free
  text allowed). When the add would exceed `max_trainees` the button
  still works and a warning line says so; staff may over-fill (ADR-0007).
  A trainee already on the roster is not offered.

### Roster writes: per entry, not whole list

Today `updateSlotAction` replaces the whole roster through
`replace_slot_roster`. If a trainee books while a staff member's form is
open, saving that stale list deletes the booking. The panel therefore
uses two new actions in `src/lib/actions/daily-schedule-roster.ts`:

- `addSlotTraineeAction({ slotId, traineeId | null, name })`:
  `verifyAdminOrTrainer`, UUID validation, slot exists and is branch-
  readable, `verifyRosterTrainees` for a linked id, rejects a duplicate
  active linked trainee, reinstates a cancelled row for the same trainee
  instead of inserting a second one, appends with the next `order_index`,
  `source = 'staff'`.
- `removeSlotTraineeAction({ rosterEntryId })`: same guards, deletes the
  row. A staff removal is not a cancellation and does not count as a
  used session. A late-cancel row cannot be removed here, so usage
  history stays intact.

Both return the standard `{ success, data } | { error }` shape with
Hebrew messages and call `revalidateScheduleSurfaces()`. RLS already
allows staff writes to `daily_schedule_slot_trainees`, so no migration.

`SlotFormDialog` keeps its roster field for creating a slot (the create
flow is unchanged). When editing an existing slot from the calendar it
edits slot details only and does not send the roster, so it cannot
overwrite concurrent bookings. `updateSlotAction` gains an optional
roster: absent means leave it alone.

## Section 3: Session-building list (`/admin/schedule`)

### Data

For the selected date and branch: `getScheduleAction(date, branchId)`
and `getSessionSummariesAction(date)`. Rows are derived by a pure
function `buildSessionWorklist(slots, summaries, currentUserId)` in
`src/lib/schedule/session-worklist.ts`, which returns one row per
active, linked roster entry: trainee id and name, slot id, start time,
trainer id and name, and a status of `not_built`, `built` (with
exercise count) or `completed`. Free-text entries and cancelled entries
are excluded. A trainee on two slots that day appears once per slot,
both rows pointing at the same session (sessions are per trainee per
day).

### Layout

- Header: date navigation, "היום", branch switcher. No slot actions.
- Progress line: "5 מתוך 12 נבנו" (built or completed over total rows).
- Filters, kept in the URL (`?mine=1`, `?pending=1`): "רק שלי" (slot
  trainer is the viewer) and "רק לא נבנו". Both default off.
- Rows grouped by start time, then by slot (trainer colour header). Each
  row is a full-width link to
  `/admin/schedule/session/[traineeId]?date=&slot=` with the trainee's
  name, the status chip, and the plan and medical icons.
- Empty day: "אין סלוטים ליום זה" with a button to
  `/admin/calendar?date=&branch=`. Slots with no linked trainees: "אין
  מתאמנים לבנות להם אימון" with the same link.
- Load error renders an error card, never an empty day.

`SessionBuilder`'s back link keeps pointing at `/admin/schedule?date=`,
now with `&branch=`.

## Section 4: Weekly page

`WeeklySchedulePageClient` drops the tabs and renders the template view
with the exceptions panel. The page stops loading slots and week
exceptions. `DatedWeekView` is deleted; the calendar's week grid is
built from `WeekDayColumn` directly. The link in
`OnDutyStrip` to `/admin/weekly-schedule` stays.

## Section 5: Components and files

New:
- `src/app/admin/calendar/page.tsx`, `loading.tsx`
- `src/components/admin/calendar/CalendarView.tsx` (header, layout switch)
- `src/components/admin/calendar/DateStrip.tsx`
- `src/components/admin/calendar/CalendarDayList.tsx`
- `src/components/admin/calendar/CalendarWeekGrid.tsx`
- `src/components/admin/calendar/CalendarSlotCard.tsx`
- `src/components/admin/calendar/RosterSheet.tsx`
- `src/lib/actions/daily-schedule-roster.ts`
- `src/lib/schedule/session-worklist.ts` + test
- `src/components/admin/schedule/SessionWorklist.tsx`

Changed:
- `src/app/admin/schedule/page.tsx` renders `SessionWorklist`
- `src/app/admin/weekly-schedule/page.tsx`, `WeeklySchedulePageClient.tsx`
- `src/lib/navigation/admin-nav.ts`
- `src/lib/actions/shared/revalidate-schedule.ts`
- `src/lib/actions/daily-schedule-mutate.ts`, `src/lib/validations/schedule.ts`
  (optional roster on update)
- `SlotFormDialog.tsx` (no roster on edit)
- `WeekDayColumn.tsx` links to `/admin/calendar?date=`

Removed once unused: `ScheduleDayView.tsx`, `SlotCard.tsx`,
`DatedWeekView.tsx`. Existing files over 400 lines are not grown.

## Section 6: Testing

Unit (Vitest, pure functions, written first):
- `buildSessionWorklist`: excludes free-text and cancelled entries,
  status mapping including completed, a trainee in two slots, "mine"
  and "pending" filters, sort by time then slot.
- Calendar date resolution: `?date=` fallback and bounds, week start for
  any weekday, Saturday visibility rule.
- Roster add decision: duplicate linked trainee rejected, cancelled row
  reinstated, over-capacity allowed with a warning flag.

Manual smoke on a preview deploy, both branches, phone width and
desktop: create a slot, add and remove trainees, see a self-booked
trainee appear, over-fill warning, build a session from the list and
return, filters, WhatsApp copy, duplicate day, build day and week.

`npx tsc --noEmit`, `npm run lint`, `npm run test:run` (the 20 known
localStorage failures in goals and streak-tracking are baseline).

## Out of scope

- Waitlists, recurring staff registrations, drag-and-drop between slots.
- Any change to trainee self-booking, booking rules, or reminders.
- Any database migration.
