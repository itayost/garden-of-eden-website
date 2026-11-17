# Weekly Report in Approval Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every Friday, each Trainee in a pilot group who trained in the Report week gets a short Hebrew report written by Claude from facts the code computed, a staff member approves it, and at 12:00 the parent gets a WhatsApp link to it and the player sees it on the dashboard. A Trainee who stopped coming gets "התגעגענו" instead, and after three such weeks appears on a staff list.

**Architecture:** Three new server-only tables (settings per branch, one run per Report week, one report per Trainee per week). Pure rules, each tested first, decide the Report week and the send windows, who gets what, the Fact sheet, the allowed numbers, the guardrails and the edit ratio. Service-role loaders read one week for many Trainees. A writer module sends one Message Batches request per report at 01:00 Friday and writes whatever is missing with direct requests from 07:30. Two cron routes (write, send) wrap the jobs. Staff work in `/admin/weekly-reports`; parents read `/report/[token]`; players read a dashboard card. Everything lives in `src/features/weekly-reports/` except the routes and pages.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Supabase Postgres, Tailwind CSS 4, shadcn/Radix, Zod 4, Vitest, `@anthropic-ai/sdk` (new), Vercel cron, WhatsApp Cloud API templates.

**Spec:** `docs/superpowers/specs/2026-11-11-weekly-report-design.md`: "Who gets what", "The Fact sheet", "Writing", "Guardrails", "Approval queue", "Sending", "Data", "What already exists" and "Code layout". This plan is step 2 of its "Order of work". It needs step 1 (`docs/superpowers/plans/2026-11-15-weekly-report-inputs.md`, PR #178) merged: the Fact sheet reads its Check-ins, Quick tags and genders.

**Left for later steps, on purpose:**

- **Drills** need the metric-to-book map of step 3. Here the Fact sheet's drill candidates are always empty, so `drill_ids` comes back empty and the parent page shows no drills. The column, the output field, the guardrail and the page section are built now, so step 3 only fills the candidates.
- **Automatic mode, sampling, "דווח על טעות" and the switch back** are step 4. The columns exist from this migration (`approved_automatically`, `sampled`, `flagged_wrong_*`); nothing writes them yet. A branch set to `automatic` behaves as `approval`, and the settings card offers only off and approval.
- **The blind model comparison** runs through the preview script (Task 9) before the pilot; the model is a setting, so the choice needs no code change.

## Global Constraints

- Work on a branch `feat/weekly-reports` cut from `main` after PR #178 is merged. Commits use `feat(weekly-report): ...` (or `test(...)`, `refactor(...)`, `docs(...)`), ending with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Use `GRAPHIFY_SKIP_HOOK=1` for branch switches.
- All user-facing text in Hebrew; RTL; logical properties only (`ms-`/`me-`, `ps-`/`pe-`, `start`/`end`). No emojis anywhere, in code, copy, prompts or sample reports. No em dashes in copy or in the style guide.
- Immutable updates only. TypeScript strict, no `any`, no new `typedFrom` call sites.
- Every id from a client goes through `isValidUUID()`. Every date is an Israel calendar day (`israelToday()`, `israelDateStr()`, `getIsraelTime()`); a Report week is a Friday `week_start` string.
- The three new tables are read and written only by server code with `createAdminClient()`. Staff actions start with `verifyAdminOrTrainer()` (or `verifyAdmin()` for settings) and `assertTraineeInScope()`; lists filter by `getBranchScopeAction()`. Never rely on RLS for scope.
- Nothing the model sees may hold a full name, a phone number, a medical note, or a sensitive Shift report category. The Fact sheet builder is the only path to the model, and its tests pin this.
- The model never decides a number. Every digit in a text must be in the report's allowed list, or the report is held.
- Long id lists go through `readInChunks()` (`src/lib/supabase/in-chunks.ts`).
- Tests cover pure functions only. Vitest, files in a sibling `__tests__/` folder. Write each test first and watch it fail.
- Files at most 400 lines where possible (800 hard cap); functions under 50 lines.
- The migration is applied to production before the code deploys (expand only), then the types are regenerated. Never edit `src/types/database.generated.ts` by hand. Confirm with the user before applying.
- No real model call, WhatsApp message or production write happens during implementation except where a step says so and the user agrees. The preview script never writes to the database.
- Domain words from the spec and `CONTEXT.md`: Weekly report (דוח שבועי), Report week, Fact sheet (דף עובדות), Hold (עיכוב), Quick tag, Check-in, Trainee, Trainer, Slot, Roster.

## Review Focus

1. **A number the model made up reaches a parent.** Every digit in both texts must be in `allowedNumbers(sheet)`; otherwise the report is held, "approve" refuses it, and a staff edit is checked again on save. Pinned by `reportProblems` and `approveRefusal` (Tasks 6, 13).
2. **A sensitive entry reaches the model.** An injury, limitation, mental state, discipline, complaint or insufficient attention entry, a caution Quick tag, or a note on a Slot with a caution tag, never appears in the Fact sheet; it only holds the report. Pinned by the "never in the sheet" tests in Task 4, which stringify the sheet and search for the planted text.
3. **Another child's name in the sheet.** A Shift report's shared details text may name other children, so it is used only when the category names this Trainee alone. Pinned in Task 4.
4. **A message sent twice.** A send window that runs twice, or two runs that overlap, claim each row with one conditional update before sending. Pinned by the claim in Task 12 and checked by running the send route twice in the manual test.
5. **Nothing sent on Friday afternoon or Shabbat**, across daylight saving. Pinned by `isSendWindow` (Task 2).
6. **A report link used as a purchase link, or the other way round.** The report token has its own prefix and MAC input; `verifyRenewalToken()` refuses it and `verifyReportToken()` refuses renewal tokens. Pinned in Task 11.
7. **A Trainer sees or approves a report of another branch.** Every loader and action filters by scope. Checked manually with a Trainer of one branch.
8. **"התגעגענו" to a family that trained**: through Arbox only (חיפה), or during a Freeze. Arbox entrances count as training; a failed Arbox read turns "התגעגענו" off for the week; a Freeze overlapping the week means nothing is sent. Pinned in Task 3.

---

### Task 1: Migration and types

**Files:**
- Create: `supabase/migrations/<version>_weekly_reports.sql` (the version Supabase records when the migration is applied, as in step 1)
- Modify: `src/types/database.generated.ts` (regenerated, never by hand)

- [ ] **Step 1: Write the migration exactly as below.**

```sql
-- Weekly reports, spec docs/superpowers/specs/2026-11-11-weekly-report-design.md
-- (plan docs/superpowers/plans/2026-11-16-weekly-report-approval.md).
--
-- Expand only: three new tables. Apply this BEFORE deploying the code, which
-- reads and writes them; the code running today never touches them. Safe to
-- rerun. Needs set_row_updated_at() (20260911120000).
--
-- The tables are read and written only by server code with the service role:
-- RLS is on with no policies, and anon and authenticated have no grants.

SET LOCAL lock_timeout = '3s';

CREATE TABLE IF NOT EXISTS public.weekly_report_settings (
  branch_id uuid PRIMARY KEY REFERENCES public.branches(id) ON DELETE CASCADE,
  mode text NOT NULL DEFAULT 'off'
    CONSTRAINT weekly_report_settings_mode_known CHECK (mode IN ('off', 'approval', 'automatic')),
  birth_years smallint[]
    CONSTRAINT weekly_report_settings_birth_years_sane CHECK (
      birth_years IS NULL OR (
        cardinality(birth_years) BETWEEN 1 AND 30
        AND 1950 <= ALL (birth_years) AND 2030 >= ALL (birth_years)
      )
    ),
  missed_you boolean NOT NULL DEFAULT false,
  changed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS weekly_report_settings_changed_by_idx
  ON public.weekly_report_settings (changed_by);

COMMENT ON TABLE public.weekly_report_settings IS
  'Weekly report mode per branch (off, approval, automatic), the pilot birth years (null = all) and whether "התגעגענו" goes out. Written by saveReportSettingsAction with the service role.';

CREATE TABLE IF NOT EXISTS public.weekly_report_runs (
  week_start date PRIMARY KEY
    CONSTRAINT weekly_report_runs_friday CHECK (extract(isodow FROM week_start) = 5),
  batch_id text,
  model text NOT NULL,
  prompt_version text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  batch_collected_at timestamptz,
  finished_at timestamptz
);

COMMENT ON TABLE public.weekly_report_runs IS
  'One writing run per Report week: the Message Batches id and when it was collected. Written by the weekly-reports-write cron with the service role.';

CREATE TABLE IF NOT EXISTS public.weekly_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trainee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  week_start date NOT NULL
    CONSTRAINT weekly_reports_friday CHECK (extract(isodow FROM week_start) = 5),
  kind text NOT NULL
    CONSTRAINT weekly_reports_kind_known CHECK (kind IN ('report', 'missed_you', 'absent')),
  status text NOT NULL
    CONSTRAINT weekly_reports_status_known CHECK (
      status IN ('pending', 'held', 'approved', 'sent', 'not_sent', 'listed')
    ),
  branch_ids uuid[] NOT NULL,
  hold_reasons jsonb NOT NULL DEFAULT '[]'::jsonb,
  fact_sheet jsonb,
  model text,
  prompt_version text,
  original_output jsonb,
  player_text text,
  parent_text text,
  drill_ids uuid[] NOT NULL DEFAULT '{}',
  usage jsonb,
  written_at timestamptz,
  edited_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  edited_at timestamptz,
  edit_ratio numeric(4,3) CONSTRAINT weekly_reports_edit_ratio_range CHECK (edit_ratio BETWEEN 0 AND 1),
  approved_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at timestamptz,
  approved_automatically boolean NOT NULL DEFAULT false,
  held_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  held_at timestamptz,
  sent_at timestamptz,
  parent_message_id text,
  parent_skip_reason text,
  parent_first_opened_at timestamptz,
  player_first_opened_at timestamptz,
  flagged_wrong_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  flagged_wrong_at timestamptz,
  flagged_wrong_reason text,
  sampled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT weekly_reports_once_a_week UNIQUE (trainee_id, week_start),
  CONSTRAINT weekly_reports_absent_is_listed CHECK ((kind = 'absent') = (status = 'listed')),
  CONSTRAINT weekly_reports_sent_has_time CHECK ((status = 'sent') = (sent_at IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS weekly_reports_week_status_idx ON public.weekly_reports (week_start, status);
CREATE INDEX IF NOT EXISTS weekly_reports_branch_ids_idx ON public.weekly_reports USING gin (branch_ids);
CREATE INDEX IF NOT EXISTS weekly_reports_edited_by_idx ON public.weekly_reports (edited_by);
CREATE INDEX IF NOT EXISTS weekly_reports_approved_by_idx ON public.weekly_reports (approved_by);
CREATE INDEX IF NOT EXISTS weekly_reports_held_by_idx ON public.weekly_reports (held_by);
CREATE INDEX IF NOT EXISTS weekly_reports_flagged_wrong_by_idx ON public.weekly_reports (flagged_wrong_by);

COMMENT ON TABLE public.weekly_reports IS
  'One Weekly report, "התגעגענו" or "לא הגיעו 3 שבועות" row per Trainee per Report week (Friday start). Written by the weekly-reports cron jobs and the queue actions with the service role.';
COMMENT ON COLUMN public.weekly_reports.branch_ids IS
  'The Trainee''s report branches when the row was made; staff scope filters on it.';
COMMENT ON COLUMN public.weekly_reports.hold_reasons IS
  'Array of {code, text}. Text problems are recomputed on every edit and rewrite; sensitive and manual ones stay until a person approves.';
COMMENT ON COLUMN public.weekly_reports.fact_sheet IS
  '{sheet, body}: sheet is exactly what the model saw; body (measurements, dietitian note) is shown by code and never sent to the model.';

DROP TRIGGER IF EXISTS weekly_reports_updated_at ON public.weekly_reports;
CREATE TRIGGER weekly_reports_updated_at
  BEFORE UPDATE ON public.weekly_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_row_updated_at();

ALTER TABLE public.weekly_report_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_report_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weekly_reports ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.weekly_report_settings FROM anon, authenticated;
REVOKE ALL ON public.weekly_report_runs FROM anon, authenticated;
REVOKE ALL ON public.weekly_reports FROM anon, authenticated;
```

- [ ] **Step 2:** Ask the user, then apply it to production through the Supabase connector (`apply_migration`, name `weekly_reports`), and save the file under the version it records.
- [ ] **Step 3:** Verify: the three tables exist with RLS on and no policies; `anon` and `authenticated` hold no privileges on them (`information_schema.role_table_grants`); an insert with `week_start` on a Thursday fails the CHECK.
- [ ] **Step 4:** Regenerate the types (`npm run db:types`, or the connector's `generate_typescript_types` written over the file), then `npx tsc --noEmit`.
- [ ] **Step 5: Commit** `feat(weekly-report): weekly report tables`.

---

### Task 2: Report week and send windows

**Files:**
- Create: `src/features/weekly-reports/lib/report-week.ts`
- Test: `src/features/weekly-reports/lib/__tests__/report-week.test.ts`

**Interfaces (pure):**
- `weekdayOf(date: string): number`: 0 Sunday to 6 Saturday, from the ISO date alone (`Date.UTC`), never from the server's zone.
- `reportWeekStart(date: string): string`: the Friday on or before `date`.
- `reportWeekEnd(start: string): string`: `addDays(start, 6)`, a Thursday.
- `reportWeekDays(start: string): string[]`: the seven dates, Friday first.
- `lastCompletedWeekStart(today: string): string`: `addDays(reportWeekStart(today), -7)`. On any day from Friday to Thursday this is the week that ended on the most recent Thursday before today: the week written in the night to Friday and sent until the next Thursday. "The current Report week" in every screen and job means this.
- `weeksBetween(earlierStart: string, laterStart: string): number`: whole weeks between two Friday starts.
- `reportWeekLabel(start: string): string`: "13.11 עד 19.11" (day.month, no year).
- `writePhase(now: IsraelTime): "start" | "finish" | null`: `"start"` on Friday (`dayOfWeek === 5`) at hour 1; `"finish"` on Friday from 07:30 to 11:59; otherwise null.
- `isSendWindow(now: IsraelTime): boolean`: Friday at hour 12, or Sunday to Thursday (`dayOfWeek` 0 to 4) at hour 9. Never Friday at any other hour, never Saturday.

- [ ] **Step 1: Write the failing tests:** `reportWeekStart` gives `2026-11-20` for Friday `2026-11-20`, `2026-11-13` for Thursday `2026-11-19` and `2026-11-20` for Saturday `2026-11-21`; `reportWeekDays("2026-11-13")` runs from `2026-11-13` to `2026-11-19`; `lastCompletedWeekStart` gives `2026-11-13` on Friday `2026-11-20`, on Sunday `2026-11-22` and on Thursday `2026-11-26`, and `2026-11-20` on Friday `2026-11-27`; `weeksBetween("2026-10-23", "2026-11-20")` is 4. `writePhase` and `isSendWindow` take `getIsraelTime(new Date(...))` of UTC instants so the tests cover both offsets: winter `2026-11-19T23:00:00Z` (Friday 01:00 Israel) is `"start"` and `2026-11-19T22:00:00Z` (Friday 00:00) is null; summer `2027-04-01T22:00:00Z` (Friday 01:00 at UTC+3) is `"start"`; `2026-11-20T05:30:00Z` (07:30) is `"finish"` and `2026-11-20T05:29:00Z` is null; `2026-11-20T10:00:00Z` (12:00 Friday) is a send window; `2026-11-20T07:00:00Z` (09:00 Friday) is not; `2026-11-21T07:00:00Z` (09:00 Saturday) is not; `2026-11-22T07:00:00Z` (09:00 Sunday) and `2026-11-26T07:00:00Z` (09:00 Thursday) are.
- [ ] **Step 2: Run** `npm run test:run -- src/features/weekly-reports/lib/__tests__/report-week.test.ts` (FAIL), **Step 3:** implement, **Step 4: Run** (PASS).
- [ ] **Step 5: Commit** `feat(weekly-report): report week and send windows`.

---

### Task 3: Who gets what

**Files:**
- Create: `src/features/weekly-reports/lib/audience.ts`
- Test: `src/features/weekly-reports/lib/__tests__/audience.test.ts`

**Interfaces (pure):**
- `type ReportMode = "off" | "approval" | "automatic"`.
- `interface ReportSetting { branchId: string; mode: ReportMode; birthYears: number[] | null; missedYou: boolean }`.
- `reportBranches(candidate: AudienceCandidate, settings: readonly ReportSetting[]): string[]`: the setting branches that are not `off` and for which `inSurveyAudience(candidate, { branchIds: [setting.branchId], birthYears: setting.birthYears ?? [] })` holds (active, not deleted, full access, a member of that branch, the birth year when named). Reuses `AudienceCandidate` and `inSurveyAudience` from `src/features/surveys/lib/audience.ts`.
- `interface TrainingRow { date: string; counts: boolean }` and `trainingDays(roster: readonly TrainingRow[], arboxDates: readonly string[]): string[]`: the distinct, sorted dates of counted Roster rows (`counts` is `rowCounts()` of the row, worked out by the loader) and Arbox entrances. One day counts once.
- `interface FreezeSpan { startsOn: string; endsOn: string | null; endedOn: string | null }` and `freezeTouchesWeek(freeze: FreezeSpan, weekStart: string): boolean`: true when the Freeze covers any day of the week: it starts on or before the week's Thursday, and it neither ended (`endsOn`) nor was ended early (`endedOn`, the Israel day of `ended_at`) before the week's Friday.
- `type WeekKind = "report" | "missed_you" | "absent" | "nothing"`.
- `classifyWeek(input: { weekStart: string; days: readonly string[]; frozen: boolean; missedYouOn: boolean }): WeekKind`:
  - A day inside the week gives `"report"`.
  - Otherwise, when `!missedYouOn`, or `frozen`, or there is no earlier day: `"nothing"`.
  - Otherwise `k = weeksBetween(reportWeekStart(lastDay), weekStart)`: 1 to 3 gives `"missed_you"`, 4 gives `"absent"`, more gives `"nothing"`.
- `missedYouAllowed(branchIds: readonly string[], settings: readonly ReportSetting[], arboxReadFailed: boolean): boolean` (its result is `classifyWeek`'s `missedYouOn`): false when the Arbox read failed this run, else true when any of the Trainee's report branches has `missedYou`.

- [ ] **Step 1: Write the failing tests:** a candidate in an `off` branch has no report branches; a birth year outside the list is left out; a list of `null` takes every year; a course-only or inactive candidate is left out; two `approval` branches give both ids. `trainingDays` drops rows that do not count and merges a Roster day with an Arbox entrance on the same date. `freezeTouchesWeek`: a Freeze ending the Thursday before is false, one starting on the Thursday is true, an open-ended one started earlier is true, one ended early on the Wednesday before is false. `classifyWeek`: trained on the Thursday gives `"report"`; last trained 1, 2 and 3 weeks back gives `"missed_you"`; 4 gives `"absent"`; 5 gives `"nothing"`; frozen gives `"nothing"`; `missedYouOn` false gives `"nothing"` even at 2 weeks; never trained gives `"nothing"`. `missedYouAllowed` is false when the Arbox read failed, and true when one of two branches has it on.
- [ ] **Step 2: Run** (FAIL), **Step 3:** implement, **Step 4: Run** (PASS).
- [ ] **Step 5: Commit** `feat(weekly-report): who gets a report, a missed-you or nothing`.

---

### Task 4: The Fact sheet, part one: types, attendance, what we did, progress, holds

**Files:**
- Create: `src/features/weekly-reports/lib/fact-sheet/types.ts`, `src/features/weekly-reports/lib/fact-sheet/sensitive.ts`, `src/features/weekly-reports/lib/fact-sheet/shift-notes.ts`, `src/features/weekly-reports/lib/fact-sheet/training.ts`
- Test: `src/features/weekly-reports/lib/fact-sheet/__tests__/shift-notes.test.ts`, `__tests__/training.test.ts`

The Fact sheet is plain JSON with Hebrew labels, small enough to read in the queue sheet. The input type is what the loaders (Task 7) produce, already narrowed to the week and the Trainee.

**Interfaces (types, in `types.ts`):**

```ts
export type HoldCode =
  | "number" | "drill" | "length" | "forbidden_word" | "missing_gender" | "writing_failed" // text problems
  | "sensitive" | "manual"; // need a person
export interface HoldReason { code: HoldCode; text: string }
export const TEXT_PROBLEM_CODES: readonly HoldCode[] = [
  "number", "drill", "length", "forbidden_word", "missing_gender", "writing_failed",
];

export interface WeekRosterRow {
  date: string; startTime: string; focus: string | null; slotId: string;
  counts: boolean; lateCancel: boolean; trainerFirstNames: string[];
}
export interface WeekTag { slotId: string; date: string; tag: QuickTagKey }
export interface WeekNote { slotId: string; date: string; note: string }
export interface WeekSession { date: string; exercises: { name: string; category: string | null; target: string }[] }

export interface TraineeWeekInput {
  weekStart: string;
  profile: {
    gender: Gender | null; birthdate: string | null; position: string | null;
    ageGroup: string | null; branchNames: string[];
  };
  roster: WeekRosterRow[];
  arbox: { date: string; className: string | null }[];
  shiftReports: ShiftReportForNotes[]; // the week's reports that name the Trainee
  sessions: WeekSession[];
  tags: WeekTag[];
  notes: WeekNote[];
  checkins: Checkin[];
  preForms: { date: string; sleepRange: "4-6" | "6-8" | "8-11" | null }[];
  postForms: { date: string; difficulty: number | null; satisfaction: number | null }[];
  assessment: { inWeek: PlayerAssessment | null; previous: PlayerAssessment | null; groupStats: GroupStats | null };
  measurement: { inWeek: NutritionMeasurement | null; previous: NutritionMeasurement | null };
  dietitianNote: string | null;
  goals: PlayerGoalRow[]; // open Goals (achieved_at is null)
  nextGame: { date: string; opponent: string } | null;
  drillCandidates: DrillCandidate[]; // always [] until step 3
}

export interface FactSheet {
  version: 1;
  week: { from: string; to: string };
  player: { gender: Gender | null; ageGroup: string | null; position: string | null; branches: string[] };
  attendance: { total: number; lateCancels: number; days: { date: string; weekday: string; focus: string | null; trainers: string[]; source: "יומן" | "ארבוקס" }[] };
  workedOn: { date: string; source: string; items: string[] }[];
  progress: { date: string; source: string; label: string; details: string | null; categories: string[] }[];
  habits: Habits | null;          // Task 5
  assessment: AssessmentFacts | null; // Task 5
  goals: GoalFact[];             // Task 5
  drills: { id: string; name: string; why: string | null }[];
  nextGame: { date: string; opponent: string } | null;
  hasNewMeasurement: boolean;
  hasDietitianNote: boolean;
}

export interface BodyFacts { /* Task 5 */ }

export interface BuiltSheet { sheet: FactSheet; body: BodyFacts | null; holds: HoldReason[] }
```

**Interfaces (pure):**
- `sensitive.ts`: `WRITTEN_NOTE_TYPES = ["worked_on", "achievements", "praise", "homework", "video_feedback"]`, `SENSITIVE_NOTE_TYPES = ["injuries", "limitations", "mental_state", "discipline", "complaints", "insufficient_attention"]`, `IGNORED_NOTE_TYPES = ["new_trainee", "pro_candidates", "social_skills"]` (together exactly the 14 `NoteCategoryType` values; a test checks no type is missing, so a new Shift report category cannot slip through unclassified).
- `shift-notes.ts`:
  - `traineeDetails(report: ShiftReportForNotes, column: CategoryColumn, traineeId: string): string | null`: the Trainee's own per-trainee details (`parsePerTrainee`) when not blank; else the report-level details only when the category names this Trainee alone (its id list and its per-trainee keys hold no other id); else null. Never the shared text of a category that names several children.
  - `shiftReportFacts(reports: readonly ShiftReportForNotes[], traineeId: string): { workedOn: FactSheet["workedOn"]; progress: FactSheet["progress"]; holds: HoldReason[] }`: walks `CATEGORY_COLUMNS`. `worked_on` goes to `workedOn` with its work topics (`categories`) and details; `achievements` (with `ACHIEVEMENT_CATEGORIES` categories), `praise`, `homework` and `video_feedback` go to `progress` with `NOTE_CATEGORY_LABELS`; `source` is "דוח משמרת, המאמן <first name>" (the first word of `trainer_name`). A sensitive category naming the Trainee adds one hold `{ code: "sensitive", text: "דוח משמרת מ-<DD/MM> מציין <label>" }` and copies nothing. Ignored categories copy nothing and hold nothing.
- `training.ts`:
  - `attendanceFacts(roster, arbox): FactSheet["attendance"]`: counted Roster days and Arbox days merged by date (Roster wins on the same date), with the Hebrew weekday ("יום שלישי"), the Slot Focus and the Trainers' first names; `lateCancels` counts rows with `lateCancel`; `total` is the number of days.
  - `sessionFacts(sessions): FactSheet["workedOn"]`: one item per session, "תרגיל: <name> (<category>), <target>", source "אימון אישי".
  - `tagFacts(tags, notes): { progress: FactSheet["progress"]; holds: HoldReason[] }`: positive tags become progress items with their Hebrew labels (`QUICK_TAGS`), grouped per Slot, with that Slot's note as `details`. A caution tag holds the report (`{ code: "sensitive", text: "תגית <label> מ-<DD/MM>" }`) and removes the note of that Slot from the sheet, since it may describe the pain.

- [ ] **Step 1: Write the failing tests.** Build fixtures with planted strings (`"PLANTED-INJURY"`, `"PLANTED-OTHER-CHILD"`, `"PLANTED-PAIN-NOTE"`):
  - An injuries entry naming the Trainee gives one `sensitive` hold, and `JSON.stringify` of the result does not contain `"PLANTED-INJURY"`.
  - A pro candidates entry gives no hold and no item.
  - A worked-on entry with per-trainee details uses them; one without per-trainee details whose category names two children does not copy the shared text `"PLANTED-OTHER-CHILD"`; one whose category names only this Trainee copies the shared text.
  - Achievements keep their categories; praise, homework and video feedback appear in `progress`.
  - The trainer source holds the first name only.
  - The three type lists cover all 14 note types exactly once.
  - `attendanceFacts` merges a Roster day and an Arbox entrance on one date into one day; a late cancel is counted; a row that does not count is not a day.
  - `tagFacts`: positive tags with a note become one item; a caution tag on a Slot holds and drops that Slot's note (`"PLANTED-PAIN-NOTE"` absent from the stringified result) while a note on another Slot stays.
- [ ] **Step 2: Run** (FAIL), **Step 3:** implement, **Step 4: Run** (PASS).
- [ ] **Step 5: Commit** `feat(weekly-report): fact sheet attendance, work and progress, with sensitive holds`.

---

### Task 5: The Fact sheet, part two: habits, assessment, body, goals, the builder, allowed numbers

**Files:**
- Create: `src/features/weekly-reports/lib/fact-sheet/habits.ts`, `assessment.ts`, `body.ts`, `goals.ts`, `build.ts`, `allowed-numbers.ts`
- Test: `__tests__/habits.test.ts`, `__tests__/assessment.test.ts`, `__tests__/build.test.ts`, `__tests__/allowed-numbers.test.ts`

**Interfaces (pure):**
- `habits.ts`: `habitsFacts(checkins, preForms, postForms): Habits | null` with `Habits = { checkins: number; sleepAverage: number | null; sleepLowest: number | null; energyAverage: number | null; sorenessDays: number; preFormSleep: string | null; postForm: { difficultyAverage: number | null; satisfactionAverage: number | null } | null }`. Averages rounded to one decimal. `preFormSleep` is used only when there is no Check-in: the most common range as its Hebrew label ("6-8 שעות"). Null when the week has none of the three.
- `assessment.ts`: `assessmentFacts(input: TraineeWeekInput["assessment"]): AssessmentFacts | null`, null without an Assessment in the week. With a previous one, `compareAssessments(previous, inWeek)` gives the changes; keep the improvements (`isImprovement === true`) with `ASSESSMENT_LABELS_HE` labels and their `formatted` delta, and count the rest. The rating is `calculateCardRatings(inWeek, groupStats).overall_rating` when `groupStats` is known. `AssessmentFacts = { date: string; first: boolean; improvements: { label: string; change: string }[]; unchanged: number; regressions: number; rating: number | null }`. Regressions are counted, never named: the report is about progress, and staff see the numbers in the Assessment screens.
- `body.ts`: `bodyFacts(measurement, dietitianNote): BodyFacts | null`, null without a measurement in the week. `BodyFacts = { date: string; weightKg: number | null; heightCm: number | null; bmi: number | null; bmiPercentile: number | null; heightPercentile: number | null; change: { weightKg: number | null; heightCm: number | null } | null; dietitianNote: string | null }`. `change` against the previous measurement. This object is never given to the model.
- `goals.ts`: `goalFacts(goals: PlayerGoalRow[]): GoalFact[]` through `calculateGoalProgress()`: `{ metric: string; baseline: number | null; current: number | null; target: number; unit: string; progressPercent: number; status: string }`.
- `build.ts`: `buildFactSheet(input: TraineeWeekInput): BuiltSheet`. Combines Tasks 4 and 5. Adds `{ code: "missing_gender", text: "חסר מגדר" }` when `profile.gender` is null. `hasNewMeasurement` is `body !== null`; `hasDietitianNote` is `body?.dietitianNote != null`. `drills` maps `drillCandidates`. Holds are de-duplicated by text.
- `allowed-numbers.ts`:
  - `normalizeNumber(raw: string): string`: comma to dot, leading zeros and trailing fractional zeros dropped (`"7,50"` gives `"7.5"`, `"08"` gives `"8"`, `"00"` gives `"0"`).
  - `numbersIn(text: string): string[]`: every `\d+(?:[.,]\d+)?` in the text, normalized.
  - `allowedNumbers(sheet: FactSheet): Set<string>`: every number value in the sheet and every number inside its strings (walked recursively), normalized, plus `sheet.drills.length`.

- [ ] **Step 1: Write the failing tests:** `habitsFacts` averages 7, 8 and 7.5 to 7.5 and finds the lowest; it counts soreness days; it falls back to the pre-form range only without Check-ins; null for an empty week. `assessmentFacts` lists improvements with labels, counts regressions without naming them, sets `first` when there is no previous Assessment, and leaves `rating` null without group stats. `buildFactSheet` on a full fixture: the stringified sheet holds no `full_name`, no phone digits from the fixture profile, no `body` numbers (a planted weight `"61.3"` is in `body` and absent from `sheet`), no dietitian text (planted), and the gender hold appears when gender is null. `allowedNumbers` holds `7.5` from a habits average and `3` from a note "3 סטים"; `numbersIn("ישן 7,5 שעות ב-08:00")` gives `["7.5", "8", "0"]`.
- [ ] **Step 2: Run** (FAIL), **Step 3:** implement, **Step 4: Run** (PASS).
- [ ] **Step 5: Commit** `feat(weekly-report): fact sheet habits, assessment, body, goals and allowed numbers`.

---

### Task 6: Guardrails and the edit ratio

**Files:**
- Create: `src/features/weekly-reports/lib/guardrails.ts`, `src/features/weekly-reports/lib/forbidden-words.ts`, `src/features/weekly-reports/lib/edit-ratio.ts`, `src/features/weekly-reports/lib/approval.ts`
- Test: `__tests__/guardrails.test.ts`, `__tests__/edit-ratio.test.ts`, `__tests__/approval.test.ts`

**Interfaces (pure):**
- `PLAYER_TARGET_WORDS = 110`, `PARENT_TARGET_WORDS = 140`, `LENGTH_FACTOR = 1.5`, `MAX_DRILLS = 3`.
- `interface WriterOutput { player_text: string; parent_text: string; drill_ids: string[] }`.
- `forbidden-words.ts`: `FORBIDDEN_PHRASES: readonly string[]`, a starter list for staff to extend: פציעה, פצוע, נפצע, כאב, כואב, אבחנה, אבחון, רופא, תרופה, פיזיותרפיה, דיאטה, הרזיה, לרזות, ירידה במשקל, עלייה במשקל, משקל גוף, שומן, קלוריות, השמנה, דיכאון, חרדה, הפרעה. (Not "משקל" alone: "משקלות" is a training word.) `forbiddenIn(text: string): string[]`: each phrase found at a word start, allowing up to three Hebrew prefix letters (ו, ה, ב, ל, מ, ש, כ) before it, so "ופציעה" and "לפציעות" match and "מכאבו" does not count as a word start of כאב.
- `guardrails.ts`: `reportProblems(sheet: FactSheet, output: WriterOutput): HoldReason[]`:
  - Each number in either text not in `allowedNumbers(sheet)`: `{ code: "number", text: "מספר שלא מופיע בנתונים: <n>" }`.
  - A drill id not among `sheet.drills`, or more than `MAX_DRILLS`: `{ code: "drill", ... }`.
  - A text that is empty, or longer than `LENGTH_FACTOR` times its target in words: `{ code: "length", text: "הטקסט להורה ארוך מדי (212 מילים)" }`.
  - A forbidden phrase: `{ code: "forbidden_word", text: "מילה אסורה: <phrase>" }`.
  - `sheet.player.gender === null`: the `missing_gender` hold.
- `replaceTextProblems(current: readonly HoldReason[], fresh: readonly HoldReason[]): HoldReason[]`: keeps every reason whose code is not a text problem and adds `fresh`.
- `edit-ratio.ts`: `editRatio(original: string, edited: string): number`: Levenshtein distance over characters divided by the longer length, 0 for two empty strings, rounded to three decimals. `combinedEditRatio(original: WriterOutput, player: string, parent: string): number` over `player + "\n" + parent`. `SIGNIFICANT_EDIT = 0.15`.
- `approval.ts`: `approveRefusal(report: { kind: string; status: string; playerText: string | null; parentText: string | null; holdReasons: HoldReason[] }): string | null`:
  - `kind === "absent"`: "אין מה לאשר בשורה הזו".
  - `status` `sent`: "הדוח כבר נשלח"; `not_sent`: "השבוע של הדוח נסגר"; `approved`: "הדוח כבר אושר".
  - A report with no texts: "אין עדיין טקסט לאישור".
  - Any text problem among `holdReasons`: "צריך לתקן לפני אישור: <texts joined with ' · '>".
  - Otherwise null. A `sensitive` or `manual` reason does not refuse: a person opening the report and approving it is the review. "אשר את כל הממתינים" approves only `pending` rows, so held rows always need that person.

- [ ] **Step 1: Write the failing tests:** an invented "12" with no 12 in the sheet holds; "7.5" from the sheet passes, written "7,5" passes too; a drill id not in the candidates holds and so do four ids; a player text of 170 words holds and 160 does not; an empty parent text holds; "ופציעה" holds, "משקלות" passes; missing gender holds; `replaceTextProblems` keeps a `manual` reason and drops an old `number` reason. `editRatio("abc", "abc")` is 0, `("", "")` is 0, `("abc", "xyz")` is 1, one changed character in 100 is 0.01. `approveRefusal`: held only by `sensitive` gives null; a `number` problem refuses with its text; `sent`, `not_sent`, `approved`, `absent` and no-text cases each give their message.
- [ ] **Step 2: Run** (FAIL), **Step 3:** implement, **Step 4: Run** (PASS).
- [ ] **Step 5: Commit** `feat(weekly-report): guardrails, edit ratio and the approval rule`.

---

### Task 7: Week loaders

**Files:**
- Create: `src/features/weekly-reports/lib/queries/settings.ts`, `queries/training.ts`, `queries/week-input.ts`, `queries/rows.ts` (each `import "server-only"`)

Service role, for many Trainees and one date range. Every read that takes Trainee ids goes through `readInChunks()`. A failed read throws with the table's name: a job that silently writes half a report is worse than a job that stops and logs.

**Interfaces:**
- `settings.ts`: `loadReportSettings(db): Promise<ReportSetting[]>`.
- `training.ts`:
  - `loadTrainingRows(db, traineeIds, from, to): Promise<Map<string, WeekRosterRow[]>>`: `daily_schedule_slot_trainees` joined to `daily_schedule_slots!inner(schedule_date, start_time, focus_he, called_off_at, trainers:daily_schedule_slot_trainers(trainer_name, order_index))`, filtered by `trainee_id` (chunks) and the slot date range; `counts = rowCounts({ cancelled_at, late_cancel, called_off: called_off_at !== null })`; rows with `removed_at` set never count (a recorded removal carries a non-late `cancelled_at`, so `rowCounts` already says false; keep it explicit).
  - `loadArboxDays(profiles: { id: string; arboxUserId: number | null }[], from, to): Promise<{ byProfile: Map<string, { date: string; className: string | null }[]>; failed: boolean }>`: one `fetchEntranceReport(from, to)` call when any profile has an Arbox id; entries matched on `user_id === arbox_user_id` (as `get-report-data.ts` does). A throw (no `ARBOX_API_KEY`, Arbox down) is logged and gives `failed: true` with an empty map.
  - `loadFreezes(db, traineeIds, weekStart): Promise<Map<string, FreezeSpan[]>>`: `plan_freezes` joined to `trainee_plans!inner(profile_id)`, `endedOn = israelDateStr(ended_at)` when set.
- `week-input.ts`: `loadWeekInputs(db, trainees: { id: string; branchIds: string[] }[], weekStart: string, today: string): Promise<Map<string, TraineeWeekInput>>`. In parallel, each with the week's range (`weekStart` to `reportWeekEnd`):
  - Profiles: `gender, birthdate, position, age_group_override, age_group_override_until`; `ageGroup` through `resolveAgeGroup(profile, reportWeekEnd)`; branch names from `branches`.
  - `trainer_shift_reports` with `report_date` in the week (one small read for everyone; the Fact sheet code picks per Trainee).
  - `training_sessions` with `session_date` in the week and their exercises: `id, trainee_id, session_date, exercises:training_session_exercises(order_index, target_sets, target_reps_he, target_reps, target_load_he, target_weight_kg, target_duration_seconds, target_distance_m, exercise:workout_exercises(name_he, name_en, main_category))`, the target through `formatExerciseTarget()`.
  - `slot_trainee_tags` and `slot_trainee_notes` of the week's Slots for these Trainees.
  - `trainee_checkins` with `checkin_date` in the week.
  - `pre_workout_forms` and `post_workout_forms` by the Israel day of `submitted_at` (post forms by `training_date`).
  - `player_assessments` (`deleted_at` null) for these Trainees up to the week's end: the latest in the week and the one before it; `fetchGroupStats()` once per age group met.
  - `nutrition_measurements` (`deleted_at` null): the latest in the week and the one before; `nutrition_recommendations` (`deleted_at` null) `recommendation_text`.
  - `player_goals` with `achieved_at` null; `trainee_next_games` with `game_date >= today`.
  - `drillCandidates: []` (step 3 fills it).
- `rows.ts` (used by the jobs and the queue):
  - `upsertWeekRows(db, rows: NewReportRow[]): Promise<void>`: insert with `onConflict: "trainee_id,week_start"` and `ignoreDuplicates: true`, so a rerun never overwrites a written or approved row.
  - `closeEarlierWeeks(db, weekStart): Promise<number>`: `pending`, `held` and `approved` rows with an earlier `week_start` become `not_sent`.
  - `loadRowsToWrite(db, weekStart): Promise<{ id: string; sheet: FactSheet }[]>`: `kind = report`, `written_at` null, status `pending` or `held` with no `missing_gender` reason.
  - `saveWriterResult(db, id, result)` and `saveWriterFailure(db, id)`: write the texts, `original_output`, `model`, `prompt_version`, `usage`, `written_at`, the guardrail holds merged by `replaceTextProblems`, and the status (`held` when any reason remains, else `pending`); a failure adds `{ code: "writing_failed", text: "הכתיבה נכשלה" }` and sets `held`. Each is one conditional update on `written_at is null`, so a late batch result never overwrites a direct write.

- [ ] **Step 1:** Write the four files.
- [ ] **Step 2: Run** `npx tsc --noEmit` and `npm run lint`.
- [ ] **Step 3: Commit** `feat(weekly-report): week loaders`.

These are checked against production data by the preview script (Task 9), read-only.

---

### Task 8: The writer

**Files:**
- Modify: `package.json` (`npm install @anthropic-ai/sdk`), `src/lib/env.ts` (`ANTHROPIC_API_KEY`, `WEEKLY_REPORT_MODEL` in `optionalServerVars`), `.env.local.example` (the two names, empty)
- Create: `src/features/weekly-reports/lib/writer/style-guide.ts`, `writer/output.ts`, `writer/request.ts`, `writer/client.ts` (`import "server-only"`), `writer/batch.ts` (`import "server-only"`), `writer/direct.ts` (`import "server-only"`), `src/features/weekly-reports/lib/fill-name.ts`
- Test: `writer/__tests__/output.test.ts`, `__tests__/fill-name.test.ts`

**Interfaces:**
- `style-guide.ts`: `PROMPT_VERSION = "2026-11-16.1"` (bumped on every wording change) and `STYLE_GUIDE: string`, the system prompt in Hebrew. It states: who writes (the academy's coaching staff, warm and direct, never salesy); the two readers; use only facts in the Fact sheet; write `{שם}` where the first name goes and never invent a name; any number must appear in the sheet, no dates (write the weekday); no medical, injury, diet or weight words and no comment on body measurements (code adds them); correct Hebrew gender forms for the player from `player.gender`; player text up to about 110 words, parent text up to about 140, short paragraphs, no lists, no emojis, no em dashes; when the week was thin (attendance only), say so warmly and briefly, never pad; mention a Trainer by first name only when the sheet names them; `drill_ids` only from `drills`, empty when there are none. Then the three to five sample reports written with Eden (a placeholder block until they arrive, marked so the preview script refuses to run while it is still a placeholder; see "Before launch").
- `output.ts` (pure):
  - `WRITER_JSON_SCHEMA`: `{ type: "object", additionalProperties: false, required: ["player_text", "parent_text", "drill_ids"], properties: { player_text: { type: "string" }, parent_text: { type: "string" }, drill_ids: { type: "array", items: { type: "string" } } } }`. Counts and lengths are the guardrails' job, not the schema's.
  - `writerOutputSchema` (Zod, the same shape) and `parseWriterOutput(text: string): WriterOutput | null`: `JSON.parse` in a try, then `safeParse`; null on any failure.
- `fill-name.ts` (pure): `fillName(text: string, firstName: string): string` replaces every `{שם}`; `firstNameOf(fullName: string | null): string` (first word, else "השחקן").
- `request.ts`: `WRITER_MODELS = ["claude-opus-5-5", "claude-sonnet-5-5"] as const`; `writerModel(): WriterModel` reads `WEEKLY_REPORT_MODEL` and falls back to `claude-opus-5-5` for any other value; `writerParams(sheet: FactSheet, model: WriterModel)`:

```ts
{
  model,
  max_tokens: 16000,
  thinking: { type: "adaptive" },
  system: [{ type: "text", text: STYLE_GUIDE, cache_control: { type: "ephemeral" } }],
  messages: [{ role: "user", content: `דף העובדות של השבוע:\n${JSON.stringify(sheet, null, 2)}` }],
  output_config: { effort: "medium", format: { type: "json_schema", schema: WRITER_JSON_SCHEMA } },
}
```

  Effort is set explicitly; thinking is adaptive (never `disabled` or a token budget: both are refused on these models). The style guide is identical across requests, so it is the cached prefix.
- `client.ts`: `anthropicClient(): Anthropic | null`, null when `ANTHROPIC_API_KEY` is unset.
- `batch.ts`:
  - `submitBatch(client, items: { id: string; sheet: FactSheet }[], model): Promise<string>`: `client.messages.batches.create({ requests: items.map(({ id, sheet }) => ({ custom_id: id, params: writerParams(sheet, model) })) })`, returns the batch id. (A batch request cannot set `fallbacks`.)
  - `collectBatch(client, batchId): Promise<{ ended: boolean; results: Map<string, WriteOutcome> }>`: `client.messages.batches.retrieve(batchId)`; when `processing_status !== "ended"`, `{ ended: false }`. Else iterate `for await (const result of await client.messages.batches.results(batchId))`: `succeeded` with a text block that `parseWriterOutput` accepts and `stop_reason` not `refusal` or `max_tokens` gives `{ ok: true, output, usage }`; anything else gives `{ ok: false, reason }` (`errored`, `canceled`, `expired`, `refusal`, `unparsable`).
  - `cancelBatch(client, batchId)`.
- `direct.ts`: `writeDirect(client, sheet, model): Promise<WriteOutcome>`: `client.beta.messages.create({ ...writerParams(sheet, model), betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" })`. Check `stop_reason === "refusal"` (the whole chain declined) and `"max_tokens"` before reading content; parse the first text block. Catch `Anthropic.APIError` (log status and type, never the request body) and return `{ ok: false, reason }`.
- `type WriteOutcome = { ok: true; output: WriterOutput; usage: unknown; model: string } | { ok: false; reason: string }`.

- [ ] **Step 1: Write the failing tests:** `parseWriterOutput` accepts a valid JSON string, refuses invalid JSON, a missing field and an extra field; `fillName` replaces two placeholders and leaves other braces alone; `firstNameOf(null)` is "השחקן".
- [ ] **Step 2: Run** (FAIL), **Step 3:** implement the pure files, **Step 4: Run** (PASS).
- [ ] **Step 5:** Install the SDK, add the env names, write the server files. Check the SDK's own types for `output_config`, `fallbacks` and the batch result union against the installed version (`node_modules/@anthropic-ai/sdk`); if a field is missing from the types, update the SDK rather than casting.
- [ ] **Step 6: Run** `npx tsc --noEmit`, `npm run lint`, `npm run build` (with the placeholder env the CI uses).
- [ ] **Step 7: Commit** `feat(weekly-report): the report writer`.

---

### Task 9: The preview script

**Files:**
- Create: `scripts/weekly-reports-preview.ts`

A read-only tool for the pilot: it builds the Fact sheets of a past week from production, asks the model for texts with direct requests, runs the guardrails, and writes an HTML file for people to read. It never writes to the database and never sends a message. It is how the style guide is tuned with Eden and how the blind comparison of the two models runs.

**Interface:** `npx tsx scripts/weekly-reports-preview.ts --week=2026-11-13 --branch=<branch id> [--birth-years=2013,2014] [--limit=10] [--models=claude-opus-5-5,claude-sonnet-5-5] [--blind] [--out=<file>]`.

- Uses the loaders of Task 7 and the classifier of Task 3 with the branch passed in (not the stored settings).
- For each Trainee with `"report"`: the Fact sheet, then one direct request per model, then `reportProblems`.
- Writes an RTL HTML page: per Trainee, the Fact sheet (collapsed), each model's two texts with the first name filled, and the holds. With `--blind` the models are shown as "א" and "ב" in a shuffled order, and the key goes to a separate file next to the output.
- Prints the token usage and the cost estimate per report from the returned `usage`.
- Refuses to run while the style guide still has the placeholder samples, and without `ANTHROPIC_API_KEY`.

- [ ] **Step 1:** Write the script.
- [ ] **Step 2:** With the user's agreement (it spends API credit and reads production): run it for one past week, 5 Trainees, and look at the output together. Note the measured cost per report.
- [ ] **Step 3: Commit** `feat(weekly-report): preview script for the style guide and the model comparison`.

---

### Task 10: The write job and its cron route

**Files:**
- Create: `src/features/weekly-reports/lib/jobs/write-week.ts` (`import "server-only"`), `src/app/api/cron/weekly-reports-write/route.ts`
- Modify: `vercel.json`

**Interfaces:**
- `startWeek(db, today: string): Promise<StartResult>`:
  1. No `anthropicClient()`: log and return `{ skipped: "no ANTHROPIC_API_KEY" }` before anything else.
  2. `weekStart = lastCompletedWeekStart(today)`. A run row for it already exists: return `{ skipped: "already started" }`.
  3. `closeEarlierWeeks(db, weekStart)`.
  4. Settings; no branch on: return `{ skipped: "no branch on" }`.
  5. Candidates: `loadAudienceCandidates(db, onBranchIds)`, kept when `reportBranches()` is not empty.
  6. Training over five weeks (`addDays(weekStart, -28)` to the week's end): `loadTrainingRows`, `loadArboxDays`; freezes for the week.
  7. `classifyWeek` per Trainee. `missed_you` rows are inserted `approved`, `approved_automatically = true` (no model writes them; a person can still hold them before they go). `absent` rows are inserted `listed`. `report` rows: `loadWeekInputs`, `buildFactSheet`, inserted with `fact_sheet = { sheet, body }`, `hold_reasons = holds`, status `held` when any hold, else `pending`.
  8. Rows to write (`loadRowsToWrite`): `submitBatch`, then insert the run row (`week_start`, `batch_id`, `model`, `prompt_version`). With nothing to write, the run row is inserted with `batch_id` null and `finished_at` now.
  9. Return counts per kind.
- `finishWeek(db, today: string, deadline: number): Promise<FinishResult>`:
  1. No client: skip. `weekStart = lastCompletedWeekStart(today)`. No run row: call `startWeek` first, then go on without waiting for the batch (it was just submitted, so the direct writes below take over).
  2. A batch not yet collected: `collectBatch`. Ended: save each good result through `saveWriterResult` (a guardrail pass first: `reportProblems(sheet, output)`) and leave the failed ones to the direct pass below; mark `batch_collected_at`. Not ended: `cancelBatch` and go on (the next finish run collects whatever finished; the conditional save ignores rows already written directly).
  3. Direct pass: `loadRowsToWrite`; write with up to 4 requests at a time, starting a new one only while `Date.now() < deadline`; save each result or failure.
  4. Nothing left to write: set `finished_at`.
  5. Revalidate the badge tag. Return counts.
- Route `GET /api/cron/weekly-reports-write`: `maxDuration = 300`; the `CRON_SECRET` checks of `plan-reminders`; phase = `?phase=start|finish` when given (manual runs), else `writePhase(getIsraelTime())`; null gives `{ success: true, skipped: "not a write hour" }`. `finish` gets `deadline = start + 240_000`.
- `vercel.json` crons (UTC): `{ "path": "/api/cron/weekly-reports-write", "schedule": "0 22,23 * * 4" }` (Thursday night UTC, one of which is 01:00 Friday in Israel) and `{ "path": "/api/cron/weekly-reports-write", "schedule": "*/30 4-9 * * 5" }` (Friday, every half hour; the phase check keeps 07:30 to 11:59 Israel).

- [ ] **Step 1:** Write the job and the route; add the cron entries.
- [ ] **Step 2: Run** `npx tsc --noEmit`, `npm run lint`, `npm run build`.
- [ ] **Step 3:** Manual check on a preview deployment or locally against production, with the user's agreement and with only the pilot branch set to `approval` for one test birth year: `curl -H "Authorization: Bearer $CRON_SECRET" ".../api/cron/weekly-reports-write?phase=start"` creates the rows and the batch; a second call says `already started`; `?phase=finish` an hour later collects and writes; rows a guardrail catches are `held` with their reasons.
- [ ] **Step 4: Commit** `feat(weekly-report): write job and cron`.

---

### Task 11: WhatsApp senders and the report link

**Files:**
- Modify: `src/lib/whatsapp/plan-templates.ts` (two senders), `src/lib/env.ts` (`WHATSAPP_WEEKLY_REPORT_TEMPLATE_NAME`, `WHATSAPP_MISSED_YOU_TEMPLATE_NAME`)
- Create: `src/features/weekly-reports/lib/report-token.ts`, `src/features/weekly-reports/lib/report-link.ts` (`import "server-only"`)
- Test: `src/features/weekly-reports/lib/__tests__/report-token.test.ts`

**Interfaces:**
- `sendWeeklyReport(phone: string, params: { childName: string; reportUrl: string }): Promise<WhatsAppResult>`: template `WHATSAPP_WEEKLY_REPORT_TEMPLATE_NAME`, body `{{1}}` child's first name, `{{2}}` link. Unset name returns `{ success: false, error: "... not configured" }`, as the other senders do.
- `sendMissedYou(phone: string, params: { childName: string }): Promise<WhatsAppResult>`: template `WHATSAPP_MISSED_YOU_TEMPLATE_NAME`, `{{1}}` child's first name.
- `report-token.ts` (pure): `REPORT_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60`; `signReportToken(reportId: string, expiresAtUnix: number, secret: string): string` gives `report.<id>.<exp>.<mac>` with `mac = HMAC-SHA256(secret, "weekly-report.<id>.<exp>")` in hex; `verifyReportToken(token: string, nowUnix: number, secret: string): string | null`: exactly four parts, the first `report`, a uuid id, an integer expiry after now, the MAC compared with the same `safeEqualUtf8` that `renewal-token.ts` uses; returns the report id.
- `report-link.ts`: `buildReportUrl(reportId: string, nowUnix = Math.floor(Date.now() / 1000)): string` gives `${SITE_URL}/report/${encodeURIComponent(token)}`, with `planTokenSecret()` and the `SITE_URL` rule of `renewal-link.ts`.

- [ ] **Step 1: Write the failing tests:** a fresh token verifies to its id; one second after expiry it does not; a changed id, expiry or MAC does not; a token signed with another secret does not; a renewal token (`signRenewalToken`) and a trainee token (`signTraineeToken`) do not verify as report tokens; a report token does not verify through `verifyRenewalToken`.
- [ ] **Step 2: Run** (FAIL), **Step 3:** implement, **Step 4: Run** (PASS).
- [ ] **Step 5:** Add the senders and the env names. **Run** `npx tsc --noEmit`, `npm run lint`.
- [ ] **Step 6: Commit** `feat(weekly-report): report link and WhatsApp senders`.

---

### Task 12: The send job and its cron route

**Files:**
- Create: `src/features/weekly-reports/lib/delivery.ts`, `src/features/weekly-reports/lib/jobs/send-week.ts` (`import "server-only"`), `src/app/api/cron/weekly-reports-send/route.ts`
- Modify: `vercel.json`
- Test: `src/features/weekly-reports/lib/__tests__/delivery.test.ts`

**Interfaces:**
- `delivery.ts` (pure):
  - `type SkipReason = "no_template" | "no_phone" | "adult" | "whatsapp_failed"`; `SKIP_REASON_LABELS: Record<SkipReason, string>` ("אין תבנית וואטסאפ מאושרת", "אין טלפון של הורה", "מעל גיל 18", "השליחה בוואטסאפ נכשלה").
  - `parentDelivery(input: { guardianPhone: string | null; guardianNotNeeded: boolean; birthdate: string | null; today: string; templateConfigured: boolean }): { send: true; phone: string } | { send: false; reason: SkipReason }`: adult by `ageOn(birthdate, today) >= ADULT_AGE` (from `src/features/parent-phone/lib/prompt.ts`) or `guardianNotNeeded` gives `adult`; a blank or unparsable phone (`normalizePhoneIL`) gives `no_phone`; an unset template gives `no_template`; otherwise send to the normalized phone.
- `sendWeek(db, today: string): Promise<SendResult>`:
  1. `weekStart = lastCompletedWeekStart(today)`; rows of that week with status `approved` (`report` and `missed_you`).
  2. For each row, claim it: `update({ status: "sent", sent_at: now }).eq("id", id).eq("status", "approved").select("id")`. No row back: someone else sent it; skip.
  3. Parent: `parentDelivery(...)`; when it says send, `sendWeeklyReport` with `buildReportUrl(id)` or `sendMissedYou`; store `parent_message_id`, or `parent_skip_reason` (`whatsapp_failed: <error>` on failure). The player already sees it: the claim made it `sent`.
  4. One row at a time; log each failure; never throw for one row.
  5. Revalidate the badge tag; return counts (sent, parent messages, skipped by reason).
- Route `GET /api/cron/weekly-reports-send`: `maxDuration = 300`; the `CRON_SECRET` checks; `isSendWindow(getIsraelTime())` unless `?force=1`; `sendWeek(createAdminClient(), israelToday())`.
- `vercel.json` (UTC): `{ "path": "/api/cron/weekly-reports-send", "schedule": "0 9,10 * * 5" }` (Friday 12:00 Israel in either season) and `{ "path": "/api/cron/weekly-reports-send", "schedule": "0 6,7 * * 0-4" }` (09:00 Sunday to Thursday).

- [ ] **Step 1: Write the failing tests** for `parentDelivery`: an 18 year old (birthday today) gives `adult`; a 17 year old with a phone and a template sends to the normalized number; unknown birthdate with a phone sends; `guardianNotNeeded` gives `adult`; a blank phone gives `no_phone`; no template gives `no_template`.
- [ ] **Step 2: Run** (FAIL), **Step 3:** implement `delivery.ts`, **Step 4: Run** (PASS).
- [ ] **Step 5:** Write the job, the route and the cron entries. **Run** `npx tsc --noEmit`, `npm run lint`, `npm run build`.
- [ ] **Step 6:** Manual check with the user's agreement, on one approved test report whose parent phone is a staff phone: `?force=1` sends once; a second `?force=1` sends nothing; the row shows the message id.
- [ ] **Step 7: Commit** `feat(weekly-report): send job and cron`.

---

### Task 13: Queue loaders and actions

**Files:**
- Create: `src/features/weekly-reports/lib/queries/queue.ts` (`import "server-only"`), `src/features/weekly-reports/lib/cache-tags.ts`, `src/features/weekly-reports/lib/actions/approve.ts`, `actions/hold.ts`, `actions/edit.ts`, `actions/rewrite.ts`, `actions/gender.ts`, `actions/settings.ts`, `src/lib/validations/weekly-reports.ts`
- Modify: `src/lib/rate-limit.ts` (a `weekly_rewrite` limiter)
- Test: `src/lib/validations/__tests__/weekly-reports.test.ts`

**Interfaces:**
- `cache-tags.ts`: `WEEKLY_REPORTS_TAG = "weekly-reports"`; `revalidateWeeklyReports()` calls `revalidateTag(WEEKLY_REPORTS_TAG, "max")` and `revalidatePath("/admin/weekly-reports")`.
- `queue.ts`:
  - `type QueueTab = "held" | "pending" | "approved" | "sent" | "missed_you" | "absent"`.
  - `loadQueue(db, { weekStart, scopeBranchIds: string[] | null, filterBranchId?: string }): Promise<QueueData>`: the week's rows (kind and status give the tab: `missed_you` and `absent` rows have their own tabs whatever their status; `sent` holds `sent` and `not_sent`), filtered by `branch_ids` overlapping the scope (`.overlaps("branch_ids", ids)`; admins unfiltered) and by the picked branch. Each row: id, trainee id and full name, branch names, kind, status, hold reasons, written and sent times, the parent skip label, opened flags, edit ratio, and `newData`: a Shift report naming the Trainee (`updated_at`), a Quick tag (`created_at`) or note (`updated_at`) of the week after `written_at`. Plus the counts per tab.
  - `loadReportDetail(db, id): Promise<ReportDetail | null>`: the row with the Fact sheet, texts, original output, drills (`book_drills` name and `why_he` by `drill_ids`), the Trainee's gender and first name.
  - `queueWeeks(db): Promise<string[]>`: the `week_start`s that have rows, newest first, for the week picker.
- `validations/weekly-reports.ts`: `reportIdSchema`, `holdSchema` (`reason` trimmed, 2 to 200 characters), `textsSchema` (`playerText` and `parentText` trimmed, 1 to 2,000 characters each), `genderSchema` (reuses `genderField`), `settingsSchema` (`branchId` uuid, `mode` `off` or `approval` only, with "מצב אוטומטי ייפתח בשלב מאוחר יותר" for `automatic`; `birthYears` an array of 1 to 30 distinct integers from 1950 to 2030, or null; `missedYou` boolean).
- Every staff action: `verifyAdminOrTrainer()`, the schema, the row read, `assertTraineeInScope(row.trainee_id)`, then a conditional update on the status it expects (a stale screen gets "הדוח השתנה, רעננו את הדף"), then `revalidateWeeklyReports()`. Results `{ success: true } | { error: string }`.
  - `approveReportAction({ reportId })`: `approveRefusal`; sets `approved`, `approved_by`, `approved_at`.
  - `approveAllAction({ weekStart, filterBranchId? })`: the caller's `pending` rows of the week in scope with no refusal, in one update by ids; returns the count.
  - `holdReportAction({ reportId, reason })`: from `pending`, `approved` or `held`; appends `{ code: "manual", text: reason }`, sets `held_by`, `held_at`, status `held`.
  - `saveReportTextsAction({ reportId, playerText, parentText })`: from `pending` or `held`; recomputes text problems with `reportProblems(sheet, { ...output, player_text, parent_text })`, merges them with `replaceTextProblems`, sets `edited_by`, `edited_at`, `edit_ratio = combinedEditRatio(original_output, ...)`; status `held` while any reason remains, else `pending`. The original output is never changed.
  - `rewriteReportAction({ reportId })`: rate limit ``checkRateLimit(`weekly-rewrite:${user.id}`, "weekly_rewrite")``; from `pending` or `held`, `kind = report`; writes from the stored Fact sheet with `writeDirect`, then saves the texts, `original_output`, `written_at` and the recomputed holds, clearing `edited_*` and `edit_ratio`. The Fact sheet is rebuilt only when gender changed (below).
  - `setReportGenderAction({ reportId, gender })`: writes `profiles.gender` only where it is null (`.is("gender", null)`), logs to `activity_logs` (`field: "gender"`), rebuilds this row's Fact sheet (`loadWeekInputs` for the one Trainee, `buildFactSheet`), clears the `missing_gender` hold, and writes the text with `writeDirect` as in rewrite.
  - `saveReportSettingsAction(input)`: `verifyAdmin()`; upserts the branch's row with `changed_by` and `changed_at`.
- `rate-limit.ts`: `weekly_rewrite`, 20 per hour per user (`slidingWindow(20, "1 h")`, prefix `goe:weekly-rewrite`). It fails open, as `general` does: a rewrite costs a little API credit, not money or a message.

- [ ] **Step 1: Write the failing tests** for the schemas: `automatic` refused with its message; birth years with a duplicate or 1949 refused; a 2,001 character text refused; a one-character hold reason refused.
- [ ] **Step 2: Run** (FAIL), **Step 3:** implement the schemas, **Step 4: Run** (PASS).
- [ ] **Step 5:** Write the loaders, the tag file, the limiter and the actions. Server actions that call the model run in the queue page's function: give `src/app/admin/weekly-reports/page.tsx` `export const maxDuration = 120` (Task 14).
- [ ] **Step 6: Run** `npx tsc --noEmit`, `npm run lint`.
- [ ] **Step 7: Commit** `feat(weekly-report): queue loaders and actions`.

---

### Task 14: The approval queue page

**Files:**
- Create: `src/app/admin/weekly-reports/page.tsx` (server), `src/features/weekly-reports/components/admin/QueueTabs.tsx`, `QueueTable.tsx`, `ReportSheet.tsx`, `FactSheetView.tsx`, `ApproveAllButton.tsx`, `WeekPicker.tsx` (client where interactive)

`/admin/plans` is the model page: server page, `verifyAdminOrTrainer()`, `getBranchScopeAction()`, `allowedBranches()` and `BranchUrlFilter` for the branch, URL search params for the week (`?week=`), the branch (`?branch=`) and the tab (`?tab=`).

**What it shows:**
- Title "דוחות שבועיים", the week label, and under it one line of counts ("12 ממתינים · 3 מעוכבים · 40 נשלחו").
- Week picker from `queueWeeks()`, current week by default; branch filter; tabs in this order: מעוכבים, ממתינים לאישור, אושרו, נשלחו, התגעגענו, לא הגיעו 3 שבועות, each with its count.
- Rows: name, branches, a status chip ("ממתין לאישור", "מעוכב", "אושר", "נשלח", "לא נשלח"), the first hold reason when held, "נוספו נתונים" when `newData`, and for sent rows the parent outcome ("נשלח להורה", or the skip label) and "נפתח" when the parent opened it. The "לא הגיעו 3 שבועות" tab lists name, branches and the last training date, with a link to the trainee page; no sheet.
- "אשר את כל הממתינים" on the ממתינים tab, with the count, and a confirm dialog.
- A row opens `ReportSheet` (a Radix Sheet, full width on phones): on one side `FactSheetView`, the Fact sheet as labelled sections (נוכחות, מה עשינו, התקדמות, הרגלים, מבדק, יעדים, משחק קרוב) and the body block marked "מוצג להורה ולשחקן כפי שהוא, לא נשלח למודל"; on the other, the two texts in textareas with word counts against the targets, the hint "{שם} יוחלף בשם הפרטי", the hold reasons, and the actions: אשר, שמור שינויים, עכב (asks for a reason), כתוב מחדש, and when gender is missing, "בן" / "בת" (`setReportGenderAction`). Every action shows a toast and refreshes. A `missed_you` row's sheet shows the template text and only עכב.
- `key={report.id}` on the sheet's form, so switching rows never shows the previous row's text.
- `export const maxDuration = 120`; `export const metadata = { title: "דוחות שבועיים | Garden of Eden" }`.

- [ ] **Step 1:** Write the page and components.
- [ ] **Step 2: Run** `npx tsc --noEmit`, `npm run lint`, `npm run build`.
- [ ] **Step 3:** Manual check at 320 px and 1440 px: a Trainer of one branch sees only that branch's rows and cannot open another branch's report by id (the action refuses); an invented number in a text blocks אשר with the reason; fixing the text clears the hold; עכב then אשר works; "אשר את כל הממתינים" leaves held rows alone.
- [ ] **Step 4: Commit** `feat(weekly-report): approval queue`.

---

### Task 15: Menu item and badge

**Files:**
- Create: `src/features/weekly-reports/lib/badge.ts` (`import "server-only"`)
- Modify: `src/lib/navigation/admin-nav.ts`, `src/app/admin/layout.tsx`

**Interfaces:**
- `weeklyReportsBadgeCount(): Promise<number>`: `verifyAdminOrTrainer()`; the caller's scope; then a cached count of `pending` rows of the current week in that scope. The cache (`unstable_cache`, 10 minutes, tag `WEEKLY_REPORTS_TAG`) takes the week start and the sorted scope branch ids as arguments, so they are part of its key: two Trainers of different branches never share a number. 0 on any failure, so the menu never breaks.
- `admin-nav.ts`: `{ href: "/admin/weekly-reports", label: "דוחות שבועיים", icon: FileText }` right after "סקרים" (every staff member sees it). Choose an icon not used by a neighbour (for example `Newspaper` from lucide-react).
- `layout.tsx`: add `weeklyReportsBadgeCount()` to the `Promise.all` and `"/admin/weekly-reports"` to `navBadges`.

- [ ] **Step 1:** Write the badge, the menu item and the layout change.
- [ ] **Step 2: Run** `npx tsc --noEmit`, `npm run lint`.
- [ ] **Step 3:** Manual check: the badge counts pending rows; approving one lowers it at once (the tag); a Trainer of the other branch sees 0.
- [ ] **Step 4: Commit** `feat(weekly-report): menu item and pending badge`.

---

### Task 16: Settings card

**Files:**
- Create: `src/features/weekly-reports/components/admin/ReportSettingsCard.tsx` (client), `src/features/weekly-reports/lib/actions/settings-load.ts`
- Modify: `src/app/admin/weekly-reports/page.tsx`

**What it does:** Shown to Admins only, collapsed under the queue ("הגדרות"). One row per active branch: mode off / approval ("כבוי", "באישור צוות"), birth years as chips with an input (empty means every year), and "שליחת התגעגענו" on or off, with a line under it: "בחיפה רק אחרי שהפיילוט מראה שהנוכחות מארבוקס תואמת". Save per row through `saveReportSettingsAction`. Shows who changed it last and when.

- [ ] **Step 1:** Write the loader (`verifyAdmin()`; active branches with their setting or the default) and the card.
- [ ] **Step 2: Run** `npx tsc --noEmit`, `npm run lint`. Manual check: a Trainer does not see the card and the action refuses them.
- [ ] **Step 3: Commit** `feat(weekly-report): branch settings for admins`.

---

### Task 17: The parent page

**Files:**
- Create: `src/app/report/[token]/page.tsx`, `src/features/weekly-reports/lib/queries/parent-view.ts` (`import "server-only"`), `src/features/weekly-reports/components/report/ReportBody.tsx`, `GoalProgressList.tsx`, `BodyBlock.tsx`, `DrillList.tsx`
- Modify: `src/app/robots.ts` (add `/report/` to `disallow`)

No middleware change: only `/dashboard` and `/admin` are gated (`src/lib/supabase/middleware.ts`).

**Interfaces:**
- `loadParentView(db, reportId: string, today: string): Promise<ParentView | null>`: the row only when `kind = report` and `status = sent`; the first name; the parent text with the name filled; goals and body from the stored Fact sheet; drills by `drill_ids`; the plan from `loadPlanQueues(db, [traineeId], today)`: sessions left and end date, and the renewal link through `buildRenewalUrl(view.plan.id)` only when the plan is not paid in Arbox and `onlinePaymentsOpen()`. Records `parent_first_opened_at` with an update on `parent_first_opened_at is null`.
- Page: `export const dynamic = "force-dynamic"`; `metadata` with `robots: { index: false, follow: false }`; `verifyReportToken(token, now, planTokenSecret())`; no id or no view gives one calm Hebrew card: "הקישור לא תקין או שפג תוקפו. לשאלות אפשר לפנות אלינו בוואטסאפ." The page: the academy logo, "הדוח השבועי של <שם>", the week label, the parent text, the Goals with a progress bar each, the body block when there is one (the numbers, the change, the percentiles, and "המלצת התזונאית:" with the text as written), the drills with their "למה" line when there are any, and a plan box ("נשארו 4 אימונים בכרטיסייה", "המסלול בתוקף עד 12.12") with the renewal button when allowed. Phone first, 320 to 1440 px, `dir="rtl"` from the root layout.

- [ ] **Step 1:** Write the loader, the components and the page; add the robots entry.
- [ ] **Step 2: Run** `npx tsc --noEmit`, `npm run lint`, `npm run build`.
- [ ] **Step 3:** Manual check: a signed link opens without a login and stamps the open once; an altered token shows the notice; a report that was never sent shows the notice; the page source has `noindex`.
- [ ] **Step 4: Commit** `feat(weekly-report): parent report page`.

---

### Task 18: The player's dashboard card

**Files:**
- Create: `src/features/weekly-reports/lib/queries/player.ts` (`import "server-only"`), `src/features/weekly-reports/lib/actions/player.ts`, `src/features/weekly-reports/components/trainee/WeeklyReportSection.tsx` (server), `WeeklyReportCard.tsx` (client), `MissedYouCard.tsx`
- Modify: `src/app/dashboard/page.tsx`

**Interfaces:**
- `loadPlayerReport(userId: string, today: string): Promise<PlayerReport | null>`: the Trainee's row of the current week (`lastCompletedWeekStart(today)`) with status `sent`; the player text with the first name filled, the goals and the body from the stored sheet. A read error is logged and gives null.
- `markReportReadAction({ reportId })`: signed-in user; the row must be theirs; sets `player_first_opened_at` where null.
- `WeeklyReportSection({ userId, canBook })`: renders `WeeklyReportCard` for a report, `MissedYouCard` for a missed-you, nothing otherwise.
- `WeeklyReportCard`: title "הדוח השבועי שלך", the week label, the text (first 4 lines with "קרא עוד" on phones), the goals' progress bars, the body block when there is one; calls `markReportReadAction` once on mount (guarded by a ref).
- `MissedYouCard`: "התגעגענו אליך, <שם>!" and one line "מחכים לראות אותך באימון הבא", with "לקביעת אימון" linking to the booking page when `canBook`.
- `src/app/dashboard/page.tsx`: right after `<ParentPhoneSection />`, `<Suspense fallback={null}><WeeklyReportSection userId={user.id} canBook={canBook} /></Suspense>`.

- [ ] **Step 1:** Write the loader, the action and the components; mount the section.
- [ ] **Step 2: Run** `npx tsc --noEmit`, `npm run lint`, `npm run build`.
- [ ] **Step 3:** Manual check: a sent report shows the next time the Trainee opens the dashboard and stamps the open once; an approved, unsent one does not show; another Trainee's report id is refused by the action.
- [ ] **Step 4: Commit** `feat(weekly-report): weekly report card on the dashboard`.

---

### Task 19: Docs, verification and the pull request

**Files:**
- Modify: `CONTEXT.md` (the Weekly report words: Weekly report, Report week, Fact sheet, Hold, with their "Avoid" lines from the spec), `CLAUDE.md` (a "### Weekly report" section after "### Weekly report inputs": the tables, the two cron routes and their windows, the writer and its model setting, the guardrails, the queue, the parent link, the env names, the preview script, and that automatic mode and drills come later), `.env.local.example`

- [ ] **Step 1:** Write the docs.
- [ ] **Step 2: Run** `npm run test:run`, `npx tsc --noEmit`, `npm run lint`, and `npm run build` with the CI placeholder env. All clean.
- [ ] **Step 3:** Ask for a code review (`code-reviewer`) and a security review (`security-reviewer`: service role use, scope in every action, the public report page, the token, what reaches the model). Fix what they find.
- [ ] **Step 4:** Push the branch and open the PR, with a test plan that lists the manual checks of Tasks 10, 12, 14, 15, 17 and 18 and the "Before launch" list below.
- [ ] **Step 5: Commit** `docs(weekly-report): weekly report notes for agents and the glossary`.

## Before the pilot (not code, from the spec)

- Meta approves the two templates (`WHATSAPP_WEEKLY_REPORT_TEMPLATE_NAME` with `{{1}}` child's first name and `{{2}}` the link; `WHATSAPP_MISSED_YOU_TEMPLATE_NAME` with `{{1}}` child's first name) on WABA 1992291924883900, and their names go into Vercel production.
- `ANTHROPIC_API_KEY` in Vercel production; the organization's data retention settings checked; a data processing agreement signed.
- The consent line in the enrollment agreement, checked by a lawyer.
- Three to five sample reports written with Eden replace the placeholder in the style guide; the preview script runs on two past weeks; staff compare the two models blind and the winner goes into `WEEKLY_REPORT_MODEL` (or the default stays).
- The pilot group's birth years go into קריית אתא's setting, mode "באישור צוות". "שליחת התגעגענו" on for קריית אתא only.
