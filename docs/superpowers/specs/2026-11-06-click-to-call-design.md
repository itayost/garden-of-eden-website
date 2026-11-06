# Click-to-call with a documentation reminder (issue #164)

Approved by Itay on 2026-11-06 ("Yes, with defaults").

## Why

Eden asked for a call button in leads and in customer retention. When a trainer taps it and a few minutes pass with no update on the call, the trainer should get an alert that the lead was not closed properly. Eden fixed the details: 10 minutes, documenting the call cancels the alert, and the button opens a call from the trainer's own phone.

## Goals

- A call link next to every phone number in leads and in the three monthly retention tabs (מנויים, פרו, כרטיסיות). It opens the trainer's phone dialer (`tel:`).
- Each tap records a call attempt on the server: who tapped, whom, when.
- 10 minutes after the tap, if that trainer has not documented the call, a reminder appears to that trainer on whatever admin screen is open.
- Documenting the call cancels the reminder. Nothing else does, except the trainer saying no call took place.
- Retention gets a real call log, since its notes are not one.

## Non-goals

- No telephony provider, no call recording, no detection of an answered or finished call. The attempt starts at the tap.
- No phone push notifications and no background delivery. A closed browser sees the reminder the next time the dashboard opens. This must be said plainly to Eden.
- No paid service.
- The "לקוחות שעזבו" tab is out: its rows are typed by hand and have no phone number.
- No change to who can see which lead or customer.

## Anti-goals

- A reminder that never goes away after a mistaken tap.
- A reminder that stays after the call was documented successfully.
- A note edit, color change, status change or trainer reassignment silently cancelling a reminder.
- Showing a trainer a customer outside their branches.

## Behavior

### The call link

- Shown wherever a lead's phone is shown: the desktop table's phone column, the phone card list, and the lead sheet header. In retention, a new column shows the phone with the link, for rows that have a phone Arbox recognizes.
- `href` is `tel:+972XXXXXXXXX` from `normalizePhoneIL()`. A phone that does not normalize gets no link, only the text.
- Tapping it does not open the lead sheet (`stopPropagation`). On the phone card list, today each card is one `<button>`; the link must sit beside that button, not inside it.
- On tap the link starts the attempt without waiting; the dialer opens either way. If saving the attempt fails, a toast says "התזכורת לתיעוד השיחה לא נשמרה".

### The attempt

- Stored server-side with the database clock, so reloads, navigation and switching devices keep it.
- Repeat taps on the same person while an attempt is open (not documented, not dismissed) do not start a new one. The reminder is 10 minutes after the first undocumented tap, so re-tapping cannot postpone it.
- Two taps that race may both insert. That is harmless: reminders are shown once per person.
- Only the trainer who tapped is reminded, and only their own attempts are ever read back.
- Attempts older than 7 days stop reminding (Claude's call: a week-old nag helps nobody).

### Documented or not (derived, never stored)

An attempt is documented when a log entry exists that was written by the same trainer, for the same person, at or after the attempt started:

- Lead: any `lead_contact_log` entry for that lead by that trainer (any outcome, including "לא ענה"), except `message_sent`, which sending a WhatsApp writes by itself. This needs `lead_contact_log.author_id`, which a trigger takes from the session (the table's policy lets staff write rows directly); an update cannot change an entry's author, lead or time. Old rows keep NULL.
- Retention: any `retention_call_log` entry for that phone by that trainer.

Because nothing is written to the attempt on documentation, a successful save can never leave a stale reminder, and a failed save leaves it in place.

A documentation entry written by another trainer does not cancel this trainer's reminder: the one who called is the one asked to record it.

Claude's calls, from the builder check: admins who tap get reminders too, exactly like trainers; closing a deal or changing a lead's status does not cancel a reminder, since only documentation (or "לא התקיימה שיחה") does.

### The reminder

- A client watcher mounted once in `src/app/admin/layout.tsx` asks the server for the trainer's reminders:
  - on page load;
  - when the tab becomes visible or the window gets focus (coming back from the dialer);
  - every 60 seconds while the page is open;
  - at the exact due time of the earliest open attempt the server reports (`nextDueAt`), so it does not wait for the next minute.
- It also refreshes when a call link starts an attempt and when a call is documented on the page (window events).
- Due reminders show as a fixed card at the bottom of the screen (staff shell has no bottom nav), one row per person: the name, "לא תיעדת את השיחה", how long ago the tap was, and two buttons:
  - "תיעוד" opens a dialog with the documentation form right there: for a lead the existing contact-log form with the type preset to "שיחה"; for retention the new retention call form.
  - "לא התקיימה שיחה" dismisses every open attempt of this trainer for that person (records `dismissed_at`).
- `role="status"`, readable on a 320 px phone, Hebrew, RTL, logical properties.

### Retention call log

- New column "שיחה" in the retention table: the phone as a call link and a "תיעוד שיחה" button.
- The button opens a dialog: outcome (required, the four lead outcomes: מעוניין, לא מעוניין, חזרה, לא ענה), a note (optional, up to 2000 characters), save; under it, the history of call entries for that phone (newest first, author and time).
- Stored with the report month it was written from, the normalized phone, the name and the author.
- Note and color editing, trainer assignment and "move to churned" are untouched.

## Data

Migration `20261106140000_call_reminders.sql`, expand only, applied before the code deploys:

- `call_attempts`: id, `caller_id` (profiles, cascade), exactly one target (`lead_id` with cascade, or `report_month` + `trainee_phone` in E.164), `contact_name`, `started_at` (default now()), `dismissed_at`. Index on `(caller_id, started_at)` for open attempts.
- `retention_call_log`: id, `report_month`, `trainee_phone` (E.164 CHECK), `trainee_name`, `author_id` (profiles, set null), `outcome` (`lead_contact_outcome` enum, not null), `notes` (<= 2000), `created_at`. Index on `(trainee_phone, created_at desc)`.
- `lead_contact_log.author_id` (profiles, set null), nullable.
- Both new tables: RLS on, no policies, no grants to anon or authenticated. Read and written only by server actions with the service role, behind `verifyAdminOrTrainer()`.
- No partial unique index (PostgREST upserts cannot target one; repeat taps are handled in code).

## Access

- Leads keep today's rule: any admin or trainer (`verifyAdminOrTrainer`). Starting an attempt checks the lead exists and takes its name from the database.
- Retention keeps the branch rule on every new path: start an attempt, write a log entry, read a phone's history. `callerVisiblePhones()` and `assertPhoneInScope()` move from `admin-retention.ts` into a `server-only` module so the new actions can share them without exposing them as server actions.
- Reminders, dismissals and documentation lookups are filtered by `caller_id` / `author_id` = the signed-in user.

## Code layout

`src/features/call-reminders/`:

- `lib/rules.ts` (pure, tested first): the delay and window constants, `telHref()`, and `reminderState(attempts, documentation, now)` returning the due reminders (one per person, earliest attempt) and `nextDueAt`.
- `lib/validations.ts`: the call target and retention log schemas.
- `lib/actions/`: start attempt, get reminders, dismiss; add and list retention call log entries.
- `components/`: `CallLink`, `CallReminderWatcher`, the reminder card, `RetentionCallDialog`.

## Testing

- Unit tests for `rules.ts` and the schemas: not due before 10 minutes, due at 10, documented by a later entry from the same trainer, not by an earlier one or by another trainer, dismissed attempts gone, older than 7 days gone, one reminder per person, `nextDueAt`, `telHref` formats.
- Browser checks for the issue's acceptance list: the right number in the dialer from both areas, no reminder before 10 minutes, a reminder at 10, documentation clears it, a note or color change does not, a failed save keeps it, repeat taps, navigation and reload.

## Left to the builder

Component structure, polling details, exact copy beyond the strings above, and whether the retention cell shows a last-call hint.

## Rollout

Push the migration before merging (the code reads the new tables and column), run `npm run db:types`, then merge. Tell Eden the reminder appears only inside the dashboard.
