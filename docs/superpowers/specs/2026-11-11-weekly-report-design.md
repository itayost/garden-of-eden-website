# Weekly report (דוח שבועי)

Date: 2026-11-11. Status: design written from the conversation (feasibility study of 2026-10-29 and the answers of 2026-11-11), awaiting spec review.

## Goal

Every week, each Trainee who trained with us, and their parent, get a short Hebrew report:

1. What we did together this week.
2. Where we saw progress.
3. How they came to training (sleep, energy) and one tip.
4. Their Goal, how close they are, and two or three Development book drills for next week.

A model writes the words; code computes every fact. Staff approve each report until the quality is proven, then reports go out by themselves. A Trainee who did not train gets a short "התגעגענו" message instead. After every Assessment the system proposes Goals with drills, for staff to accept.

Why: parents and players hear from the academy only when a plan runs out. A weekly, true, personal note keeps families close and gives the player a next step.

Success: on Friday at 12:00 a קריית אתא parent gets a WhatsApp with a link and reads a report that sounds like the trainer wrote it, every number in it true; the player sees the same week on the dashboard; staff spent under 30 seconds on each report.

## Production numbers

Checked on 2026-11-11 against the last 28 days (2026-10-14 to 2026-11-10), read-only. They shaped the decisions below.

| | קריית אתא | חיפה |
|---|---|---|
| Trainees who trained (counted Roster rows) | 139 | 110 |
| ... with a parent phone (`guardian_phone` or a signed agreement) | 102 | 17 |
| ... with a birthdate | 134 | 92 |
| ... with a position | 69 | 54 |
| Trainees with a pre-workout form | 23 | 28 |
| Trainees with a post-workout form | 11 | 12 |
| Trainees with an Exercise log | 1 (2 logs) | 1 (2 logs) |
| Trainees with a Training session built | 17 | 89 |
| Assessed in the last 90 days | 33 | 89 |
| Measured (nutrition) in the last 90 days | 20 | 78 |
| With an open Goal | 10 | 52 |

Shift reports: 59 reports by 11 Trainers; 167 Trainees named in a positive category (worked on, achievements, praise, homework).

Per report week (both branches): 78 to 135 Trainees trained; 30 to 57 of them had a Trainer note, 0 to 34 a Training session, 7 to 20 a pre-workout form, and 45 to 56 had nothing but attendance.

What follows from it:

- About 100 to 135 reports a week, not 600. The account list is no guide: the nightly Arbox sync makes an account for every past client (see the Surveys spec).
- In a typical week, half the reports would say nothing but "you came". Hence the Quick tags.
- Exercise logs are unused, so "personal bests" cannot come from them. Progress comes from Quick tags, Shift report notes, Assessments and Goals.
- חיפה parents are mostly unreachable today. Hence the parent phone prompt.
- Questionnaires are rare. Hence the daily Check-in.

## Decisions

| Topic | Decision |
|---|---|
| Readers | The player (dashboard) and the parent (WhatsApp with a signed link). Two texts written from one Fact sheet. |
| Branches | Both. A report says only what its branch records. |
| Approval | Any staff member (Trainer, Branch manager, Admin) approves the reports of Trainees in their branches. |
| Automatic mode | Per branch, switched on by an Admin once the bar below is met. |
| Report week | Friday to Thursday, Israel days. |
| Timing | Written in the night to Friday; approved Friday morning; sent Friday 12:00. A report approved later goes out at the next send window (below). Nothing is sent on Friday afternoon or Saturday. |
| Thin weeks | Trainers tap Quick tags in the calendar roster sheet after a Slot. |
| Check-in | A daily card for the Trainee: sleep hours, energy 1 to 5, muscle soreness. |
| Gender | A new profile field, needed to write Hebrew to and about the player. |
| חיפה parents | The app asks the Trainee once for a parent phone; staff can fill it too. Parent reports start as numbers arrive. |
| Player WhatsApp | None. The player reads the report in the app. |
| Body measurements | Shown, only in a week with a new measurement: the numbers, the trend and the age percentile, with the dietitian's recommendation quoted as written. The model adds no comment on them. |
| "התגעגענו" | A template message, no model. Sent for a week with no counted session to a Trainee who trained in one of the 3 weeks before; never during a Freeze. After the third such week it stops and the Trainee appears on the staff list "לא הגיעו 3 שבועות". |
| Parent version | Also shows Sessions left and the renewal link. |
| Goals | Proposed after each Assessment, accepted by staff; automatic later, with the same switch. |
| Model | Claude Opus 5.5 through the Message Batches API. The pilot runs a blind staff comparison with Sonnet 5.5 before the choice is final. |
| Pilot | One קריית אתא group (birth years), then all of קריית אתא, then חיפה. |

## Out of scope

Voice-to-shift-report, a pre-session briefing for Trainers, risk alerts, WhatsApp to the player, reports to Leads, reports for adults' parents (a Trainee aged 18 or more gets the player report only), editing a report after it was sent, a PDF of the weekly report, chat with the model, translating reports, and changing the Shift report form.

## Language

Add to `CONTEXT.md` under a new "Weekly report" heading:

- **Weekly report** (דוח שבועי): the two texts, for the player and for the parent, about one Trainee's Report week. _Avoid_: summary, newsletter, digest.
- **Report week**: Friday to Thursday, Israel days. _Avoid_: week (bare) when the calendar week is meant.
- **Fact sheet** (דף עובדות): everything computed about one Trainee's Report week; the only thing the model sees. _Avoid_: context, prompt data.
- **Quick tag** (תגית): one of a fixed set of words a Trainer taps for a Trainee after a Slot, with an optional short note. _Avoid_: note (notes are the Shift report's), comment.
- **Check-in** (צ'ק-אין): a Trainee's three answers for one day: sleep, energy, soreness. _Avoid_: questionnaire, שאלון (the fixed forms), survey.
- **Hold** (עיכוב): a Weekly report kept from sending, by a person or by a guardrail, with its reasons. _Avoid_: block, reject.
- **Goal proposal** (הצעת יעד): a Goal the system suggests after an Assessment, waiting for staff. _Avoid_: recommendation.

UI copy: "דוחות שבועיים", "ממתין לאישור", "מעוכב", "אושר", "נשלח", "התגעגענו".

## Rules

### Who gets what

For each Report week, every active, not deleted Trainee with full access is in one of three groups:

1. **Report**: trained at least once in the week, in any branch.
2. **התגעגענו**: did not train this week, trained in one of the 3 Report weeks before, and had no Freeze on any day of this week.
3. **Nothing**: everyone else. Those whose last training is exactly 4 Report weeks back are listed for staff as "לא הגיעו 3 שבועות".

"Trained" on a day means a counted Roster row (`rowCounts()`) or an Arbox entrance on that day; one day counts once. The Arbox entrance report (`fetchEntranceReport()`) is read once per week for everyone and matched on `profiles.arbox_user_id`, so a חיפה Trainee who trains through Arbox only is never told we missed them. "התגעגענו" starts in חיפה only after the pilot shows the two sources agree.

A branch takes part only while its setting is on (below), and only for the birth years it names, if any (the pilot). A Trainee in two branches gets one report, which every branch's staff can see.

### The Fact sheet

Built in code from the week's data, as plain JSON with Hebrew labels. Each item says where it comes from:

- **Attendance**: the days trained, each Slot's Focus, late cancels.
- **What we did**: the Slot Focus; the exercises of the Trainee's Training sessions in the week, with names and categories (a Slot workout is copied into each Roster member's own Training session, so these alone are the record); the "עבדנו על" entries of Shift reports that name the Trainee, with their work topics.
- **Progress**: positive Quick tags with their notes; achievements (with their categories), praise, homework and video feedback from Shift reports; an Assessment dated in the week (the change from the previous one through `compareAssessments()`, and the app's 30 to 99 rating against the age group); the Exercise logs' best against the previous best, when there are any.
- **Habits**: the week's Check-ins (average and lowest sleep, average energy, days with soreness); the pre-workout form's sleep range as a fallback; post-workout difficulty and satisfaction.
- **Body**: a nutrition measurement dated in the week (weight, height, BMI and their percentiles) and the latest dietitian recommendation. The recommendation is shown to the reader as written, appended by code; the model only knows that one exists.
- **Goals**: each open Goal with baseline, current value, target and progress; up to 6 candidate drills from the Development book (by the metric-to-parameter map, the Trainee's age group and position, leaving out drills marked done in the last 30 days).
- **Next game**: if one is set.
- **Plan** (parent version only, added by code, never sent to the model): Sessions left, the queue's end date, the renewal link.
- **About the player**: first name kept out (the model writes `{שם}` and code fills it in), gender, age group, position, branch. Trainer first names may appear ("לפי המאמן יוסי").

Never in the Fact sheet:

- The Shift report categories injuries, limitations, mental state, discipline, complaints and insufficient attention, and caution Quick tags. When any of them names the Trainee in the week, the report is held for a person (below), but the content still never reaches the model.
- The categories pro candidates, social skills and new trainee: staff matters, neither written nor a reason to hold.
- Medical notes, phone numbers, the full name.

### Quick tags

- Positive tags, which feed the Fact sheet: השקיע, התקדם, ריכוז טוב, מנהיגות, טכניקה טובה, שיא אישי.
- Caution tags, staff only, which hold the report: כאב או פציעה, התנהגות.
- One optional note per Trainee per Slot, up to 80 characters ("בעיטה ברגל שמאל").
- Who: the Trainers on the Slot, Admins and Branch managers, the same people `mayCorrectPastSlot()` lets correct a past Slot. When: from the Slot's start to the end of the next day.
- Only Roster entries linked to an account can be tagged. A tap saves at once; a second tap removes the tag.

### Check-in

- A card near the next-training card on the dashboard, until it is answered or put away for the Israel day.
- Sleep last night in hours (3 to 12, half-hour steps), energy 1 to 5, and "יש עייפות שרירים?" yes or no.
- One per Trainee per Israel day; a second answer the same day replaces the first.
- A Check-in counts toward the streak, like the forms do.
- The Fact sheet reads the week's Check-ins. Staff see them on the trainee page.
- The pre-workout form keeps its questions for now; once Check-ins are common, its sleep question can go.

### Parent phone

- `profiles.guardian_phone` is the one parent number, as for the plan reminders. Fulfillment already copies the agreement's number into it when it is empty.
- A Trainee under 18 without it sees, once a week until answered, a popup: why we ask (the weekly report) and a phone field. It is mounted in the trainee layout like `SurveyPromptLoader`, waits for the onboarding tour, and never opens on the same page load as a Survey.
- The number goes through `normalizePhoneIL()` and is saved by a server action for the Trainee's own profile.
- Staff can set or fix it: no screen edits `guardian_phone` today, so it is added to the trainee page's health sheet (`trainee-health.ts`, branch scoped) and to the admin user form.
- A Trainee with no birthdate is asked; the popup offers "אני מעל 18", which records that no parent is needed.

### Gender

`profiles.gender`, `male` or `female`, nullable. Set on the `/join` form (בן / בת), on the staff user form, and in one tap from the approval queue. The Arbox sync already receives each client's gender (`ArboxUser.gender`, unused today); it fills the field where it is empty, which covers most of חיפה. A report for a Trainee without it is held with the reason "חסר מגדר", so the rest fills in through the queue.

### Writing

- Code builds the Fact sheet and a list of the numbers the text may use.
- One request per Trainee to Claude Opus 5.5 through the Message Batches API, with structured output: `player_text`, `parent_text`, and `drill_ids` (0 to 3, taken from the candidates).
- The system prompt is the academy's style guide in Hebrew, with sample reports written with Eden: use only the given facts, no number that is not in the list, no medical or diet advice, the right gender forms, player text up to about 110 words, parent text up to about 140, no emojis. It is versioned (`prompt_version` on each report) and cached.
- The batch is sent at 01:00 Friday. Whatever has not come back, failed or was refused by 07:30 is written with a direct request. A report that still has no text is held ("הכתיבה נכשלה").
- No `ANTHROPIC_API_KEY`, no reports: the job logs and stops.

### Guardrails

A pure `reportProblems(factSheet, output)`, tested first. Any problem holds the report, with its reasons shown to staff:

- A number in either text that is not in the allowed list.
- A drill id that is not a candidate, or more than 3.
- A text out of bounds (empty, or more than 1.5 times the target length).
- A word from the forbidden list (diagnosis, injury, diet and weight-loss words).
- Missing gender.
- A sensitive Shift report entry or a caution Quick tag naming the Trainee in the week.

Guardrails stay on in automatic mode.

### Approval queue: `/admin/weekly-reports`

- For every staff member, scoped to the Trainees of their branches through `getBranchScopeAction()` and `visibleProfileIds()`.
- Menu item "דוחות שבועיים" with a badge: the reports waiting in the current Report week (cached like the ending-soon badge).
- A week picker (current by default), a branch filter, and tabs: מעוכבים first, then ממתינים, אושרו, נשלחו, התגעגענו, "לא הגיעו 3 שבועות".
- A row opens a sheet: the Fact sheet on one side, the two texts editable on the other, and actions: אשר, עכב (with a reason), כתוב מחדש (writes this one again with a direct request), and בן / בת when gender is missing.
- "אשר את כל הממתינים" approves every row in view that has no Hold.
- A row shows "נוספו נתונים" when a Shift report or Quick tag for the Trainee arrived after the text was written.
- Every edit keeps the model's original text; the report stores who edited, when, and `editRatio()` (a pure normalized edit distance). An edit above 15% counts as significant.

### Sending

- Send windows: Friday 12:00, then 09:00 on Sunday to Thursday. Each window sends every approved, unsent report of the current Report week. When the next week's reports are written, the unsent ones of the week before become "לא נשלח".
- Player: the report shows on the dashboard from the moment it is sent.
- Parent: the WhatsApp template `WHATSAPP_WEEKLY_REPORT_TEMPLATE_NAME` with the child's first name and the link. No template set, or no parent phone: the parent part is skipped and the queue says why. A Trainee aged 18 or more gets no parent message.
- Parent page `/report/[token]`: the parent text, the Goal's progress, the chosen drills (name and the book's "למה" line), Sessions left and the renewal link. No login, no index, a signed token valid 30 days and bound to one report. The first open is recorded.
- "התגעגענו": the template `WHATSAPP_MISSED_YOU_TEMPLATE_NAME` to the parent and a card for the player with a link to book. Not written by the model, so it needs no approval; it is listed in the queue and can be held until it is sent.
- Every send is stamped, so a window that runs twice sends nothing twice.

### Automatic mode

- A setting per branch: off, approval, or automatic, plus optional birth years (the pilot). Default off.
- An Admin may switch a branch to automatic when, for the last 4 Report weeks in that branch, at least 90% of sent reports went out without a significant edit and no report was flagged as wrong. The queue page shows these numbers.
- In automatic mode a report with no Hold is approved when written and sent at 12:00; staff can still open, edit or hold it until then. Held reports still wait for a person.
- Each week 10% of the automatic reports, picked at random, are marked "לבדיקה מדגמית" for a staff look after sending.
- Any staff member can flag a sent report "דווח על טעות" with a reason. A flag in a branch in automatic mode switches it back to approval and tells the Admins on the queue page.

### Goal proposals (phase 3)

- After an Assessment is saved, a nightly job proposes up to 3 Goals for that Trainee.
- Code finds the gaps: each metric against the age-group benchmark, preferring the metrics mapped to the Trainee's position in the Development book.
- Code sets a realistic target from the academy's own history: the improvement reached in that metric by Trainees of the same age group between Assessments 6 to 12 weeks apart, at the 60th to 75th percentile. With fewer than 20 such pairs it falls back to half the gap to the benchmark.
- The model picks among the code's candidates, writes one Hebrew line on why, and picks drills from the candidates. Guardrails as above.
- Staff accept, change or reject in the trainee page's Goals card and in a "הצעות יעד" tab of the queue. Accepting writes `player_goals` through the existing goal action.
- Needs a map from Assessment metrics to Development book parameters: a small table that Admins edit in the book admin, seeded from a first draft that staff correct.
- Automatic later through the same per-branch switch.

## Data

New tables in migrations applied before the code that uses them (`npm run db:types` after each). House conventions as in the Surveys spec: `uuid` keys, `timestamptz NOT NULL DEFAULT now()`, text CHECKs, an index on every foreign key, `COMMENT ON TABLE` naming the writer, RLS on with no policies, `REVOKE ALL` from `anon` and `authenticated`, every read and write through server code with the service role.

- **weekly_reports**: Trainee, Report week start, kind (`report` or `missed_you`), status (`pending`, `held`, `approved`, `sent`, `not_sent`), hold reasons, the Fact sheet, model, prompt version, the model's original output, the current player and parent texts, chosen drills, who edited and when, edit ratio, who approved and when (or automatic), sent at, the WhatsApp message id or skip reason, parent first opened at, player first opened at, flagged wrong (by, at, reason), sample flag. Unique (Trainee, week start).
- **weekly_report_settings**: branch, mode (`off`, `approval`, `automatic`), birth years, changed by and at.
- **slot_trainee_tags**: Slot, Trainee, tag, note, created by and at. Unique (Slot, Trainee, tag).
- **trainee_checkins**: Trainee, Israel date, sleep hours, energy, soreness, created and updated at. Unique (Trainee, date).
- **profiles**: `gender`; `guardian_not_needed` (the "אני מעל 18" answer); `guardian_prompt_seen_at`.
- Phase 3: **goal_proposals** (Assessment, Trainee, metric, baseline, target, reason, drills, status, decided by and at) and **book_parameter_metrics** (parameter, metric key).

## What already exists

Checked on 2026-11-11. Most ingredients are computed by pure, tested functions; what is missing are loaders for one Trainee and a date range, or for many Trainees and one week, on the service role (the existing ones are server actions tied to a signed-in user, which a cron job cannot call).

| Need | Reuse | Missing |
|---|---|---|
| Report week | `getIsraelTime()`, `israelDateStr()` | The app's week is Sunday to Saturday (`weekBounds()`, `startOfWeek()`); a Friday to Thursday helper is new. |
| Counted training | `rowCounts()`, `historyStatus()` (`src/lib/schedule/`) | A roster loader by date range: `loadTraineeHistoryRows()` reads all dates. |
| Arbox entrances | `fetchEntranceReport(from, to)` (`src/lib/arbox/reports.ts`) | One read per week, indexed by Arbox user id. |
| Shift report notes | `extractTraineeNotes()`, `CATEGORY_COLUMNS`, `NOTE_CATEGORY_LABELS`; work topics and achievement categories in `src/lib/validations/shift-report.ts` | A week loader for many Trainees. `categorizeNotes()` drops praise, homework and video feedback, so it is not used here. |
| Training sessions | `ROSTER_SESSION_SELECT`, `toRosterExercises()` (`src/lib/schedule/roster-exercise.ts`) | A loader by Trainee and date range with exercise names, categories and the Slot's Focus. |
| Questionnaires | Sleep ranges and labels in the pre-workout form | A reader by Trainee and date range. |
| Assessments | `compareAssessments()`, `compareMetric()`, `isLowerBetter()`, `ASSESSMENT_LABELS_HE`, `resolveAgeGroup()`, `fetchGroupStats()`, `calculateRatingLowerBetter()` / `HigherBetter()` | Nothing. |
| Goals | `calculateGoalProgress()`, `GOAL_METRICS`, the goal-setting rules in `set-goal.ts`; the Assessment trigger keeps `current_value` | Nothing for reports; proposals are new. |
| Development book | `deriveAgeGroup()` (the book's own groups, U10-12 to U17+, unlike the Assessment groups), `isParameterVisible()`, `book_drill_progress`; 7 categories, 34 parameters, 47 drills | The metric-to-parameter map. |
| Plan state | `loadPlanQueues(db, ids, today)`: `queue.current`, `queue.frozen`, `sessionsLeft`, `endsOn`; `buildRenewalUrl()`, `buildTraineePurchaseUrl()` | Nothing. |
| Staff scope | `verifyAdminOrTrainer()`, `getBranchScopeAction()`, `visibleProfileIds()`, `readInChunks()`; `/admin/plans` is the model page | The menu badge cache must be keyed by the staff member's scope (the ending-soon badge cache is global because it is Admin only). |
| Roster sheet | `RosterSheet.tsx`, `RosterRow.tsx` (`src/components/admin/calendar/`); `loadWritableSlot()` and `mayCorrect()` in `daily-schedule-roster.ts` | The tag chips and their action. |
| Dashboard | `src/app/dashboard/page.tsx` card stack; `SurveyPromptLoader` and its snooze in the trainee layout | The report card (after `TraineeNotices`), the Check-in card (near `NextTrainingCard`), the parent phone popup. |
| Cron | `src/app/api/cron/plan-reminders/route.ts` (secret check, Israel-hour gate, stamps); crons in `vercel.json` are UTC, so each Israel time takes two entries and an hour check | The write and send routes. |
| WhatsApp | `src/lib/whatsapp/plan-templates.ts` senders (unset template name returns an error, no throw), `templateMissing()`, `waShareUrl()`; new names go in `optionalServerVars` in `src/lib/env.ts` | Two senders. |
| Signed link | The HMAC style of `renewal-token.ts` and `agreement-token.ts`, the secret from `planTokenSecret()` | A report token over `report.<id>.<expiry>`. Never the `t-` subject, which `verifyRenewalToken()` would accept as a purchase link. |
| Streak | `update_user_streak` runs on form inserts (Monday to Friday days) | A Check-in counts the same way. |
| Model | Nothing: no language model package, code or key (`@huggingface/transformers` only removes image backgrounds in the browser) | `@anthropic-ai/sdk`, `ANTHROPIC_API_KEY` in `optionalServerVars`. |

## Code layout

- `src/features/weekly-reports/`: `lib/` pure rules, each tested first (`reportWeek`, `whoGetsWhat`, `buildFactSheet`, `allowedNumbers`, `reportProblems`, `editRatio`, `sendWindow`, `automaticModeBar`), `lib/queries.ts` loaders (service role), `lib/writer.ts` (the Anthropic batch and direct calls, server only), `lib/actions/` one concern per file, `components/admin/` and `components/trainee/`.
- `src/features/checkins/`; the Quick tags in `src/features/quick-tags/`, rendered inside `RosterRow`.
- Cron routes: `/api/cron/weekly-reports-write` (Friday 01:00 and 07:30 Israel) and `/api/cron/weekly-reports-send` (each send window), each with two UTC entries.
- Pages: `src/app/admin/weekly-reports/`, `src/app/report/[token]/` (open to the public in `src/middleware.ts`, `noindex`).

## Cost

About 130 reports a week. With Opus 5.5 through the Batch API at about 8,000 input and 4,500 output tokens a report, roughly 0.06 USD a report, about 35 USD a month, before cache savings. "התגעגענו" costs nothing in model use. To be measured in the pilot.

## Order of work

Each line becomes its own implementation plan in `docs/superpowers/plans/`:

1. **Inputs** (ship first, so data builds up while the rest is built): gender, the parent phone prompt and staff field, the daily Check-in, Quick tags.
2. **Weekly report in approval mode**: tables, Fact sheet, writer, guardrails, the two cron jobs, the queue, the parent page, the dashboard card, "התגעגענו". Pilot on one קריית אתא group.
3. **Goal proposals**: the metric-to-book map, proposals, targets, drills.
4. **Automatic mode**: the bar, the switch, sampling, flags and the switch back.

## Before launch (not code)

- Submit the two WhatsApp templates to Meta (WABA 1992291924883900).
- A consent line in the enrollment agreement about processing training data for personal reports, checked by a lawyer against the privacy law and its Amendment 13; decide whether existing families need notice.
- An Anthropic API key in Vercel production, the organization's data-retention settings checked, and a data processing agreement signed.
- Three to five sample reports written with Eden for the style guide.
- The pilot group's birth years.

## Left to the builder

Column and function names, exact Hebrew copy beyond the words above, the visual design of the queue, the cards and the parent page (house style, phone first, 320 to 1440 px), the style guide's wording, and the forbidden word list.
