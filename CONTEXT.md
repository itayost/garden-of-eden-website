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
The person who manages the academy — creates trainees, assigns work to trainers, and reviews what was done.
_Avoid_: Manager, owner, staff

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
One free-text note per calendar day, written by an Admin and read by all staff. General announcements only — the day's structure lives in the Daily schedule, not here.
_Avoid_: Announcement, memo, bulletin, notice

**Daily schedule**:
The structured plan for one calendar day, made of Slots. Admin-authored; the WhatsApp schedule message is generated from it, never the reverse.
_Avoid_: Timetable, calendar, לו"ז (in code)

**Slot**:
One group at one hour: (date, hour, Trainer, Focus, location, Roster). Two trainers at the same hour are two Slots.
_Avoid_: Class, session, lesson

**Focus**:
The free-text training theme of a Slot, e.g. "זריזות מהירות טכניקה עם כדור".
_Avoid_: Topic, subject, theme

**Roster**:
The list of names in a Slot. An entry may link to a Trainee account or be a free-text name that has no account; only linked entries can receive Training sessions.
_Avoid_: Attendance — that is who actually showed up; the Roster is who is planned

**Training session**:
The per-Trainee exercise plan for one calendar day, built by a Trainer from the exercise library. Not a Slot (the group plan) and not a Program (a multi-week template used only as a copy source).
_Avoid_: Workout (bare), session (bare), assigned program

**Equipment**:
A machine or station in the studio, catalogued with a permanent code printed as a QR sticker. Scanning it opens the Trainee's log form for the matching exercise.
_Avoid_: Machine, device, gear

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
The structured end-of-day form a Trainer fills in about their Shift. Distinct from the Daily brief, which flows the other way — Admin to staff.

### Training

**Assessment**:
A dated set of physical measurements taken for a Trainee.
_Avoid_: Test, evaluation, measurement

**Development book**:
The library of drills and training material.
_Avoid_: Playbook, curriculum
