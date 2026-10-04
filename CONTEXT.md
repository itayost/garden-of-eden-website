# Garden of Eden

A football academy platform. Trainees train and are assessed, trainers run the sessions and the day-to-day operation, and an admin manages both.

## Language

### People

**Trainee**:
A player enrolled in the academy. The subject of assessments, nutrition plans and workouts.
_Avoid_: Player, athlete, student, user

**Trainer**:
A member of staff who runs sessions and works shifts.
_Avoid_: Coach, instructor

**Admin**:
The person who manages the whole academy, across every branch — creates trainees, assigns work to trainers, and reviews what was done.
_Avoid_: Manager (bare), owner, staff

**Branch manager**:
A member of staff with an Admin's powers over the branches they manage, and none over the others. Every Admin sees what a Branch manager does.
_Avoid_: Admin, manager (bare), branch admin

**Lead**:
A prospective customer who has not enrolled. Not a Trainee and not an account holder.
_Avoid_: Prospect, enquiry

### Assigned trainer

The phrase "assigned trainer" means three different things depending on what it hangs off, so it is never used bare.

**Assignee**:
The single Trainer responsible for carrying out a Task.
_Avoid_: Owner, assigned trainer, responsible trainer

**Lead owner**:
The Trainer responsible for following up a Lead.
_Avoid_: Assigned trainer

**Retention owner**:
The Trainer responsible for a Trainee's retention for a given month.
_Avoid_: Assigned trainer

There is no general Trainer-to-Trainee relationship in this academy. Any Trainer may work with any Trainee, and none of the three roles above changes who can see what.

### Daily operations

**Task**:
A unit of operational work an Admin gives to exactly one Trainer, with a due date. Staff work — fixing a net, calling a parent, ordering equipment.
_Avoid_: Todo, job, assignment, chore

A Task is never training content. Work prescribed _to a Trainee_ is a Workout, a Program or a Drill, and those are separate concepts.

**Linked trainee**:
A Trainee named on a Task as its subject. Context for staff only — it grants the Trainee nothing and the Trainee never sees the Task.
_Avoid_: Assigned trainee, task owner

**Overdue**:
A Task that is still open after its due date has passed, measured against the calendar date in Israel.
_Avoid_: Late, expired, missed

**Acknowledgement**:
The Admin's explicit confirmation that they have reviewed a closed Task. Not an approval — the Task is already closed, and acknowledging it neither completes nor gates anything.
_Avoid_: Approval, sign-off, review

**Reopening**:
The Admin returning a closed Task to open because the work was not actually done.
_Avoid_: Rejecting, declining

**Daily brief**:
One free-text note per calendar day, written by any staff member — Admin or Trainer — and read by all staff. Shared, not per-author: the second person to write today's brief rewrites the first one's. General announcements only — the day's structure lives in the Daily schedule, not here.
_Avoid_: Announcement, memo, bulletin, notice

**Daily schedule**:
The structured plan for one calendar day, made of Slots. Admin-authored; the WhatsApp schedule message is generated from it, never the reverse.
_Avoid_: Timetable, calendar, לו"ז (in code)

**Slot**:
One group at one hour: (date, hour, Trainer, Focus, location, Roster). Two trainers at the same hour are two Slots.
_Avoid_: Class, session, lesson

**Weekly schedule**:
The standing weekly staffing pattern, made of Bands. It says who covers which stretch of a Sunday, not who is on this coming Sunday — it names no date and expires on none. The Daily schedule is still authored per day; the Weekly schedule only tells it who is around.
_Avoid_: Rota, timetable, לו"ז (in code)

**Band**:
One stretch of one weekday a Trainer covers: (weekday, start, end, Trainer, location, label). Two Trainers on the same stretch are two Bands, the same way two Trainers at one hour are two Slots. An open-ended Band ("18:00 והלאה") has no end and runs to the end of the day.
_Avoid_: Shift — that is time already clocked; Slot — that is a dated group

**Standby**:
A Band the Trainer covers only if called in ("חיזוק במידת הצורך"). It shows in the day's staffing but never seeds a Slot, because nobody has yet decided it is happening.
_Avoid_: Backup, on-call, reserve

**Exception**:
A dated deviation from the standing week: a Trainer absent for one date, or an extra one-off Band on one date. A swap is one of each. Exceptions never edit the Weekly schedule — next week is unaffected.
_Avoid_: Override, absence (that is only one of the two kinds)

**On duty**:
The staffing actually in force on one date — that weekday's Bands with that date's Exceptions applied. Derived on read and never stored, so it cannot drift from the Bands it comes from.
_Avoid_: Assignment, rota, today's shift

**Focus**:
The free-text training theme of a Slot, e.g. "זריזות מהירות טכניקה עם כדור".
_Avoid_: Topic, subject, theme

**Roster**:
The list of names in a Slot. An entry may link to a Trainee account or be a free-text name that has no account; only linked entries can receive Training sessions.
_Avoid_: Attendance — that is who actually showed up; the Roster is who is planned

**Training session**:
The per-Trainee exercise plan for one calendar day, built by a Trainer from the exercise library. Not a Slot (the group plan) and not a Program (a multi-week template used only as a copy source).
_Avoid_: Workout (bare), session (bare), assigned program

**Session template (תבנית אימון)**:
A named, reusable single-day exercise list with its targets, saved from a Training session and loadable into any Trainee's day. Carries the numeric targets and the Equipment link, so it comes back exactly as it was saved. Staff-only and never assigned — what a Trainee sees is the Training session built from it. Not a Program: a Program is a multi-week grid.
_Avoid_: תוכנית, program, plan, preset

**Equipment**:
A machine or station in the studio, catalogued with a permanent code printed as a QR sticker. Scanning it opens the Trainee's log form for the matching exercise.
_Avoid_: Machine, device, gear

**Measure**:
One of the five things the studio records: sets, reps, weight, time, distance. Each Equipment declares which of them it measures, and that decides which fields appear in the Trainee's log form. Physical, so an exercise cannot override it: a jump rope has no weight stack.
_Avoid_: Metric, dimension, field

**Performance profile**:
The Measures an Equipment records, its starting numbers, and for weight its stack (minimum, maximum, increment). Read by the Trainer's session builder and the Trainee's log form.
_Avoid_: Settings, config

**Inherit**:
An exercise with no default of its own takes the Equipment's. NULL means inherit, per Measure and independently — an exercise may override the weight and inherit the reps. An exercise with no Equipment inherits nothing and shows sets, reps and weight.
_Avoid_: Fallback, cascade, default (bare)

**Exercise log**:
What a Trainee actually did on one exercise — sets, reps, weight. One row per exercise, a record that is corrected in place, never deleted. Distinct from the targets a Trainer prescribes.
_Avoid_: Result, entry, submission

**Completion**:
The Trainee's own act of finishing a Training session, after every exercise has an Exercise log. Sets the session's completed timestamp; visible to staff on the schedule.
_Avoid_: Approval (staff play no part in it)

### Shifts

**Shift**:
A period a Trainer worked, bounded by a clock-in and a clock-out.
_Avoid_: Session, workday

**Shift period**:
Whether a Shift is a morning or a regular one. Friday has no morning shift.

**Shift report**:
The structured end-of-day form a Trainer fills in about their Shift. Distinct from the Daily brief: a report is one Trainer's own record of a day that has ended, the brief is the whole staff's shared note for the day ahead.

### Training

**Assessment**:
A dated set of physical measurements taken for a Trainee.
_Avoid_: Test, evaluation, measurement

**Development book**:
The library of drills and training material.
_Avoid_: Playbook, curriculum

**Course**:
The digital video course. A fixed sequence of Chapters of recorded Lessons that every Trainee can watch. Distinct from the Development book: the book is reference material a Trainee dips into by position and age, the Course is watched through in order.
_Avoid_: Program, curriculum, class, training plan

**Chapter**:
A named group of Lessons inside the Course. Chapters are ordered and a Trainee may open any of them; nothing is locked behind completing an earlier one.
_Avoid_: Module, unit, section

**Lesson**:
One video in the Course, and the unit a Trainee completes. A Lesson counts as complete at 90% watched, or when the Trainee marks it done. A Lesson is never a thing that happens on the pitch — that is a Slot, which is why Slot lists "lesson" as a word to avoid.
_Avoid_: Episode, clip, video

### Plans and payments

**Plan product**:
One item in a branch's price list: what is sold, at what price, for how long, and with how many sessions if any. Changing it never changes a Plan already sold.
_Avoid_: Package, membership, sub

**Single-session price** (מחיר אימון בודד):
The value of one session in a branch's price list. Never sold on its own; it prices the sessions already used when a Card is cancelled.
_Avoid_: Session price, drop-in price

**Plan**:
One Trainee's purchase of a Plan product, with its own start date, end date and, for a Card, its own session count. What the Trainee holds, as distinct from the Plan product that was sold.
_Avoid_: Sub, subscription (bare), membership, package

**Subscription** (מנוי):
A Plan with a weekly cap and no session count, bought one month at a time.
_Avoid_: Sub, membership, monthly (bare)

**Card** (כרטיסייה):
A Plan with a fixed number of sessions and an expiry date. It ends when the sessions run out or the date passes, whichever comes first.
_Avoid_: Punch card, ticket, session card

**Intro pack** (חבילת היכרות):
A small Card sold once to each new Trainee.
_Avoid_: Trial, starter

**Term** (מתקדמים):
A Plan with a weekly cap and no session count, bought for several months in one payment.
_Avoid_: Long subscription, advanced plan

**Add-on**:
A Plan for mental, nutrition or tactical sessions. Never the Trainee's training Plan: it neither hides one nor uses up its sessions.
_Avoid_: Extra, bonus

**Current plan**:
The one training Plan a Trainee is training on today. A Trainee has at most one; Add-ons are never it.
_Avoid_: Active plan, relevant plan, running plan

**Queued plan**:
A paid training Plan waiting behind the Current plan. It starts the day the Plan ahead of it ends, by its end date or, for a Card, by its last session, whichever comes first, so its start date is not fixed until then.
_Avoid_: Future plan, scheduled plan, renewal (a renewal is a purchase, not a state)

**Void** (ביטול רישום):
Undoing a Plan that was recorded by mistake, as if it was never sold. The whole amount goes back and the receipt is credited.
_Avoid_: Cancel, delete

**Cancellation** (ביטול עסקה):
The parent's right under the cancellation policy to stop a Plan. It ends today, sessions already used stay used, and the refund follows the policy's formula.
_Avoid_: Void, termination, freeze

**Early end**:
An admin ending the Current plan today so the Queued plan behind it starts. What is left on it is forfeited and no money moves.
_Avoid_: Cancel, switch, upgrade

**Used session**:
A session counted against a Card: the Trainee was on the Roster of a Slot that took place, whether or not they came. Absence is not a refund.
_Avoid_: Attendance, check-in, punch

**Called off** (בוטל ע"י האקדמיה):
A Slot that was planned but did not take place because of the academy, such as weather, no pitch or no Trainer. Its Roster stays on record, but nobody on it uses a session.
_Avoid_: Cancelled (bare), deleted

**Adjustment** (תיקון יתרה):
An Admin's or Branch manager's deliberate change to the sessions on a Card, with a reason, for what the Roster cannot explain, such as matching Arbox or a goodwill grant.
_Avoid_: Correction, top-up, bonus sessions

**Plan queue**:
A Trainee's Current plan and the Queued plans behind it, in order. Renewal reminders follow the end of the queue, never the Current plan alone.
_Avoid_: Line, chain, plan history

**Booking**:
A Trainee's own reservation of a seat in a future Slot. Bookings are charged down the Plan queue in date order: the earliest goes to the Current plan, and those beyond it to the Queued plan behind.
_Avoid_: Reservation, registration, signup

**Sessions left**:
What a Trainee can still book: the sessions on the Cards in their Plan queue, minus Used sessions, minus future Bookings. The one meaning of "remaining" on every screen.
_Avoid_: Balance (bare), remaining (bare), credits

**Freeze** (הקפאה):
A stretch of dates, backed by a medical certificate, when the Current plan does not run: no Bookings and nothing counted. Afterwards its end date moves by the frozen days, and the queue behind it moves with it. Never for a vacation.
_Avoid_: Pause, hold, suspension

**Enrollment**:
The first purchase for a child who has no account yet. It creates the Trainee.
_Avoid_: Signup, registration, join

**Renewal**:
Any purchase of a Plan for an existing Trainee, whoever starts it: a parent from a link or the app, or staff. It always lands on that Trainee and joins the end of their Plan queue.
_Avoid_: Re-signup, extension, top-up

**Payment link** (קישור לתשלום):
A Renewal that staff send a parent for one Trainee and one Plan product at a fixed price. The parent signs and pays by card; it becomes a sale only when the card is charged.
_Avoid_: Invoice, payment request, checkout link

**Refund** (החזר):
Money returned to the payer after a Void or Cancellation, by the method they paid with. A person moves the money; the academy's record of it always carries a credit note.
_Avoid_: Chargeback, credit, reimbursement
