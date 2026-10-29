# Surveys (סקרים)

Date: 2026-10-29. Status: design written from the conversation, builder check folded in; popup look and results layout approved from mockups the same day.

## Goal

Let staff ask Trainees questions and read the answers:

1. An Admin, or a Branch manager for the branches they manage, writes a Survey: a few Questions for an audience of Trainees.
2. Each Trainee in the audience sees it as a popup in the app and answers it once.
3. Staff open a report per Survey: how many answered, what each Question got, and every answer by name.

Why: the academy has no way to hear from Trainees as a group. The only trainee forms today (pre-workout, post-workout, nutrition, mental) are fixed questions hard-coded in the app. Likely first uses (our guess, the client has not named one): end-of-season satisfaction, quick polls such as which days suit a holiday camp, and feedback after a change.

Success: Eden writes a Survey for קריית אתא, birth years 2014 and 2015, the children see it the next time they open the app, and the results page fills in as they answer, with the names of those who saw it and have not answered yet.

## Decisions

Decided in the conversation (the developer handed the business calls to the designer and accepted these defaults):

| Topic | Decision |
|---|---|
| Who writes Surveys | Admins (any branch) and Branch managers (only branches they manage). Trainers without a managed branch have no access. |
| Named or anonymous | Named. Staff see who gave each answer. No anonymous mode. |
| Who reads results | Admins (every Survey) and Branch managers (their branches' Trainees only). Trainers do not. |
| Delivery | A popup inside the app. No WhatsApp, no push notification. |

Designer's calls (the developer accepted them as defaults; listed so they can be changed before the plan):

| Topic | Call |
|---|---|
| Audience | One or more branches, optionally narrowed to birth years (שנתון), the way staff group Trainees (the calendar shows "יונתן 08" for that reason, PR #135). Never hand-picked Trainees, never the U10/U12 age groups. |
| Who is in it | Trainees who are active, not deleted, have full access (not course-only), belong to a target branch, and, when the Survey names birth years, were born in one of them. |
| Response rate | Measured against the Trainees who saw the Survey, not the whole Audience, because the Audience includes former clients (see "Audience" below). The Audience size is shown beside it. |
| Question types | Single choice, multiple choice, rating 1 to 5, free text. Each Question is required or optional. |
| Lifecycle | Draft, then published, then closed. Optional close date; can be closed early. |
| Locking | Once anyone has answered, Questions, options and audience are locked. Title, intro and close date stay editable. |
| Answers | One Response per Trainee per Survey. No editing after sending. |
| Popup | Shows on any trainee page except while the Trainee is mid-activity or the onboarding tour is due. "אחר כך" hides it until the next Israel day. It never blocks the app. |
| Several open Surveys | One popup at a time; all unanswered ones are listed on the dashboard. |
| Charts | CSS bars in the house style of `/admin/finance`, not recharts. |
| Audit | Who created, published and closed a Survey is kept on the Survey. Nothing goes to `activity_logs` (a Survey has no single Trainee to log against). |

## Out of scope

Anonymous Surveys, WhatsApp or push alerts, repeating or scheduled-recurring Surveys, branching logic ("if no, skip to question 5"), "other, please specify" options, hand-picked audiences, Trainers seeing results, showing a Trainee's survey answers on the staff trainee page, comparing two Surveys, Surveys to parents or Leads, editing a sent Response, and saving a half-filled Survey on the server.

## Language

Add to `CONTEXT.md` under a new "Surveys" heading:

- **Survey** (סקר): a set of Questions staff send to an audience of Trainees. Each Trainee answers it once, by name. _Avoid_: questionnaire and שאלון (in this app those are the fixed workout, nutrition and mental forms on `/admin/submissions`), poll, form.
- **Question**: one item in a Survey, of one of four kinds. _Avoid_: field, item.
- **Response**: one Trainee's sent answers to one Survey. _Avoid_: submission (the word the fixed forms use), reply.
- **Audience**: the Trainees a Survey is for, described by branches and birth years, never a stored list of names.

UI copy: "סקרים", "סקר חדש", "שאלה", "תשובות".

## Rules

### Who may do what

- **Write, edit, publish, close, delete:** an Admin always. A Branch manager only when they manage every branch in the Survey's audience. This is stricter than `canManageBranches()` (`src/lib/branches/branch-scope.ts:31`), which passes a manager of any one of the branches, so it needs its own pure check (`canEditSurvey(role, managedBranchIds, surveyBranchIds)`). Reason: a manager must not close or change a Survey Eden sent to both branches.
- **A Branch manager writing a Survey** can choose only branches they manage.
- **Read the list and results:** an Admin sees every Survey. A Branch manager sees every Survey whose audience includes a branch they manage, including ones an Admin wrote, and in it only the Trainees of branches they manage (answers and not-answered alike).
- **Delete:** an Admin may delete any Survey after a confirmation that says how many Responses go with it. A Branch manager may delete only a Survey with no Responses. Drafts can always be deleted by whoever may edit them.
- Every staff server action checks this itself (`verifyAdminOrTrainer()`, then `getBranchScopeAction()` and the pure check). The UI only hides what the server would refuse.

### Survey state

Stored: `published_at` and `closed_at` (both nullable), `opens_on` (Israel date, defaults to the day of publishing) and `closes_on` (Israel date, nullable). The state shown is derived, never stored, by one pure function (`surveyState(survey, today)`):

- **טיוטה**: not published.
- **מתוכנן**: published, `opens_on` is after today.
- **פתוח**: published, `opens_on` is today or earlier, not closed, and `closes_on` is null or today or later.
- **הסתיים**: `closed_at` is set, or `closes_on` is before today.

Dates are Israel calendar days through `israelDateStr()` (`src/lib/utils/israel-time.ts:78`). A Survey closing on the 5th takes answers through the end of the 5th, Israel time.

### Publishing

A draft can be published only when (`publishProblem(draft)`, pure): the title is 2 to 120 characters, the audience has at least one branch, there is at least one Question, every Question's text is 2 to 300 characters, every choice Question has 2 to 10 options of 1 to 100 characters with no duplicates, there are at most 20 Questions, and `closes_on`, when set, is not before `opens_on` or today. The intro is optional, at most 500 characters.

Before the first Response, a published Survey can be edited in full or returned to draft. After the first Response, Questions, options and audience cannot change; title, intro and `closes_on` can. Moving `closes_on` later on a Survey that ended by date opens it again until the new date. Closing early ("סגירה עכשיו") sets `closed_at`, and a Survey closed that way stays closed; reopening it is out of scope.

### Audience

A Trainee is in a Survey's audience when all hold (`inSurveyAudience(trainee, survey, today)`, pure):

- `role = 'trainee'`, `deleted_at` is null and `is_active` is true;
- their access tier is full, by `resolveAccessTier()` (`src/lib/access/course-access.ts`). Course-only users bought the course, not training, and are not the academy's Trainees for this purpose;
- they have a `profile_branches` row for at least one of the Survey's branches;
- the Survey names no birth years, or the year of the Trainee's `birthdate` is one of them. A Trainee with no birthdate is not in a Survey that names birth years. The age-group override and the `plays_up` mark are not consulted (designer's call: a Survey for 2014 means children born in 2014).

The audience is worked out when it is read, never stored as a list, so a Trainee who joins a target branch while the Survey is open sees it too.

**The Audience includes people who no longer train.** The nightly Arbox sync creates a trainee account for every Arbox client ever who has a phone (`src/lib/arbox/sync.ts`), `is_active` only changes when staff switch it off by hand, and `resolveAccessTier()` keeps full access for anyone who ever trained. There is no stored "training now" signal for חיפה, and building one from Arbox is out of scope. This does no harm to delivery (former clients rarely open the app), but it would make "answered out of the Audience" meaningless. So the report measures against **Seen**: a Trainee has seen a Survey once its popup has opened on their screen, from the layout or the dashboard card. The first time is recorded on the server (one row per Survey and Trainee). The Audience size is still shown, as context.

### Answering

- The trainee server action re-checks everything on submit: signed-in Trainee, Survey open today, Trainee in its audience, no Response yet, and every answer valid (`answersProblem(questions, answers)`, pure): each required Question answered; a single choice has exactly one option of that Question; a multiple choice has one or more distinct options of that Question; a rating is a whole number 1 to 5; free text is trimmed, 1 to 1000 characters. An optional Question may be left out; an answer to a Question not in the Survey is refused.
- The Response and its answers are written together or not at all, by one database function run with the service role, the way booking uses `book_slot_checked`. A unique `(survey_id, profile_id)` stops a second Response, including from a double tap; the action then answers "כבר ענית על הסקר הזה".
- The Response keeps a snapshot of the Trainee's branch ids among the Survey's branches at the time of sending. Results group and filter answered Trainees by that snapshot, so they do not move when a Trainee later changes branch; Trainees who have not answered are grouped by their branches today.
- Rate limit with the existing `general` limiter (`src/lib/rate-limit.ts`), keyed on the user. The unique constraint is the real guard.

## Trainee side

### The popup

- Mounted once in the trainee layout, beside `OnboardingTourProvider` (`src/app/dashboard/layout.tsx:102`), inside its own `Suspense` so it never slows the page. A server component loads the one Survey to offer and passes it to a client component.
- Which Survey: among the open Surveys the Trainee is in the audience of and has not answered, the one with the earliest `closes_on` (a Survey with none comes last), then the earliest published.
- Not shown while the Trainee is mid-activity, by a pure path check: `/dashboard/workout`, `/dashboard/scan/*`, the individual forms under `/dashboard/forms/*` (the `/dashboard/forms` index itself is fine), and the course lesson players (`/dashboard/course/*/*`, `/dashboard/tactical-course/*/*`). The client component reads `usePathname()`, so a Trainee who opens the app on a scan page gets the popup once they move to another page.
- Not offered while `profiles.tour_completed` is false, so it never lands on top of the onboarding tour; it comes on the next visit after the tour.
- When the popup opens, the client calls a server action that records Seen (idempotent; a second call changes nothing). Opening a Survey from the dashboard card records it too.
- Built on `SheetDialogContent` (`src/components/ui/sheet-dialog.tsx`): a bottom sheet on phones, a dialog from `sm` up.
- First screen: title, intro, the number of Questions, and two buttons, "להתחיל" and "אחר כך". Then one Question per screen with a progress indicator, back and next; next is disabled until a required Question is answered. The last screen sends; a short thank-you closes it.
- "אחר כך", the close button or Escape hides the popup until the next Israel day, stored in localStorage under the Survey's id with the date (designer's call: a per-device convenience, matching the dashboard banners). Every storage read and write is wrapped in try/catch; without storage the popup returns on the next full page load, which is acceptable.
- After sending: `router.refresh()` so the dashboard list updates. The refresh will hand the layout the next Survey, if any; the client component must not open it until the next full page load (one popup per visit), for example by remembering in component state that it already showed one.
- Half-filled answers are not saved anywhere. Closing mid-way loses them.
- Question controls sized for a child's thumb: options as large tappable rows (single choice as a radio group with `role="radiogroup"`, as `PaymentMethodPicker` builds one; multiple choice as checkboxes), rating as five large numbered buttons, free text as a `Textarea` with a character count.
- Hebrew, RTL, logical properties; respects `prefers-reduced-motion` through the existing `MotionProvider`.

### The popup's look (approved mockup)

Approved on 2026-10-29 from the mockups in `.impeccable/mockups/surveys/popup.html` (local, gitignored; screenshots in `shots/`). A game moment inside the existing trainee app, not a white form:

- The sheet is forest green (`--color-forest` #0A1F0A, raised surfaces #142814) with the brand lime (`--color-brand-lime` #CDEA68) for the primary button, selected answers and progress. Text is near-white; secondary text stays at 0.62 opacity or more for contrast.
- A faint football centre circle sits in the sheet's top corner: one ring, the centre spot and the halfway line, in lime at about 10% opacity. One ring only.
- The level path: one small tile per Question, showing its kind's icon, joined by short lines. On the first screen it shows what is ahead; on each Question it is the progress indicator (answered tiles fill lime with a check, the current one has a lime outline); on the thank-you screen every tile is filled.
- Rating buttons show their numbers in Bebas Neue (already self-hosted); everything else is Heebo. Answer rows are at least 56px tall with 16px corners.
- The thank-you screen: a lime disc with a check that draws in, a small burst of confetti, "תודה, <first name>!". Both animations switch off under reduced motion.
- Shadows are neutral (black at low opacity, with offset), never a lime glow.
- The dashboard card uses the same forest and lime, so the two read as one thing.

### The dashboard list

A "סקרים פתוחים" card on `/dashboard`, near `TraineeNotices`, listing every open, unanswered Survey the Trainee is in the audience of, each with its close date. Tapping one opens the same popup for that Survey. The card is absent when the list is empty. Answered Surveys are not shown to the Trainee again.

## Staff side

### Menu

A "סקרים" item at `/admin/surveys` in the "שחקנים" section, after "שאלונים" (`src/lib/navigation/admin-nav.ts:42`). The menu only knows `adminOnly` today, so add a flag for "Admin or Branch manager" to `NavItem` (`src/lib/navigation/types.ts`) and have the admin layout (`src/app/admin/layout.tsx`) pass whether the user manages a branch, from `getBranchScopeAction()`, into `AdminSidebar`. The pages redirect anyone else, as `/admin/orders` does (`src/app/admin/orders/page.tsx:19`).

### List: `/admin/surveys`

Every Survey the viewer may see, newest first: title, state, audience in words ("קריית אתא · 2014, 2015"), answered out of Seen with the percentage, close date, writer. A "סקר חדש" button. Tapping a row opens the Survey.

### Builder: `/admin/surveys/new` and `/admin/surveys/[id]/edit`

- Title, intro, audience, open date, optional close date. Audience: branch checkboxes limited to what the viewer may choose (reusing `BranchCheckboxGroup` from `src/features/branches/components/` where it fits), then birth-year checkboxes listing the years of the eligible Trainees in the chosen branches, newest first, each with its head count; none ticked means every year. The builder shows the resulting Audience size as it changes.
- Questions as an ordered list with add, remove and move up/down, following `RepeatableRows` (`src/features/development-book/components/admin/RepeatableRows.tsx`); no drag-and-drop library. Each Question: text, kind, required, and for choice kinds its options with the same add, remove and move controls.
- "תצוגה מקדימה" opens the trainee popup component with the draft, in a mode that sends nothing.
- Save keeps it a draft. "פרסום" runs `publishProblem()` on the server and lists every problem in Hebrew. Saving replaces the Survey's Questions and options in one step (all or nothing), which is safe only while there are no Responses; the server refuses Question changes once there are. A database function or a transaction is the builder's choice.
- After the first Response the builder shows the locked parts read-only with a one-line reason.

### Results: `/admin/surveys/[id]`, the answer grid (approved mockup)

Approved on 2026-10-29 from `.impeccable/mockups/surveys/results-matrix.html` (layout ג׳, chosen over a funnel-and-tabs page and a printable report). Like a spreadsheet: one row per Trainee, one column per Question, a summary row on top. In the incumbent admin look (forest green for actions only, white panels on hairlines, Heebo, tabular numerals, lucide icons at 16px).

- **Header:** breadcrumb back to סקרים, title with its state badge, audience and dates, and the actions the viewer may take (edit, close now, delete, CSV export).
- **Summary strip:** the number who answered, large, with "<percentage>% מ-<Seen> שראו"; a stacked bar of answered, saw but not answered, and did not see, out of the Audience, with a legend of the three counts; and answered out of Seen per branch.
- **Toolbar:** a segmented control "ענו <n>" / "ראו ולא ענו <n>" / "לא ראו <n>" (in the URL), a search box for a Trainee's name, and the branch (`BranchUrlFilter`, limited to the Survey's branches the viewer may see) and birth-year filters, both in the URL. Filters narrow the answers, Seen and the Audience alike, so percentages stay honest. Anyone who answered counts as Seen, so a percentage never passes 100.
- **The grid ("ענו"):** the first column, pinned while the grid scrolls sideways, holds the Trainee (initials, name, branch, birth year); then one column per Question, headed by its number, text and kind; then when it was sent. Cells: a rating as a small coloured square with the number (green shades for 3 to 5, amber for 1 and 2); a single choice as its text; a multiple choice as small tags; free text clipped to two lines, or "לא ענה" when skipped. Paged at 20 rows with the shared pagination.
- **The summary row,** first under the headers and labelled "סיכום · כל <n> העונים": a rating column shows the average to one decimal and five small bars for the counts of 1 to 5; a choice column shows its top two options with their shares; a text column shows how many wrote something.
- **A Question's full results:** tapping a column header opens a sheet with everything for that Question: every option's count and share of those who answered it (for multiple choice, a note that shares add up past 100%), the rating's average and full 1 to 5 distribution, or every free-text answer with name, branch and date, newest first. The summary row only shows the top of each column, so this sheet is where the per-question statistics live in full.
- **A Trainee's Response:** tapping a row opens a sheet with that Trainee's answers to every Question and a link to their staff trainee page.
- **"ראו ולא ענו":** a plain list instead of the grid: name, branch, birth year, when they first saw it, and a link to the staff trainee page, so staff can remind them in person.
- **"לא ראו":** the same list without the date. The segment's count makes it clear this is mostly former clients; no extra banner.
- **Phone:** the summary strip becomes a card (the number, the line under it, the stacked bar); the summary row becomes a collapsible "סיכום לפי שאלה" list (Question number, short text, top answer or average); the segmented control spans the width; each Trainee is a card with their name, branch, birth year and time, and their answers listed by Question number. Tapping a Question in the summary list opens the same full-results sheet.
- **CSV export:** one row per Response: name, branch, birth year, sent at, then one column per Question in order (multiple choice joined with ", "). Hebrew headers and the BOM, following `src/components/admin/exports/SubmissionExportButton.tsx`.
- All of it built by one pure function (`buildSurveyReport(questions, responses, seen, audience, filters)`) from rows a loader reads with the service role behind the access check, the way `/admin/finance` uses `buildIncomeReport()`. No caching; a Survey's results are read live.

## Data

New tables, in one migration applied before the code deploys (`npm run db:types` afterwards). Column names are the builder's call; what each table must hold:

- **surveys**: title, intro, `opens_on`, `closes_on`, the birth years (null or empty meaning all), and `created_by`/`created_at`, `published_at`/`published_by`, `closed_at`/`closed_by`, `updated_at` (shared `set_row_updated_at()` trigger).
- **survey_branches**: the audience's branches, one row per (survey, branch).
- **survey_questions**: survey, position, kind (`single_choice`, `multi_choice`, `rating`, `text`, as a text CHECK, no new enum), text, required.
- **survey_question_options**: question, position, label.
- **survey_views**: survey, Trainee, first seen at; unique (survey, Trainee). Written only by the Seen action.
- **survey_responses**: survey, Trainee, sent at, the snapshot of branch ids; unique (survey, Trainee).
- **survey_answers**: response, question, and the answer: an option (one row per chosen option for multiple choice), a rating 1 to 5, or text up to 1000 characters, with a CHECK that exactly one of the three is set.

House conventions (from recent migrations such as `20261005160000_void_refunds_notices.sql`): `uuid` keys with `gen_random_uuid()`, `timestamptz NOT NULL DEFAULT now()`, text CHECKs for kinds and lengths, an index on every foreign key, `ON DELETE CASCADE` from a Survey down to its answers, `COMMENT ON TABLE` saying who writes it, RLS enabled with no policies for `authenticated`, and `REVOKE ALL` from `anon` and `authenticated`. Every read and write goes through server actions with the service role, behind the checks above. Database functions are `SECURITY DEFINER SET search_path TO 'public'`, executable by `service_role` only.

## Code layout

A new feature module, `src/features/surveys/`, in the shape of `src/features/finance/` and `src/features/plans/`:

- `lib/` pure rules, each with tests written first: `surveyState`, `publishProblem`, `canEditSurvey`, `inSurveyAudience`, `answersProblem`, `pickSurveyToOffer`, `surveyPromptAllowedOn`, `buildSurveyReport`, and the CSV row builder.
- `lib/queries.ts` loaders (service role); `lib/actions/` server actions split one concern per file (save, publish, close, delete, mark seen, submit) with Zod schemas in `src/lib/validations/surveys.ts`.
- `components/admin/` (list, builder, results) and `components/trainee/` (popup, dashboard card).
- Pages under `src/app/admin/surveys/`.

## Left to the builder

Column and function names, the exact Hebrew copy beyond the words above, the visual design of the builder, popup and results (house style, phone first, tested at 320 to 1440 px), whether saving a draft uses a database function or sequential writes so long as it is all or nothing, and whether the Survey lock against a Response arriving mid-save is a row lock or a re-check inside the submit function.
