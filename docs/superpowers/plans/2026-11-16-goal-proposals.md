# Goal Proposals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The night after an Assessment, each Trainee of a branch that takes part in the Weekly report gets up to 3 Goal proposals (הצעות יעד): code finds the metrics where the Trainee is behind the age group and sets a realistic target from the academy's own history, the model picks among those candidates with one Hebrew line on why and two or three Development book drills, and staff accept, change or reject each one in the Goals card or in a "הצעות יעד" tab of the queue. Accepting writes `player_goals` under the existing goal rules. Alongside, the Weekly report's Fact sheet starts carrying up to 6 drills for the Trainee's open Goals, so the drills the step 2 code already handles (`drill_ids`, its guardrail, the parent page) finally appear.

**Architecture:** One map table from Assessment metrics to Development book parameters, seeded from a first draft and edited by Admins on a page of the book admin. Pure rules, each tested first, pick a Trainee's drills (map, book age group, position, done in the last 30 days), find the gaps against the age group, set the target from the history of Assessment pairs 6 to 12 weeks apart, check the model's picks and decide which Assessments are due. A nightly cron reads the due Assessments, builds the candidates in code, sends one direct request per Assessment, checks the answer and saves the proposals. Staff decide through two server actions; accepting runs one Postgres function that writes the Goal and closes the proposal together. The proposal code lives in `src/features/goal-proposals/`; the drill rules and the map belong to `src/features/development-book/`; the Weekly report only reads them.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Supabase Postgres, Tailwind CSS 4, shadcn/Radix, Zod 4, Vitest, `@anthropic-ai/sdk` 1.8.0 (already installed), Vercel cron.

**Spec:** `docs/superpowers/specs/2026-11-11-weekly-report-design.md`: "Goal proposals (phase 3)", the Fact sheet's "Goals" bullet ("up to 6 candidate drills from the Development book (by the metric-to-parameter map, the Trainee's age group and position, leaving out drills marked done in the last 30 days)"), "Data" (`goal_proposals`, `book_parameter_metrics`) and "Language" (Goal proposal, הצעת יעד). This plan is step 3 of its "Order of work". Steps 1 and 2 are merged into the branch `feat/goal-proposals`; read the "Weekly report" section of `CLAUDE.md` and `src/features/weekly-reports/` before starting.

**Left for later steps, on purpose:**

- **Automatic mode** (step 4): proposals accepted by themselves through the same per-branch switch, with sampling and "דווח על טעות". Here a branch in `automatic` behaves as `approval`, as the reports do. The `accepted` / `changed` split and the stored `problems` are recorded now so step 4 can measure how often staff change a target and how often a reason was dropped. Automatic acceptance must leave a proposal with a `sensitive` problem to a person (Decision 24), and must look again at acceptance for a caution Quick tag or sensitive Shift report entry filed after the proposal was made, as `holdLateSensitive()` does for reports; step 3 does neither because every proposal waits for a person.
- **Showing the reason line or the proposal's drills to families.** In this step the reason is read only by staff; an accepted Goal shows on the dashboard as every Goal does.
- **The book admin's "U15+" age rows.** 18 production parameters store age rows as "U15+", which `ageRowInputSchema` refuses, so saving one of them in `ParameterForm` fails at its third action. This plan only reads "U15+" correctly (Task 3); fixing the form is a separate change.
- **A branch-scope check on `/admin/assessments/[userId]`.** The page has none today (only the admin layout's role check). This plan loads proposals there only for a Trainee in the caller's scope and leaves the rest of the page as it is.

**Decisions made in this plan (judgment calls, from the code facts):**

1. **The gap's benchmark is computed in code, not read from `age_group_benchmarks`.** That table holds only the best and worst of all-time personal bests, so "half the gap to the benchmark" would aim at the academy record. The benchmark of a metric is the upper quartile of the age group's current values: each Trainee's latest live Assessment of the last 12 months, grouped by `resolveAgeGroup(profile, today)` (the groups rankings use), the 75th percentile for higher-is-better metrics and the 25th for the timed ones. It needs at least 8 values (`MIN_GROUP_VALUES`); fewer gives no benchmark and no candidate for that metric.
2. **Mixed units are filtered, not trusted.** History keeps jumps of 10 to 80, jump heights over 100 and kick values of 3, 5 and 7 on purpose. A group value outside half to twice the group median is left out of the benchmark; a Trainee's own value outside that band gives no candidate; an improvement pair whose two values differ by more than a factor of 2 is dropped; and history is read for the last 24 months only.
3. **"Preferring the metrics mapped to the Trainee's position" is a strict order of three tiers**, then the Trainee's standing in the group (lowest first): a metric mapped to a parameter that names the Trainee's position (`is_all_positions` false and the position listed); a metric mapped to a parameter visible to every position; a metric with no visible parameter (no drills to offer). Only parameters that fit the Trainee's book age group (Decision 16) count for a tier, so a metric never ranks as "מתאים לעמדה" through a parameter whose drills the Trainee cannot get. In production only technique parameters name positions, so tier one holds at most three metrics and never crowds the big physical gaps out of the 6 offered.
4. **The target rule.** A history pair is one Assessment and the earliest later Assessment of the same Trainee 42 to 84 days after it, both with the metric, grouped by the age group at the first one's date (`resolveAgeGroup(profile, date)`, with the known caveat that only the current override is stored). The improvement is direction-adjusted. With 20 or more pairs in the Trainee's group, the step is half the gap to the benchmark held inside the band from the 60th to the 75th percentile of those improvements; with fewer, it is half the gap. A metric whose 75th percentile improvement is not positive gets no candidate (the academy's own history says it does not move in 6 to 12 weeks). The step and the target are rounded per metric (2 decimals for timed tests, 1 for flexibility, 0 for jumps, kick power and Blaze); a step that rounds to nothing, or a target that is not positive, gives no candidate.
5. **What is "a new Assessment".** The wizard inserts at its first step and updates per step, with no "finished" event, and `player_assessments` has no `updated_at`. An Assessment is due when it is the Trainee's newest live one, dated in the last 14 days, and was last changed (its rating snapshot's `computed_at`, else `created_at`) before today's Israel day began. A failed run is retried on later nights, at most 3 attempts. Staff may finish the wizard on a later day, so an Assessment whose check ended `no_candidates` or `none_picked` is due again when it changed after that check (still inside the 14 days), as a fresh check of up to 3 attempts. A `proposed` Assessment is never looked at again: a later edit leaves its proposals on the values they were made from, which the card shows ("מ-<baseline>"), and staff change or reject them. Proposing from a half-filled Assessment is the known limit of having no "finished" event; it is written in `CLAUDE.md` (Task 16).
6. **A second table, `goal_proposal_checks`**, remembers every Assessment the job looked at and how it ended (`proposed`, `no_candidates`, `none_picked`, `unfinished`), so an Assessment with no gap is not sent to the model every night and a failure is retried a bounded number of times. It also stores the model's usage per Assessment. A run that saved the proposals but failed before finishing the check (an error, or the 300 second limit) never pays the model again: an Assessment that already has proposals is finished as `proposed` without a request (`stepBeforeModel`, Task 13).
7. **The model sees up to 6 candidates and picks up to 3**, one Hebrew line each and up to 3 drills each from that candidate's up to 5. The model never sets a number: the stored baseline and target are the candidate's. The output schema is fixed (a `metric_key` enum of the 18 Goal metrics), because structured outputs compile each new schema and accept neither string lengths nor array counts; counts and lengths are the guardrails' job.
8. **A guardrail failure never blocks a proposal; it removes the model's words.** A pick of a metric that was not offered, a repeated metric or a fourth pick is dropped; drill ids not offered are removed; a reason with a number not in the candidate's facts, a forbidden phrase, more than 25 words, a line break or no text is stored as `null` with its problem in `problems`, and staff see why. The reason is staff-facing in this step, and the proposal's numbers come from code.
9. **The reason line is written about the metric, for staff.** The model gets the Trainee's age group and position and the candidates; no name, no gender, no Trainee or Assessment id. Only drill ids reach it.
10. **Old proposals expire.** An open proposal whose Assessment is no longer the Trainee's newest live one becomes `expired` on the next run, whatever the newer Assessment's outcome (no gap, no pick, or not checked yet), so a target set against old values never waits for a person; when a newer Assessment's proposals are saved, the older open ones are expired at once. An open proposal older than 30 days, one whose metric got an open Goal another way, and one whose Assessment was soft-deleted expire too. A proposal of a soft-deleted Assessment is left out of both lists and refused by `accept_goal_proposal` from the moment of the delete, not only after the nightly run. A metric whose proposal was rejected in the last 60 days is not proposed again.
11. **Accepting is one Postgres function, `accept_goal_proposal`**, which locks the proposal, checks it is still `proposed` at the version the screen showed (a version is required) and that its Assessment is not soft-deleted, inserts the Goal and closes the proposal in one transaction (the unique open-Goal index refuses a second Goal on the metric). The checks `setGoal()` makes in code move into a pure `goalRefusal()` that both use, so "the existing goal action's rules" are literally the same code. As in `setGoal()`, `current_value` stays null until the next Assessment.
12. **Statuses `accepted` and `changed`**: `changed` is an acceptance with a target staff typed, kept apart for step 4's bar.
13. **"The trainee page's Goals card" is the Goals card where it lives today**: `GoalManagementPanel` on `/admin/assessments/[userId]` (`/admin/users/[userId]` has no Goals card). The panel gets a slot at its top; the queue tab links each Trainee to that page.
14. **The "הצעות יעד" tab is not by week.** It lists every open proposal in the caller's scope (the branch filter applies), grouped by Trainee, with the actions inline: no sheet and no `?proposal=` parameter. The menu badge keeps counting pending reports only.
15. **Proposals only for Trainees the Weekly report takes**: the same `weekly_report_settings` (mode not off, birth years) through `reportBranches()`. The proposal stores those branch ids in `branch_ids`, and staff scope is the queue's rule: the row's branches and the Trainee's current branches both in the caller's scope.
16. **The Weekly report's drills come from the open Goals only**, oldest Goal first, one drill per Goal in turn until 6; the drills of the accepted proposal behind a Goal come first for that Goal. A Trainee with no open Goal gets no drills. The age fit is by the parameter's age rows: none means every age, "U15+" covers U15-16 and U17+, a parameter none of whose rows carries a known label (the four book groups or "U15+") fits every age (`book_age_rows.age_group` has no CHECK, so an unexpected label never hides a parameter from everyone), and a Trainee with no birthdate fits every parameter. "Done in the last 30 days" counts back from the Report week's Thursday, so a rebuilt sheet gets the same drills.
17. **Each drill in the Fact sheet carries `goal`**, the Hebrew label of the Goal it serves (the same text as `goals[].metric`), so the model can match drills to Goals. That changes the style guide's description of `drills`, so `PROMPT_VERSION` is bumped. Stored sheets of step 2 have `drills: []` and still read. A drill's name and "למה" line are the book's text, not facts about the Trainee, so `allowedNumbers()` leaves `drills` out (only their count stays allowed): a set count or a percentage in a drill never becomes a number the texts may use.
18. **One drill name rule everywhere**: `name_he`, else `name_en` (58 of 64 production drills have no Hebrew name), and the "למה" line without the book's leading "למה זה עובד:", which `DrillList` would otherwise print twice. The queue's fallback to "תרגיל" goes.
19. **The player's dashboard card shows the chosen drills too**, each linking to `/dashboard/book/drills/[id]`; the parent page keeps them unlinked (no login there).
20. **The map editor is its own Admin page, `/admin/book/metrics`**, one row per Goal metric, rather than a fifth card in `ParameterForm` (584 lines, one save bar running three actions). The map is server-only like the weekly report tables: the book admin already writes with the service role, so no policy is needed. Its CHECK lists the 18 `GOAL_METRICS` (not `kick_power_kaiser`).
21. **The seed is a second migration** that matches parameters by slug; it is a draft for staff to correct (Task 1).
22. **No new environment variables.** The job uses `ANTHROPIC_API_KEY` and the writer's model setting `WEEKLY_REPORT_MODEL`; without a key it logs and writes no proposal, as the report writer does (expiry still runs, Decision 23). Direct requests with server-side fallbacks, not a batch: a few Assessments a night.
23. **The cron runs daily at 04:15 UTC** (06:15 or 07:15 in Israel), after `recalculate-benchmarks` (03:00) and `backfill-rating-snapshots` (03:30), with no hour gate: what is due is decided by the data, and a manual call is safe. Expiry needs no model, so it runs before the key check: without `ANTHROPIC_API_KEY` old proposals still expire and only the writing is skipped.
24. **The spec's last guardrail, a sensitive entry, marks the proposal for staff.** A sensitive Shift report entry or a caution Quick tag naming the Trainee in the 14 days up to the run (`sensitiveHoldsNow()` of the weekly report, the same rules and texts) adds a `sensitive` problem to each of that Assessment's proposals. The model never sees it; the card shows it above the actions ("שימו לב: <text>"), so a Trainee tagged "כאב או פציעה" is not given a sprint target unnoticed. The proposal is still made: in step 3 a person decides every one.

## Global Constraints

- Work on the branch `feat/goal-proposals`. Commits use `feat(weekly-report): ...` (or `test(...)`, `refactor(...)`, `docs(...)` with the same scope), ending with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>` and any session line the harness asks for. Use `GRAPHIFY_SKIP_HOOK=1` for branch switches.
- All user-facing text in Hebrew; RTL; logical properties only (`ms-`/`me-`, `ps-`/`pe-`, `start`/`end`). No emojis anywhere, in code, copy or prompts. No em dashes or en dashes in copy, in the goal guide or in the style guide.
- Immutable updates only. TypeScript strict, no `any`, no new `typedFrom` call sites (the new tables are in the generated types after Task 1).
- Every id from a client goes through `isValidUUID()` (or a Zod schema with `UUID_REGEX`). Every date is an Israel calendar day (`israelToday()`, `israelDateStr()`).
- The three new tables are read and written only by server code with `createAdminClient()`. Proposal actions start with `verifyAdminOrTrainer()`, apply the scope rule (`isInBranchScope()` on `branch_ids`, then `assertTraineeInScope()`), and change a row only through a conditional update on the status and `updated_at` the screen showed. The map editor starts with `verifyAdmin()`. Never rely on RLS for scope.
- The model never decides a number. A proposal's baseline and target are the candidate's; a number in a reason line must be in that candidate's facts or the line is dropped.
- Nothing the model sees holds a name, a phone, a Trainee id or an Assessment id.
- Long id lists go through `readInChunks()`; reads that can pass 1000 rows go through `readAllPages()` with an order on a unique column. A failed read throws with the table's name (`must()`).
- Tests cover pure functions only. Vitest, files in a sibling `__tests__/` folder. Write each test first and watch it fail.
- Files at most 400 lines where possible (800 hard cap); functions under 50 lines.
- The migrations are applied to production before the code deploys (expand only), then the types are regenerated. Never edit `src/types/database.generated.ts` by hand. Confirm with the user before applying.
- No real model call or production write happens during implementation except where a step says so and the user agrees.
- Domain words: Goal proposal (הצעת יעד), Goal, Assessment, Development book, Trainee, Weekly report, Fact sheet, Report week.

## Review Focus

1. **A number the model made up becomes a target.** The stored baseline and target are copied from the code's candidate; the model's answer only chooses metric keys, words and drill ids. Pinned by `checkPicks` (Task 11) and by the job saving `candidate.target`, never a model field (Task 13).
2. **A Goal the existing rules would refuse.** Acceptance and `setGoal()` run the same `goalRefusal()` (Task 2); the database's unique open-Goal index refuses a second open Goal on the metric inside `accept_goal_proposal` (Task 1).
3. **A proposal accepted twice, or accepted and rejected at once.** The function locks the row and checks the status and `updated_at` (`IS DISTINCT FROM`, so a missing version never passes); rejection is a conditional update on both; both schemas require the version. Checked manually with two tabs in Task 15a.
4. **A Trainer acting on another branch's Trainee.** Every loader filters by `branch_ids` and current memberships, the Goals card's loader included; every action re-checks; the Goals card loads proposals only for a Trainee in scope. Checked manually with a Trainer of one branch (Tasks 15a, 15b).
5. **A drill a Trainee should not see.** Position (`isParameterVisible`), age rows ("U15+" and unknown labels included) and drills done in the last 30 days are pinned by `drillCandidatesFor` and `sheetDrills` tests (Tasks 3, 5a).
6. **The job pays twice or never stops retrying.** Each Assessment is claimed with one insert on its primary key or one conditional update on the outcome and `checked_at` it was read with; one try per night; at most 3 per change of the Assessment; an Assessment that already has proposals never goes to the model again. Pinned by `dueAssessments` (Task 9) and `stepBeforeModel` (Task 13), and checked by calling the route twice in Task 13.
7. **The Weekly report's prompt changes silently.** The style guide's `drills` line changes, so `PROMPT_VERSION` changes in the same commit (Task 5b).
8. **A Trainer edits the map.** `saveMetricParametersAction` runs `verifyAdmin()`; the page redirects anyone else (Task 6).
9. **A Goal from stale or deleted values.** A proposal whose Assessment is no longer the Trainee's newest live one expires (`staleProposals`, Task 9); one whose Assessment was soft-deleted is hidden by the loaders and refused by `accept_goal_proposal` at once (Tasks 1, 14).
10. **The Weekly report's number check widens.** Drill names and "למה" lines hold set counts and percentages; `allowedNumbers()` leaves `drills` out, pinned by an allowed-numbers test (Task 5a).

---

### Task 1: Migrations and types

**Files:**
- Create: `supabase/migrations/<version>_goal_proposals.sql`, `supabase/migrations/<version>_book_parameter_metrics_seed.sql` (each under the version Supabase records when it is applied, as in steps 1 and 2)
- Modify: `src/types/database.generated.ts` (regenerated, never by hand)

- [ ] **Step 1: Write the schema migration exactly as below.**

```sql
-- Goal proposals and the metric-to-book map, spec
-- docs/superpowers/specs/2026-11-11-weekly-report-design.md ("Goal proposals
-- (phase 3)"), plan docs/superpowers/plans/2026-11-16-goal-proposals.md.
--
-- Expand only: three new tables and one function. Apply this BEFORE deploying
-- the code, which reads and writes them; the code running today never touches
-- them. Safe to rerun. Needs set_row_updated_at() (20260911120000).
--
-- The tables are read and written only by server code with the service role:
-- RLS is on with no policies, and anon and authenticated have no grants. The
-- first draft of the map is the next migration (book_parameter_metrics_seed).

SET LOCAL lock_timeout = '3s';

-- ---------------------------------------------------------------------------
-- The map: which Development book parameters train which Assessment metric
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.book_parameter_metrics (
  parameter_id uuid NOT NULL REFERENCES public.book_parameters(id) ON DELETE CASCADE,
  metric_key text NOT NULL
    CONSTRAINT book_parameter_metrics_metric_known CHECK (metric_key IN (
      'sprint_5m', 'sprint_10m', 'sprint_20m',
      'jump_2leg_distance', 'jump_2leg_height', 'jump_right_leg', 'jump_left_leg',
      'blaze_spot_time',
      'flexibility_ankle', 'flexibility_knee', 'flexibility_hip',
      'kick_power_right_foot', 'kick_power_left_foot',
      'shuffle_10m', 'sprint_10m_h', 'sprint_10m_h_ball', 'envelope', 'envelope_ball'
    )),
  created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT book_parameter_metrics_pkey PRIMARY KEY (parameter_id, metric_key)
);

CREATE INDEX IF NOT EXISTS book_parameter_metrics_metric_key_idx
  ON public.book_parameter_metrics (metric_key);
CREATE INDEX IF NOT EXISTS book_parameter_metrics_created_by_idx
  ON public.book_parameter_metrics (created_by);

COMMENT ON TABLE public.book_parameter_metrics IS
  'Which Development book parameters train which Assessment metric (the 18 Goal metrics). Feeds the drills of the Weekly report and of Goal proposals. Written by saveMetricParametersAction (Admins, /admin/book/metrics) with the service role.';

-- ---------------------------------------------------------------------------
-- Goal proposals
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.goal_proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id uuid NOT NULL REFERENCES public.player_assessments(id) ON DELETE CASCADE,
  trainee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  branch_ids uuid[] NOT NULL,
  metric_key text NOT NULL
    CONSTRAINT goal_proposals_metric_known CHECK (metric_key IN (
      'sprint_5m', 'sprint_10m', 'sprint_20m',
      'jump_2leg_distance', 'jump_2leg_height', 'jump_right_leg', 'jump_left_leg',
      'blaze_spot_time',
      'flexibility_ankle', 'flexibility_knee', 'flexibility_hip',
      'kick_power_right_foot', 'kick_power_left_foot',
      'shuffle_10m', 'sprint_10m_h', 'sprint_10m_h_ball', 'envelope', 'envelope_ball'
    )),
  rank smallint NOT NULL CONSTRAINT goal_proposals_rank_range CHECK (rank BETWEEN 1 AND 3),
  baseline_value numeric(10,3) NOT NULL CONSTRAINT goal_proposals_baseline_sane CHECK (baseline_value >= 0),
  target_value numeric(10,3) NOT NULL CONSTRAINT goal_proposals_target_positive CHECK (target_value > 0),
  facts jsonb NOT NULL,
  reason text,
  drill_ids uuid[] NOT NULL DEFAULT '{}',
  problems jsonb NOT NULL DEFAULT '[]'::jsonb,
  model text NOT NULL,
  prompt_version text NOT NULL,
  status text NOT NULL DEFAULT 'proposed'
    CONSTRAINT goal_proposals_status_known CHECK (
      status IN ('proposed', 'accepted', 'changed', 'rejected', 'expired')
    ),
  accepted_target numeric(10,3)
    CONSTRAINT goal_proposals_accepted_target_positive CHECK (accepted_target > 0),
  goal_id uuid REFERENCES public.player_goals(id) ON DELETE SET NULL,
  decided_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  decided_at timestamptz,
  reject_reason text
    CONSTRAINT goal_proposals_reject_reason_length CHECK (char_length(reject_reason) <= 200),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT goal_proposals_once_per_assessment UNIQUE (assessment_id, metric_key),
  CONSTRAINT goal_proposals_decided_has_time CHECK ((status = 'proposed') = (decided_at IS NULL)),
  CONSTRAINT goal_proposals_accepted_has_target CHECK (
    (status IN ('accepted', 'changed')) = (accepted_target IS NOT NULL)
  ),
  CONSTRAINT goal_proposals_reason_only_when_rejected CHECK (status = 'rejected' OR reject_reason IS NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS goal_proposals_one_open_per_metric
  ON public.goal_proposals (trainee_id, metric_key) WHERE status = 'proposed';
CREATE INDEX IF NOT EXISTS goal_proposals_trainee_idx ON public.goal_proposals (trainee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS goal_proposals_status_idx ON public.goal_proposals (status, created_at);
CREATE INDEX IF NOT EXISTS goal_proposals_branch_ids_idx ON public.goal_proposals USING gin (branch_ids);
CREATE INDEX IF NOT EXISTS goal_proposals_goal_id_idx ON public.goal_proposals (goal_id);
CREATE INDEX IF NOT EXISTS goal_proposals_decided_by_idx ON public.goal_proposals (decided_by);

COMMENT ON TABLE public.goal_proposals IS
  'Up to 3 Goal proposals (הצעות יעד) per Assessment, waiting for staff to accept, change or reject. Written by the goal-proposals cron and the staff actions with the service role; acceptance through accept_goal_proposal().';
COMMENT ON COLUMN public.goal_proposals.branch_ids IS
  'The Trainee''s Weekly report branches when the proposal was made; staff scope filters on it.';
COMMENT ON COLUMN public.goal_proposals.facts IS
  'The candidate exactly as the model saw it: metric, unit, direction, value, benchmark, standing, step, target, basis and the offered drills.';
COMMENT ON COLUMN public.goal_proposals.problems IS
  'Array of {code, text}: what the guardrails removed from the model''s answer (a dropped reason, a drill that was not offered).';
COMMENT ON COLUMN public.goal_proposals.status IS
  'proposed, accepted (as proposed), changed (accepted with a staff target), rejected, expired (superseded, too old, the metric got a Goal, or the Assessment was deleted).';

DROP TRIGGER IF EXISTS goal_proposals_updated_at ON public.goal_proposals;
CREATE TRIGGER goal_proposals_updated_at
  BEFORE UPDATE ON public.goal_proposals
  FOR EACH ROW EXECUTE FUNCTION public.set_row_updated_at();

-- ---------------------------------------------------------------------------
-- Which Assessments the job has looked at
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.goal_proposal_checks (
  assessment_id uuid PRIMARY KEY REFERENCES public.player_assessments(id) ON DELETE CASCADE,
  trainee_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  outcome text NOT NULL
    CONSTRAINT goal_proposal_checks_outcome_known CHECK (
      outcome IN ('proposed', 'no_candidates', 'none_picked', 'unfinished')
    ),
  attempts smallint NOT NULL DEFAULT 1
    CONSTRAINT goal_proposal_checks_attempts_range CHECK (attempts BETWEEN 1 AND 10),
  model text,
  prompt_version text,
  usage jsonb,
  checked_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS goal_proposal_checks_trainee_idx ON public.goal_proposal_checks (trainee_id);

COMMENT ON TABLE public.goal_proposal_checks IS
  'One row per Assessment the goal-proposals cron claimed. checked_at is the last claim. unfinished: claimed, or the run failed; retried on a later night up to 3 attempts. no_candidates and none_picked are looked at again when the Assessment changed after checked_at; proposed is final. Written by the cron with the service role.';

-- ---------------------------------------------------------------------------
-- Accepting: the Goal and the proposal together, or nothing
-- ---------------------------------------------------------------------------

-- The proposal must still be open and unchanged since the screen read it
-- (proposal_changed; a NULL version never matches); its Assessment must not
-- be soft-deleted (assessment_deleted); its Trainee must be a live trainee
-- (not_a_trainee). A second open Goal on the metric fails on
-- idx_player_goals_unique_active (23505). The caller has already run
-- goalRefusal() on the target.
CREATE OR REPLACE FUNCTION public.accept_goal_proposal(
  p_proposal_id uuid,
  p_expected_updated_at timestamptz,
  p_target numeric,
  p_is_lower_better boolean,
  p_actor uuid
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_row goal_proposals%ROWTYPE;
  v_goal uuid;
BEGIN
  SELECT * INTO v_row FROM goal_proposals WHERE id = p_proposal_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'proposal_not_found'; END IF;
  IF v_row.status <> 'proposed' OR v_row.updated_at IS DISTINCT FROM p_expected_updated_at THEN
    RAISE EXCEPTION 'proposal_changed';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM player_assessments WHERE id = v_row.assessment_id AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'assessment_deleted';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM profiles WHERE id = v_row.trainee_id AND role = 'trainee' AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'not_a_trainee';
  END IF;

  INSERT INTO player_goals (user_id, metric_key, target_value, baseline_value, is_lower_better, created_by)
    VALUES (v_row.trainee_id, v_row.metric_key, p_target, v_row.baseline_value, p_is_lower_better, p_actor)
    RETURNING id INTO v_goal;

  UPDATE goal_proposals
    SET status = CASE WHEN p_target = v_row.target_value THEN 'accepted' ELSE 'changed' END,
        accepted_target = p_target,
        goal_id = v_goal,
        decided_by = p_actor,
        decided_at = now()
    WHERE id = p_proposal_id;

  RETURN v_goal;
END $function$;

REVOKE ALL ON FUNCTION public.accept_goal_proposal(uuid, timestamptz, numeric, boolean, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.accept_goal_proposal(uuid, timestamptz, numeric, boolean, uuid) TO service_role;

-- ---------------------------------------------------------------------------
-- Lockdown
-- ---------------------------------------------------------------------------

ALTER TABLE public.book_parameter_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goal_proposal_checks ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.book_parameter_metrics FROM anon, authenticated;
REVOKE ALL ON public.goal_proposals FROM anon, authenticated;
REVOKE ALL ON public.goal_proposal_checks FROM anon, authenticated;
```

- [ ] **Step 2: Write the seed migration exactly as below.** It is a first draft for staff to correct in `/admin/book/metrics` (Task 6), built from the production parameters by slug: speed and power for the sprints and jumps, the flexibility parameter for the flexibility tests, shooting and long passing for kick power, "קוד הקונוסים" (cones, shuffle steps, live reading, with the ball) for the agility and dribbling tests, and dribbling and attacking 1v1 for the tests with the ball. "מבחני מדדים עונתיים" (a test protocol, not training) and the goalkeeper parameter (hidden from every Trainee with a position) are left out on purpose.

```sql
-- First draft of the metric-to-book map, plan
-- docs/superpowers/plans/2026-11-16-goal-proposals.md. Staff correct it in
-- /admin/book/metrics.
--
-- Matches parameters by slug, never by id: a slug that does not exist adds
-- nothing. Safe to rerun: once the map holds any pair it adds nothing, so a
-- rerun never brings back a pair staff removed in the editor.

SET LOCAL lock_timeout = '3s';

INSERT INTO public.book_parameter_metrics (parameter_id, metric_key)
SELECT p.id, m.metric_key
FROM (VALUES
  ('sprint_5m', 'כוח-מתפרץ-8'),
  ('sprint_5m', 'מהירות-ריצה-9'),
  ('sprint_10m', 'מהירות-ריצה-9'),
  ('sprint_10m', 'כוח-מתפרץ-8'),
  ('sprint_20m', 'מהירות-ריצה-9'),
  ('jump_2leg_distance', 'כוח-מתפרץ-8'),
  ('jump_2leg_height', 'כוח-מתפרץ-8'),
  ('jump_right_leg', 'כוח-מתפרץ-8'),
  ('jump_left_leg', 'כוח-מתפרץ-8'),
  ('blaze_spot_time', 'kondos-code'),
  ('blaze_spot_time', 'קריאת-משחק-12'),
  ('flexibility_ankle', 'גמישות-core-כוח-עליון-ריקברי-11'),
  ('flexibility_knee', 'גמישות-core-כוח-עליון-ריקברי-11'),
  ('flexibility_hip', 'גמישות-core-כוח-עליון-ריקברי-11'),
  ('kick_power_right_foot', 'בעיטה-לשער-5'),
  ('kick_power_right_foot', 'מסירה-ארוכה-4'),
  ('kick_power_left_foot', 'בעיטה-לשער-5'),
  ('kick_power_left_foot', 'מסירה-ארוכה-4'),
  ('shuffle_10m', 'kondos-code'),
  ('shuffle_10m', 'אחד-על-אחד-הגנתי-1'),
  ('sprint_10m_h', 'kondos-code'),
  ('sprint_10m_h', 'מהירות-ריצה-9'),
  ('sprint_10m_h_ball', 'kondos-code'),
  ('sprint_10m_h_ball', 'כישורי-כדרור-6'),
  ('sprint_10m_h_ball', 'אחד-על-אחד-התקפי-0'),
  ('envelope', 'kondos-code'),
  ('envelope_ball', 'kondos-code'),
  ('envelope_ball', 'כישורי-כדרור-6')
) AS m(metric_key, slug)
JOIN public.book_parameters p ON p.slug = m.slug
WHERE NOT EXISTS (SELECT 1 FROM public.book_parameter_metrics)
ON CONFLICT (parameter_id, metric_key) DO NOTHING;
```

- [ ] **Step 3:** Ask the user, then apply both to production through the Supabase connector (`apply_migration`, names `goal_proposals` and `book_parameter_metrics_seed`, in that order), and save each file under the version it records.
- [ ] **Step 4:** Verify: the three tables exist with RLS on and no policies; `anon` and `authenticated` hold no privileges on them (`information_schema.role_table_grants`) and cannot execute `accept_goal_proposal` (`has_function_privilege`); `select count(*) from book_parameter_metrics` is 28 (all ten slugs exist in production today; a lower count names a slug that changed, to fix in the editor); an insert into `goal_proposals` with `status = 'accepted'` and no `accepted_target` fails its CHECK; running the seed's SQL a second time adds no row.
- [ ] **Step 5:** Regenerate the types (`npm run db:types`, or the connector's `generate_typescript_types` written over the file), then `npx tsc --noEmit`.
- [ ] **Step 6: Commit** `feat(weekly-report): goal proposal tables and the metric-to-book map`.

---

### Task 2: One set of Goal rules

**Files:**
- Create: `src/features/goals/lib/utils/goal-rules.ts`
- Modify: `src/features/goals/lib/config/goal-config.ts`, `src/features/goals/index.ts`, `src/features/goals/lib/actions/set-goal.ts`
- Test: `src/features/goals/lib/__tests__/goal-rules.test.ts`

**Interfaces (pure):**
- `goal-config.ts`: `export type GoalMetric = Exclude<PhysicalMetricKey, "kick_power_kaiser">` (exactly the 18 Goal metrics: `PhysicalMetricKey` is the 19 `NUMERIC_METRIC_KEYS`), and `GOAL_METRICS` typed `readonly GoalMetric[]` (same entries, same order), so adding a key that is not a Goal metric fails to compile. `index.ts` exports `GoalMetric`. Every later task names a Goal metric by `GoalMetric`.
- `isGoalMetric(value: string): value is GoalMetric`: in `GOAL_METRICS` (through `(GOAL_METRICS as readonly string[]).includes(value)`).
- `goalRefusal(input: { metricKey: string; targetValue: number; baselineValue: number | null }): string | null`, the checks `setGoal()` makes today, in its order and with its words: not a Goal metric gives "מדד לא תקין"; a target that is not a finite number above 0 gives "ערך היעד חייב להיות חיובי"; with a baseline above 0, a lower-is-better target not below it gives "עבור מדד זה, היעד צריך להיות נמוך מהערך הנוכחי" and a higher-is-better target not above it "עבור מדד זה, היעד צריך להיות גבוה מהערך הנוכחי"; otherwise null.
- `setGoal()` calls `goalRefusal()` in place of its inline metric, target and direction checks and returns `{ success: false, error }` with the same text. Nothing else in it changes.

- [ ] **Step 1: Write the failing tests:** `isGoalMetric("sprint_10m")` and `isGoalMetric("envelope_ball")` are true, `isGoalMetric("kick_power_kaiser")` and `isGoalMetric("speed")` are false; `kick_power_kaiser` gives "מדד לא תקין"; a target of 0 and of `NaN` give "ערך היעד חייב להיות חיובי"; `sprint_10m` with baseline 2 and target 2.1 (and 2) gives the "נמוך" message; `jump_2leg_distance` with baseline 180 and target 175 gives the "גבוה" message; a baseline of null or 0 checks only the metric and the target; `sprint_10m` 2 to 1.9 gives null.
- [ ] **Step 2: Run** `npm run test:run -- src/features/goals/lib/__tests__/goal-rules.test.ts` (FAIL), **Step 3:** implement the type, retype `GOAL_METRICS` and refactor `setGoal()`, **Step 4: Run** (PASS) and `npx tsc --noEmit` (`SetGoalDialog` and the goal-config test keep compiling with the narrower type).
- [ ] **Step 5: Commit** `refactor(weekly-report): one goalRefusal rule for setGoal and goal proposals`.

---

### Task 3: Drill rules of the Development book

**Files:**
- Create: `src/features/development-book/lib/drill-candidates.ts`
- Test: `src/features/development-book/lib/__tests__/drill-candidates.test.ts`

**Interfaces (pure):**

```ts
/** A parameter as the drill rules see it. `ageGroups` are its age rows' raw values ("U15+" included). */
export interface PoolParameter {
  id: string;
  nameHe: string;
  isAllPositions: boolean;
  positions: CanonicalPosition[];
  ageGroups: string[];
  /** Category order, then parameter order: the book's own order. */
  order: number;
  metricKeys: string[];
}
export interface PoolDrill { id: string; parameterId: string; name: string; why: string | null; order: number }
export interface DrillPool { parameters: PoolParameter[]; drills: PoolDrill[] }
export interface MetricDrill { id: string; name: string; why: string | null; metricKey: string; parameterName: string }
/** A drill as a reader shows it. The weekly report's `DrillCandidate` has the same shape. */
export interface DrillLine { id: string; name: string; why: string | null }
export type PositionFit = "position" | "all" | "none";
/** The age row labels the rules read: the four book groups and the stored "U15+". */
export const BOOK_AGE_LABELS = ["U10-12", "U13-14", "U15-16", "U17+", "U15+"] as const;
```

- `drillName(nameHe: string | null, nameEn: string | null): string | null`: the trimmed Hebrew name, else the trimmed English one, else null.
- `drillWhy(whyHe: string | null): string | null`: trimmed, without a leading "למה זה עובד:" (and the space after it); null when nothing is left.
- `fitsAge(ageGroups: readonly string[], group: AgeGroup | null): boolean`: true with no group; only the rows whose label is in `BOOK_AGE_LABELS` count, and with none of those (no rows, or only labels the rules do not know) it is true; otherwise true when the known rows hold the group, where "U15+" also covers "U15-16" and "U17+".
- `drillsForMetric(pool: DrillPool, metricKey: string, who: { ageGroup: AgeGroup | null; position: string | null }): (PoolDrill & { parameterName: string })[]`: the drills of the parameters mapped to the metric that `isParameterVisible(parameter, who.position)` and `fitsAge(parameter.ageGroups, who.ageGroup)` allow, in parameter order then drill order, each once.
- `drillCandidatesFor(pool: DrillPool, request: { metrics: readonly string[]; ageGroup: AgeGroup | null; position: string | null; doneIds: ReadonlySet<string>; preferred?: ReadonlyMap<string, readonly string[]>; limit: number }): MetricDrill[]`: per metric in the given order, `drillsForMetric` without the done drills, with that metric's `preferred` ids that are still in the list moved to the front; then one drill per metric in turn until `limit`; a drill reached through two metrics appears once, under the first.
- `metricPositionFit(pool: DrillPool, metricKey: string, who: { ageGroup: AgeGroup | null; position: string | null }): PositionFit`: only the mapped parameters that `fitsAge(parameter.ageGroups, who.ageGroup)` allows count; `"position"` when one of them is not all-positions and lists the position; else `"all"` when one of them is visible to the position (`isParameterVisible`); else `"none"`. The tier and the drills offered then always agree.

- [ ] **Step 1: Write the failing tests** on a fixture pool: P1 all positions, no age rows, metric `sprint_10m`, drills d1 then d2; P2 positions LW and RW, metric `kick_power_right_foot`, drill d3; P3 not all positions and no positions (the goalkeeper case), metric `sprint_10m`, drill d4; P4 age rows `["U10-12"]`, metric `jump_2leg_distance`, drill d5; P5 age rows `["U10-12", "U13-14", "U15+"]`, metric `sprint_10m`, drill d6, ordered after P1; P6 positions LW, age rows `["U17+"]`, metric `kick_power_left_foot`, drill d7; P7 all positions, age rows `["U8", "בוגרים"]` (labels the rules do not know), metric `jump_2leg_height`, drill d8.
  - `drillName("", "Box Jumps")` is "Box Jumps"; `drillName(" קפיצות ", "x")` is "קפיצות"; `drillName(null, " ")` is null. `drillWhy("למה זה עובד: בונה כוח")` is "בונה כוח"; `drillWhy("בונה כוח")` is unchanged; `drillWhy("  ")` is null.
  - `fitsAge([], "U13-14")`, `fitsAge(["U15+"], "U17+")`, `fitsAge(["U15+"], "U15-16")`, `fitsAge(["U10-12"], null)` and `fitsAge(["U8"], "U13-14")` are true; `fitsAge(["U10-12"], "U13-14")` and `fitsAge(["U10-12", "U8"], "U13-14")` are false (a known row decides; an unknown one is ignored).
  - For CB at U13-14 with metrics `[sprint_10m, kick_power_right_foot]`: d1, d2, d6 (no d3, no d4). For LW: d1, d3, d2, d6 (one per metric in turn). For a null position: d4 is included. `jump_2leg_height` at U13-14 gives d8.
  - A done d1 is left out; `preferred` `{ sprint_10m: ["d2"] }` puts d2 first; `limit: 2` gives two; `jump_2leg_distance` at U13-14 gives nothing (P4 is U10-12 only); a parameter mapped to two requested metrics gives its drill once.
  - `metricPositionFit` is `"position"` for `kick_power_right_foot` and LW, `"none"` for it and CB, `"all"` for `sprint_10m` and CB and for a null position, `"none"` for an unmapped metric; for `kick_power_left_foot` and LW it is `"position"` at U17+ and `"none"` at U13-14 (P6 leaves that age out); `"all"` for `jump_2leg_height` at U13-14 (P7's labels are unknown).
- [ ] **Step 2: Run** (FAIL), **Step 3:** implement, **Step 4: Run** (PASS).
- [ ] **Step 5: Commit** `feat(weekly-report): development book drill rules for goals`.

---

### Task 4: Book readers for the server

**Files:**
- Create: `src/features/development-book/lib/queries/drill-pool.ts` (`import "server-only"`)
- Modify: `src/features/weekly-reports/lib/queries/queue.ts` (`readDrills`), `src/features/weekly-reports/lib/queries/parent-view.ts` (`readDrills`)

Service role. A failed read throws with the table's name, as the weekly report readers do. The file imports nothing from `src/features/weekly-reports/` (the Weekly report imports it, so the dependency runs one way): its own `Db = ReturnType<typeof createAdminClient>` and a small local check that throws with the table's name.

**Interfaces:**
- `loadDrillPool(db): Promise<DrillPool>`: `book_categories` (`id, order_index`), `book_parameters` (`id, category_id, name_he, order_index, is_all_positions`), `book_parameter_positions`, `book_age_rows` (`parameter_id, age_group`), `book_drills` (`id, parameter_id, name_he, name_en, why_he, order_index`) and `book_parameter_metrics`, read in parallel (small whole tables, through `readAllPages`). `order = category.order_index * 1000 + parameter.order_index`; positions filtered to `CanonicalPosition` values; a drill with no name (`drillName` null) is left out; `why` through `drillWhy`.
- `readDrillsDone(db, traineeIds: readonly string[], fromDay: string, toDay: string): Promise<Map<string, Set<string>>>`: `book_drill_progress` (`user_id, drill_id, completed_at`) by `readInChunks` on `user_id`, `completed_at` from the start of the UTC day before `fromDay`, then kept when `israelDateStr(completed_at)` is from `fromDay` to `toDay`.
- `readDrillsByIds(db, ids: readonly string[]): Promise<DrillLine[]>`: `book_drills` (`id, name_he, name_en, why_he`), in the order of `ids`, each once, named by `drillName` with `why` through `drillWhy`; a drill with no name is left out. Throws on a failed read.
- `queue.ts` `readDrills` and `parent-view.ts` `readDrills` call `readDrillsByIds` (the parent view keeps its try, log and `[]`); the queue's "תרגיל" fallback goes.

- [ ] **Step 1:** Write the file and switch the two readers.
- [ ] **Step 2: Run** `npx tsc --noEmit`, `npm run lint`, `npm run test:run`.
- [ ] **Step 3: Commit** `feat(weekly-report): book readers for drills, one name rule`.

---

### Task 5a: Drills in the Fact sheet, the pure part

**Files:**
- Create: `src/features/weekly-reports/lib/fact-sheet/drills.ts`
- Modify: `src/features/weekly-reports/lib/fact-sheet/types.ts`, `fact-sheet/build.ts`, `fact-sheet/allowed-numbers.ts`
- Test: `src/features/weekly-reports/lib/fact-sheet/__tests__/drills.test.ts`; update for the new field every test that builds a drill: `fact-sheet/__tests__/build.test.ts` (line 59), `fact-sheet/__tests__/allowed-numbers.test.ts` (line 63), `lib/__tests__/guardrails.test.ts` (line 15) and `queries/__tests__/stored.test.ts` (line 92). `fact-sheet/__tests__/fixtures.ts` keeps `drillCandidates: []` and needs no change.

**Interfaces:**
- `types.ts`: `export interface SheetDrill extends DrillCandidate { goal: string }` (the Goal's Hebrew label, as in `goals[].metric`); `TraineeWeekInput.drillCandidates: SheetDrill[]`; `FactSheet.drills: SheetDrill[]`. `DrillCandidate` stays `{ id, name, why }` for display (the same shape as the book's `DrillLine`). The "Always empty until step 3" comment goes.
- `drills.ts` (pure): `MAX_SHEET_DRILLS = 6`; `sheetDrills(pool: DrillPool, input: { goals: readonly PlayerGoalRow[]; birthdate: string | null; position: string | null; weekEnd: string; doneIds: ReadonlySet<string>; goalDrills: ReadonlyMap<string, readonly string[]> }): SheetDrill[]`: the open Goals (`achieved_at` null) oldest first (`created_at`); their metrics in that order; the book age group `deriveAgeGroup(birthdate, new Date(\`${weekEnd}T12:00:00Z\`))`; `drillCandidatesFor` with `limit: MAX_SHEET_DRILLS` and `preferred` = each Goal's `goalDrills` by metric; each drill's `goal` = `METRIC_LABELS_HE` of its metric.
- `build.ts`: `drills: input.drillCandidates.map(({ id, name, why, goal }) => ({ id, name, why, goal }))`.
- `allowed-numbers.ts`: `allowedNumbers(sheet)` walks the sheet without its drills, `numbersOf({ ...sheet, drills: [] })`, and still adds `sheet.drills.length`. Its doc comment says why: a drill's name and "למה" line are the book's text, not facts about the Trainee, so a set count, a time or a percentage in them never becomes a number the texts may use. (The `goal` label repeats `goals[].metric`, which stays in the walk.)

- [ ] **Step 1: Write the failing tests** for `sheetDrills` on a small pool: two open Goals (sprint 10 older, kick power newer) give drills one per Goal in turn with `goal` "ספרינט 10 מטר" and "עוצמת בעיטה - רגל ימין"; an achieved Goal adds nothing; a done drill is left out; a drill of the Goal's accepted proposal comes first for that Goal; a 15 year old (birthdate 15 years before the week's end) gets the drills of a "U15+" parameter; a CB gets no drill of a LW and RW parameter; never more than 6; no open Goal gives `[]`. Update `build.test.ts` so a candidate with `goal` is copied with it. In `allowed-numbers.test.ts`, give the fixture's drill a `goal`, the name "סט של 65 קפיצות" and the "למה" line "בונה 35 אחוז יותר כוח", and add: "a number that appears only in a drill's name or 'למה' line is not allowed" (65 and 35 are not; the drill count still is). Add `goal` to the drills of `guardrails.test.ts` and `stored.test.ts`.
- [ ] **Step 2: Run** `npm run test:run -- src/features/weekly-reports/lib` (FAIL), **Step 3:** implement the pure file, the types, `build.ts` and `allowedNumbers`, **Step 4: Run** (PASS) and `npx tsc --noEmit` (`week-input.ts` still sets `drillCandidates: []`, which compiles).
- [ ] **Step 5: Commit** `feat(weekly-report): drills for open goals, the pure rules`.

---

### Task 5b: Drills in the Weekly report, the loaders and the prompt

**Files:**
- Create: `src/features/weekly-reports/lib/queries/goal-drills.ts` (`import "server-only"`)
- Modify: `src/features/weekly-reports/lib/queries/week-input.ts`, `writer/style-guide.ts`

**Interfaces:**
- `goal-drills.ts`: `readGoalDrills(db, goalIds: readonly string[]): Promise<Map<string, string[]>>`: `goal_proposals` with `goal_id` in the ids (`readInChunks`) and status `accepted` or `changed`: goal id to the proposal's `drill_ids`. It lives in the Weekly report, which reads the table directly, so the dependency between the two features runs one way: `goal-proposals` imports `weekly-reports` (`Db`, `must`, the writer, `reportBranches`, the scope rule), never the reverse.
- `week-input.ts`: `readWeekParts` adds `loadDrillPool(db)` and `readDrillsDone(db, ids, addDays(range.to, -29), range.to)` to its `Promise.all`; after it, `readGoalDrills(db, <every open Goal id>)` (as the group stats are read after the Assessments). `inputOf` sets `drillCandidates: sheetDrills(pool, { goals, birthdate: profile.birthdate, position: profile.position, weekEnd: range.to, doneIds, goalDrills })`. The doc comment on `loadWeekInputs` says how drills are chosen.
- `style-guide.ts`: the `drills` line under "מה יש בדף העובדות" becomes "drills: תרגילים מספר הפיתוח שאפשר להציע לשבוע הבא. לכל תרגיל goal, היעד שהוא משרת, כפי שהוא מופיע ב-goals." and the first line of "## drill_ids" becomes "בחרו עד 3 מזהים, רק מתוך drills שבדף: תרגילים ליעדים הפתוחים (לפי goal), ובשבוע שבו עבדנו על משהו קרוב, את התרגילים שממשיכים אותו." `PROMPT_VERSION` moves to the next value in its format (the date of the change and `.1`, or the next number on the same date).

- [ ] **Step 1:** Write `goal-drills.ts`, the wiring in `week-input.ts`, and the style guide change with the version bump, in one commit with the version.
- [ ] **Step 2: Run** `npx tsc --noEmit`, `npm run lint`, `npm run test:run`, `npm run build`.
- [ ] **Step 3:** With the user's agreement (it spends API credit and reads production), run the preview script for one past week, 3 Trainees with an open Goal: the Fact sheets show drills with their Goals, and the texts never name a drill.
- [ ] **Step 4: Commit** `feat(weekly-report): drills for open goals in the fact sheet`.

---

### Task 5c: Drills on the staff sheet, the player's card and the parent page

**Files:**
- Modify: `src/features/weekly-reports/lib/queries/player.ts`, `components/admin/FactSheetView.tsx`, `components/report/DrillList.tsx`, `components/trainee/WeeklyReportCard.tsx`

**Interfaces:**
- `FactSheetView.tsx`: each drill line reads "<name> (ליעד: <goal>)".
- `DrillList.tsx`: an optional `linkToBook?: boolean`; with it, each name links to `/dashboard/book/drills/${drill.id}`. The comment about later steps goes.
- `player.ts`: `PlayerReport` of kind `report` gains `drills: DrillCandidate[]`, read with `readDrillsByIds(db, offeredDrillIds(stored.sheet, row.drill_ids))` (select `drill_ids` too); a failed drill read is logged and gives `[]`. `WeeklyReportCard` renders `<DrillList drills={report.drills} linkToBook />` under the Goals. The parent page keeps `DrillList` without links (Decision 19).

- [ ] **Step 1:** Write the four changes.
- [ ] **Step 2: Run** `npx tsc --noEmit`, `npm run lint`, `npm run build`.
- [ ] **Step 3:** Manual check at 320 px and 1440 px on a report whose Fact sheet has drills (the preview's week, or a stored row): the staff sheet shows each drill with its Goal; the player's card links each chosen drill to its book page; the parent page lists them without links.
- [ ] **Step 4: Commit** `feat(weekly-report): show the chosen drills to staff, the player and the parent`.

---

### Task 6: The map editor

**Files:**
- Create: `src/lib/validations/book-metric-map.ts`, `src/features/development-book/lib/metric-map.ts`, `src/features/development-book/lib/queries/metric-map.ts` (`import "server-only"`), `src/features/development-book/lib/actions/admin-book-metrics.ts` (`"use server"`), `src/features/development-book/components/admin/MetricMapClient.tsx` (client), `src/app/admin/book/metrics/page.tsx`
- Modify: `src/app/admin/book/page.tsx` (a "מיפוי מדדים" button for Admins)
- Test: `src/lib/validations/__tests__/book-metric-map.test.ts`, `src/features/development-book/lib/__tests__/metric-map.test.ts`

**Interfaces:**
- `book-metric-map.ts`: `metricMapSchema = z.object({ metricKey, parameterIds })`: `metricKey` one of `GOAL_METRICS` (a string refined by `isGoalMetric`, since `GOAL_METRICS` is a `readonly GoalMetric[]` and not a tuple `z.enum` takes; "מדד לא תקין"); `parameterIds` an array of `UUID_REGEX` strings ("מזהה פרמטר לא תקין"), at most 20 ("אפשר לבחור עד 20 פרמטרים למדד"), distinct ("פרמטר מופיע פעמיים").
- `metric-map.ts` (pure): `MapParameter = { id; nameHe; categoryName; order; isAllPositions; positions: string[]; drillCount: number }`; `metricMapRows(parameters: readonly MapParameter[], pairs: readonly { parameterId: string; metricKey: string }[]): MetricMapRow[]` with `MetricMapRow = { metricKey; label; unit; parameters: (MapParameter & { warnings: string[] })[] }`: one row per `GOAL_METRICS` entry in that order, labels and units from `METRIC_LABELS_HE` and `METRIC_UNITS`, the mapped parameters in book order; warnings "מוסתר מכל שחקן שיש לו עמדה" (not all positions and no position listed) and "אין תרגילים" (no drill); a pair whose parameter no longer exists is left out.
- `queries/metric-map.ts`: `loadMetricMapView(db): Promise<{ rows: MetricMapRow[]; parameters: MapParameter[] }>`: the parameters with category names, positions and drill counts, and every pair.
- `admin-book-metrics.ts`: `saveMetricParametersAction(input: MetricMapInput): Promise<{ success: true } | { error: string }>`: `verifyAdmin()`; the schema; every parameter id exists (`book_parameters` `in`), else "פרמטר לא נמצא"; delete the metric's pairs whose parameter is not in the list, then insert the missing ones with `created_by` (`upsert` with `ignoreDuplicates` on `parameter_id,metric_key`); `revalidatePath("/admin/book/metrics")`. Failures log and give "שמירת המיפוי נכשלה, נסו שוב".
- `page.tsx`: `verifyAdmin()`, else `redirect("/admin/book")`; title "מיפוי מדדים לספר הפיתוח", the line "לכל מדד במבדק: הפרמטרים בספר שמאמנים אותו. מכאן נבחרים התרגילים לדוח השבועי ולהצעות היעד."; `MetricMapClient` with the rows and the parameter list. `metadata` "מיפוי מדדים | Garden of Eden".
- `MetricMapClient`: one card per metric (label and unit), its parameters as chips with a remove button and their warnings in small text, an "הוספת פרמטר" select grouped by category, and "שמירה" shown when the row changed; a toast and `router.refresh()` after saving. Phone first.
- `/admin/book/page.tsx`: next to "ניהול שרירים", a "מיפוי מדדים" button linking to `/admin/book/metrics`, rendered only when `verifyAdminOrTrainer()` gives `role === "admin"`.

- [ ] **Step 1: Write the failing tests:** the schema refuses `kick_power_kaiser`, a repeated parameter id, 21 ids and a malformed id, and accepts an empty list; `metricMapRows` gives 18 rows in `GOAL_METRICS` order, sorts a metric's parameters by book order, warns on a hidden parameter and on one with no drills, and ignores a pair of a deleted parameter.
- [ ] **Step 2: Run** (FAIL), **Step 3:** implement the two pure files, **Step 4: Run** (PASS).
- [ ] **Step 5:** Write the loader, the action, the page, the client and the button.
- [ ] **Step 6: Run** `npx tsc --noEmit`, `npm run lint`, `npm run build`. Manual check at 320 px and 1440 px: the seeded draft shows; removing and adding a parameter saves; a Trainer gets redirected and the action refuses them.
- [ ] **Step 7: Commit** `feat(weekly-report): metric-to-book map editor for admins`.

---

### Task 7: Gaps against the age group

**Files:**
- Create: `src/features/goal-proposals/lib/gaps.ts`
- Test: `src/features/goal-proposals/lib/__tests__/gaps.test.ts`

**Interfaces (pure):**
- `quantile(sorted: readonly number[], p: number): number`: linear interpolation between the closest ranks of a non-empty ascending list (`p` from 0 to 1).
- `plausibleBand(values: readonly number[]): { low: number; high: number } | null`: half and twice the median; null for an empty list.
- `MIN_GROUP_VALUES = 8`, `BENCHMARK_QUANTILE = 0.75`, `CURRENT_VALUE_DAYS = 365`.
- `interface GroupMetric { benchmark: number; values: number[]; band: { low: number; high: number } }`: `values` are the plausible ones, ascending.
- `groupMetric(metric: PhysicalMetricKey, values: readonly number[]): GroupMetric | null`: drop values outside `plausibleBand`; fewer than `MIN_GROUP_VALUES` left gives null; the benchmark is `quantile(values, 0.75)`, or `quantile(values, 0.25)` when `isLowerBetterMetric(metric)`.
- `interface ProfileAges { id: string; birthdate: string | null; age_group_override: string | null; age_group_override_until: string | null }`; `interface MetricRow { id: string; userId: string; date: string; createdAt: string; values: Partial<Record<PhysicalMetricKey, number | null>> }`. `date` and `createdAt` are never null here: the loaders (Task 12) leave out a row with no `assessment_date` and pass a missing `created_at` as `""`, so such a row loses a same-date tie.
- `groupMetrics(profiles: readonly ProfileAges[], rows: readonly MetricRow[], today: string): Map<string, Map<PhysicalMetricKey, GroupMetric>>`: per age group id (`resolveAgeGroup(profile, today)`), per Goal metric, the value of each Trainee's latest row (by date, then `createdAt`) dated in the last `CURRENT_VALUE_DAYS` that has it.
- `interface Gap { metric: PhysicalMetricKey; value: number; benchmark: number; gap: number; betterThanPercent: number; groupSize: number; fit: PositionFit }`.
- `findGaps(input: { values: Partial<Record<PhysicalMetricKey, number | null>>; group: ReadonlyMap<PhysicalMetricKey, GroupMetric>; fits: ReadonlyMap<string, PositionFit>; exclude: ReadonlySet<string> }): Gap[]`: for each Goal metric not excluded, with a value, a group metric, and the value inside the group's band: a gap when the value is worse than the benchmark (`gap` is the positive distance), with `betterThanPercent = calculatePercentile(value, values, lowerIsBetter)` and `groupSize = values.length`. Sorted by fit (`position`, `all`, `none`), then `betterThanPercent` ascending, then `GOAL_METRICS` order.

- [ ] **Step 1: Write the failing tests:** `quantile([1, 2, 3, 4, 5], 0.75)` is 4, `quantile([1, 2, 3, 4], 0.5)` is 2.5, `quantile([10], 0.3)` is 10. `groupMetric("sprint_10m", ...)` on seven values is null; on `[1.8, 1.85, 1.9, 1.95, 2.0, 2.05, 2.1, 2.15]` it is `1.8875` (the 25th percentile, faster is better); on jumps it takes the 75th; a value of 50 among jumps near 180 is dropped from `values`. `groupMetrics` puts a Trainee in the group of `resolveAgeGroup(profile, today)`, takes the latest row's value, and skips a row older than a year. `findGaps`: a value worse than the benchmark is a gap with the right distance; a better one is not; an excluded metric is skipped; a value outside the band is skipped; a `position` metric sorts before an `all` metric with a lower standing.
- [ ] **Step 2: Run** (FAIL), **Step 3:** implement, **Step 4: Run** (PASS).
- [ ] **Step 5: Commit** `feat(weekly-report): goal gaps against the age group`.

---

### Task 8: Targets from the academy's history

**Files:**
- Create: `src/features/goal-proposals/lib/targets.ts`
- Test: `src/features/goal-proposals/lib/__tests__/targets.test.ts`

**Interfaces (pure):**
- `PAIR_MIN_DAYS = 42`, `PAIR_MAX_DAYS = 84`, `MIN_PAIRS = 20`, `HISTORY_LOW = 0.6`, `HISTORY_HIGH = 0.75`, `HISTORY_DAYS = 730`, `PAIR_MAX_FACTOR = 2`.
- `TARGET_DECIMALS: Record<GoalMetric, number>` (`GoalMetric` from `goal-config.ts`, Task 2): 2 for the sprints, the dribbling and the envelope tests; 1 for flexibility; 0 for the jumps, kick power and Blaze. `roundTo(value: number, decimals: number): number`.
- `improvementPairs(profiles: readonly ProfileAges[], rows: readonly MetricRow[], metric: PhysicalMetricKey): Map<string, number[]>`: per Trainee, rows sorted by date; for each row with the metric, the earliest later row with the metric 42 to 84 days after it (`daysBetween`); a pair whose values differ by more than a factor of 2 is dropped; the improvement is `later - earlier`, or `earlier - later` when lower is better; grouped by `resolveAgeGroup(profile, new Date(\`${earlier.date}T12:00:00Z\`))`; a Trainee with no group adds nothing. Every age group id to its improvements.
- `historyByGroup(profiles, rows, today): Map<string, Map<PhysicalMetricKey, number[]>>`: `improvementPairs` per Goal metric over rows dated in the last `HISTORY_DAYS`.
- `interface Target { step: number; target: number; basis: "history" | "half_gap"; pairs: number }`.
- `targetFor(input: { metric: GoalMetric; value: number; gap: number; history: readonly number[] }): Target | null`: `unit = 10 ** -decimals`; with `history.length >= MIN_PAIRS`: `low = quantile(sorted, 0.6)`, `high = quantile(sorted, 0.75)`; `high <= 0` gives null; `step = min(max(gap / 2, max(low, unit)), high)`, basis `history`. Otherwise `step = gap / 2`, basis `half_gap`. Then `step = roundTo(step, decimals)`; below `unit` gives null; `target = roundTo(lowerIsBetter ? value - step : value + step, decimals)`; not above 0 gives null.

- [ ] **Step 1: Write the failing tests:** rows on 2026-01-01 (2.10), 2026-01-20 (2.08) and 2026-02-15 (2.00) of `sprint_10m` give one pair, 0.1 (01-01 to 02-15 is 45 days; 01-20 to 02-15 is 26); rows 30 or 90 days apart give none; jumps of 50 then 180 give none; a pair is grouped by the first row's age group. `targetFor` with 5 history values, value 2.10 and gap 0.20 gives step 0.1, target 2.0, `half_gap`; with 20 values whose 60th and 75th percentiles are 0.04 and 0.08 it gives step 0.08, target 2.02, `history`; with a gap of 0.04 it gives the 60th percentile, 0.04; with a 75th percentile of 0 it gives null; a jump at 180 with gap 15 and little history gives step 8, target 188; a gap of 0.005 on `sprint_10m` gives null.
- [ ] **Step 2: Run** (FAIL), **Step 3:** implement, **Step 4: Run** (PASS).
- [ ] **Step 5: Commit** `feat(weekly-report): goal targets from the academy's history`.

---

### Task 9: Candidates, what is due, and what expires

**Files:**
- Create: `src/features/goal-proposals/lib/candidates.ts`, `src/features/goal-proposals/lib/due.ts`
- Test: `src/features/goal-proposals/lib/__tests__/candidates.test.ts`, `__tests__/due.test.ts`

**Interfaces (pure):**
- `candidates.ts`:

```ts
export const MAX_CANDIDATES = 6;
export const OFFERED_DRILLS_PER_GOAL = 5;

export interface CandidateFacts {
  metric_key: GoalMetric;
  metric: string;          // METRIC_LABELS_HE
  unit: string;            // METRIC_UNITS
  direction: string;       // "נמוך יותר טוב יותר" | "גבוה יותר טוב יותר"
  value: number;           // this Assessment, rounded to TARGET_DECIMALS
  benchmark: number;       // the group's upper quartile, rounded the same way
  betterThanPercent: number;
  groupSize: number;
  step: number;
  target: number;
  basis: string;           // basisText(): see below
  positionFit: string;     // "מתאים לעמדה" | "לכל העמדות" | "אין פרמטר בספר"
  drills: { id: string; name: string; why: string | null; parameter: string }[];
}
```

  - `basisText(target: Target): string`: "השיפור של שחקני הקבוצה בין מבדקים בהפרש של 6 עד 12 שבועות (<pairs> זוגות)" for `history`; "חצי מהפער לרף הקבוצה" for `half_gap`.
  - `proposalCandidates(input: { gaps: readonly Gap[]; history: ReadonlyMap<PhysicalMetricKey, readonly number[]>; drills: (metric: string) => readonly MetricDrill[] }): CandidateFacts[]`: in the gaps' order, each gap whose `targetFor` is not null, with up to `OFFERED_DRILLS_PER_GOAL` drills; at most `MAX_CANDIDATES`.
  - `excludedMetrics(input: { openGoalMetrics: readonly string[]; rejected: readonly { metricKey: string; decidedOn: string }[]; today: string }): Set<string>`: the metrics with an open Goal, and those rejected on or after `addDays(today, -REJECTED_QUIET_DAYS)`.
- `due.ts`:
  - `DUE_WINDOW_DAYS = 14`, `MAX_ATTEMPTS = 3`, `PROPOSAL_TTL_DAYS = 30`, `REJECTED_QUIET_DAYS = 60`, `MAX_PER_RUN = 40`.
  - `SENSITIVE_LOOKBACK_DAYS = 14` (Decision 24).
  - `interface DueRow { id: string; traineeId: string; date: string; createdAt: string; changedAt: string }` (`changedAt` = the snapshot's `computed_at`, else `created_at`; the loader fills the nulls, Task 12) and `interface CheckState { outcome: string; attempts: number; checkedAt: string }` (`checkedAt` = when the check was last claimed).
  - `newestByTrainee(rows: readonly { id: string; traineeId: string; date: string; createdAt: string }[]): Map<string, string>`: Trainee id to the id of their newest row (date, then `createdAt`). Used by `dueAssessments` and by `expireStale` (Task 12), so both agree on "newest".
  - `interface DueItem { id: string; traineeId: string; attempts: number; previous: { outcome: string; checkedAt: string } | null }`: `attempts` is the count this claim records; `previous` is the check as read (null for none), which the claim matches on.
  - `dueAssessments(rows: readonly DueRow[], checks: ReadonlyMap<string, CheckState>, today: string): DueItem[]`: per Trainee the newest row (`newestByTrainee`); due when dated from `addDays(today, -DUE_WINDOW_DAYS)` to `today`, `israelDateStr(changedAt) < today`, and one of: no check (`attempts: 1`); an `unfinished` check with fewer than `MAX_ATTEMPTS` attempts that was not checked today (`attempts` = its count plus 1); a `no_candidates` or `none_picked` check claimed before the Assessment last changed (`Date.parse(checkedAt) < Date.parse(changedAt)`: staff finished or corrected it since, Decision 5), as a fresh check (`attempts: 1`). A `proposed` check is never due again. Oldest first; at most `MAX_PER_RUN`.
  - `staleProposals(open: readonly { id: string; traineeId: string; assessmentId: string; metricKey: string; createdAt: string; assessmentDeleted: boolean }[], openGoals: ReadonlySet<string>, newest: ReadonlyMap<string, string>, today: string): string[]`: ids created before `addDays(today, -PROPOSAL_TTL_DAYS)` (Israel day), or whose `${traineeId}:${metricKey}` is in `openGoals`, or whose Assessment is soft-deleted, or whose `assessmentId` is not `newest.get(traineeId)` (a newer live Assessment exists, whatever its check's outcome, Decision 10).

- [ ] **Step 1: Write the failing tests:** eight gaps give at most six candidates; a gap whose target is null is skipped; the facts carry the Hebrew label, unit and direction, numbers rounded by `TARGET_DECIMALS`, the basis line with the pair count, and at most five drills; `excludedMetrics` holds an open Goal's metric and one rejected 59 days ago but not 61. `newestByTrainee` takes the later date, and on the same date the later `createdAt`, and a `createdAt` of `""` loses the tie. `dueAssessments`: of two rows of one Trainee only the newer counts; a newest row changed today is not due (and the older is not offered instead); one dated 15 days ago is not due; a `proposed` check is not due, even when the Assessment changed after it; an `unfinished` check with 1 attempt checked yesterday is due with `attempts: 2` and its `previous`; with 3 attempts it is not; one checked today is not; a `no_candidates` check from three days ago whose Assessment changed two days ago is due with `attempts: 1`, and the same for `none_picked`; a `no_candidates` check that came after the last change is not; no check gives `attempts: 1` and `previous: null`; 45 due rows give 40. `staleProposals` returns one 31 days old, one whose metric has an open Goal, one on a deleted Assessment and one whose Trainee has a newer live Assessment with no proposals of its own, and not a fresh one on the Trainee's newest Assessment.
- [ ] **Step 2: Run** (FAIL), **Step 3:** implement, **Step 4: Run** (PASS).
- [ ] **Step 5: Commit** `feat(weekly-report): goal candidates and due assessments`.

---

### Task 10: The proposal writer

**Files:**
- Create: `src/features/goal-proposals/lib/writer/guide.ts`, `writer/output.ts`, `writer/request.ts`, `writer/write.ts` (`import "server-only"`)
- Modify: `src/features/weekly-reports/lib/writer/output.ts` (`finishedText`), `src/features/weekly-reports/lib/writer/direct.ts` (`directReply`), `src/features/weekly-reports/lib/jobs/write-week.ts` (`runUntil` moves out), new `src/features/weekly-reports/lib/jobs/run-until.ts`
- Test: `src/features/goal-proposals/lib/writer/__tests__/output.test.ts`, `writer/__tests__/request.test.ts`; add `finishedText` cases to `src/features/weekly-reports/lib/writer/__tests__/output.test.ts`

**Interfaces:**
- Weekly report writer, refactored without a behavior change:
  - `output.ts` (pure): `finishedText(reply: WriterReply): { ok: true; text: string } | { ok: false; reason: string }`: the stop reason must be in `FINISHED` (else its value, or `no_stop_reason`), then a text block (else `unparsable`). `replyOutcome` uses it before `parseWriterOutput`.
  - `direct.ts`: `directReply(client: Anthropic, params: Anthropic.MessageCreateParamsNonStreaming): Promise<WriterReply>`: the beta call with `betas: ["server-side-fallback-2026-07-01"]` and `fallbacks: "default"`, read through `replyOf`; it throws on an API error. `writeDirect` becomes `replyOutcome(await directReply(client, writerParams(sheet, model)))` inside its existing try and `apiFailure`.
  - `jobs/run-until.ts`: `runUntil` exported unchanged; `write-week.ts` imports it.
- `guide.ts`: `GOAL_PROMPT_VERSION = "<date of writing>.1"` (bumped on every wording change) and `GOAL_GUIDE: string`, in Hebrew, no em or en dashes, no emojis. It says: you are the academy's coaching staff choosing Goals for the next 6 to 12 weeks after an Assessment; the candidates were computed by code (the player's value, the group's upper quartile as the bar, the share of the group the player is better than, a target and how it was set); choose up to 3, fewer when fewer fit, in order of importance; prefer `positionFit` "מתאים לעמדה", then a lower `betterThanPercent`; do not choose three of one kind (three sprints, three jumps), mix speed, power, agility and technique when the candidates allow; `metric_key` exactly as given; `reason` one Hebrew sentence for the coaches, up to 25 words, on why this Goal now, about the metric and not the player (no name, no gender forms), with no number that is not written in that candidate; no medical, injury, diet or weight words; `drill_ids` up to 3 of that candidate's `drills`, the ones that train the metric most directly, empty when it has none; never invent a metric, a number or a drill.
- `output.ts` (pure):
  - `ProposalPick = { metric_key: string; reason: string; drill_ids: string[] }`; `ProposalOutput = { picks: ProposalPick[] }`.
  - `PROPOSAL_JSON_SCHEMA`: `{ type: "object", additionalProperties: false, required: ["picks"], properties: { picks: { type: "array", items: { type: "object", additionalProperties: false, required: ["metric_key", "reason", "drill_ids"], properties: { metric_key: { type: "string", enum: [...GOAL_METRICS] }, reason: { type: "string" }, drill_ids: { type: "array", items: { type: "string" } } } } } } }`, `as const satisfies Record<string, unknown>`. The same schema in every request, so it is compiled once.
  - `proposalOutputSchema` (Zod, `z.strictObject`, the same shape) and `parseProposalOutput(text: string): ProposalOutput | null`.
  - `type ProposalOutcome = { ok: true; output: ProposalOutput; usage: unknown; model: string } | { ok: false; reason: string }` and `proposalOutcome(reply: WriterReply): ProposalOutcome` through `finishedText`.
- `request.ts` (pure but for the model setting): `proposalInput(player: { ageGroup: string | null; position: string | null }, candidates: readonly CandidateFacts[]): { player: ...; candidates: CandidateFacts[] }` and `proposalParams(input, model: WriterModel): Anthropic.MessageCreateParamsNonStreaming`:

```ts
{
  model,
  max_tokens: 16000,
  thinking: { type: "adaptive" },
  system: [{ type: "text", text: GOAL_GUIDE, cache_control: { type: "ephemeral" } }],
  messages: [{ role: "user", content: `המועמדים ליעדים אחרי המבדק:\n${JSON.stringify(input, null, 2)}` }],
  output_config: { effort: "medium", format: { type: "json_schema", schema: PROPOSAL_JSON_SCHEMA } },
}
```

  The guide is short and may fall under the minimum cacheable prefix; the breakpoint is harmless and keeps the shape of the report writer.
- `write.ts`: `writeProposal(client: Anthropic, input, model: WriterModel): Promise<ProposalOutcome>`: `proposalOutcome(await directReply(client, proposalParams(input, model)))`, any throw through `apiFailure("goal proposal", error)` to `{ ok: false, reason }`. Never throws.

- [ ] **Step 1: Write the failing tests:** `finishedText` refuses `refusal`, `max_tokens` and a null stop reason, refuses a missing text as `unparsable`, accepts `end_turn` with text; `parseProposalOutput` accepts a valid answer and refuses invalid JSON, a missing `picks`, an extra field and a pick without `reason`; `proposalOutcome` on a refusal is not ok even when its text parses; `proposalParams` has exactly the keys `model, max_tokens, thinking, system, messages, output_config`, `output_config` as above, the system text `GOAL_GUIDE`; `GOAL_GUIDE` names `metric_key`, `reason` and `drill_ids` and holds no em dash, en dash or emoji; `GOAL_PROMPT_VERSION` matches `^\d{4}-\d{2}-\d{2}\.\d+$`; the stringified `proposalInput` of a fixture holds no key named `id` outside `drills`.
- [ ] **Step 2: Run** (FAIL), **Step 3:** implement the pure files and the refactor, **Step 4: Run** (PASS, the weekly report writer's tests included).
- [ ] **Step 5:** Write `write.ts`. **Run** `npx tsc --noEmit`, `npm run lint`.
- [ ] **Step 6: Commit** `feat(weekly-report): the goal proposal writer`.

---

### Task 11: Guardrails on the model's picks

**Files:**
- Create: `src/features/goal-proposals/lib/guardrails.ts`
- Modify: `src/features/weekly-reports/lib/fact-sheet/allowed-numbers.ts` (export `allowedNumbersIn`)
- Test: `src/features/goal-proposals/lib/__tests__/guardrails.test.ts`; add a case to `src/features/weekly-reports/lib/fact-sheet/__tests__/allowed-numbers.test.ts`

**Interfaces (pure):**
- `allowed-numbers.ts`: `allowedNumbersIn(value: unknown): Set<string>`: `numbersOf(value)` as a set (fields named `id` skipped, as today). `allowedNumbers(sheet)` becomes `allowedNumbersIn({ ...sheet, drills: [] })` plus `sheet.drills.length`, the rule of Task 5a unchanged.
- `guardrails.ts`: `MAX_PICKS = 3`, `MAX_PICK_DRILLS = 3`, `REASON_MAX_WORDS = 25`.
  - `interface CheckedPick { candidate: CandidateFacts; rank: number; reason: string | null; drillIds: string[]; problems: HoldReason[] }`.
  - `checkPicks(candidates: readonly CandidateFacts[], output: ProposalOutput): { picks: CheckedPick[]; dropped: string[] }`: in the model's order, a pick of a metric that was not offered, a metric already picked, or a pick after the third is dropped (its reason in `dropped`, for the log). Each kept pick gets `rank` 1 to 3 and the drill ids that are among its candidate's drills, once each, at most 3, with `{ code: "drill", text: "נבחר תרגיל שלא הוצע" }` or `{ code: "drill", text: "נבחרו <n> תרגילים, מותר עד 3" }` when it had others. The reason is trimmed; it is kept only when it is not empty (`{ code: "length", text: "אין נימוק" }`), has no line break and at most 25 words (`{ code: "length", text: "הנימוק ארוך משורה אחת" }`), every number is in `allowedNumbersIn(<the candidate without drills>)` (`{ code: "number", text: "מספר שלא מופיע בנתונים: <n>" }`), it has no digits outside 0 to 9 (`foreignDigitsIn`), and `forbiddenIn` finds nothing (`{ code: "forbidden_word", text: "מילה אסורה: <phrase>" }`); otherwise it is `null` and the problems are recorded.

- [ ] **Step 1: Write the failing tests:** a pick of an unoffered metric, a repeated metric and a fourth pick are dropped and ranks run 1 to 3; an unoffered drill id is removed with its problem; four offered ids keep three with the count problem; a reason with "1.92" from the candidate passes, so does "1,92"; "12" when no 12 is in the candidate drops the reason with a `number` problem; a number that appears only in a drill's "למה" line drops it too; 26 words, a line break and an empty reason drop it with a `length` problem; "פציעה" drops it with a `forbidden_word` problem; Arabic-Indic digits drop it. `allowedNumbersIn({ id: "7", value: 2.05 })` holds "2.05" and not "7".
- [ ] **Step 2: Run** (FAIL), **Step 3:** implement, **Step 4: Run** (PASS).
- [ ] **Step 5: Commit** `feat(weekly-report): guardrails for goal proposals`.

---

### Task 12: Job loaders and rows

**Files:**
- Create: `src/features/goal-proposals/lib/queries/history.ts`, `queries/due.ts`, `queries/rows.ts` (each `import "server-only"`)

Service role. `Db` and `must` from `src/features/weekly-reports/lib/queries/read.ts`. Long id lists through `readInChunks`; whole-table reads through `readAllPages` ordered by `id`.

**Interfaces:**
- `history.ts`:
  - `GOAL_METRIC_SELECT`: `"id, user_id, assessment_date, created_at, "` plus the 18 metric columns.
  - `loadHistory(db, today): Promise<{ profiles: Map<string, ProfileAges & { position: string | null }>; rows: MetricRow[] }>`: `profiles` with `role = 'trainee'`, `deleted_at` null (`id, birthdate, position, age_group_override, age_group_override_until`); `player_assessments` with `deleted_at` null and `assessment_date` from `addDays(today, -HISTORY_DAYS)`, read past the 1000-row cap. `assessment_date` and `created_at` are nullable in the generated types: the `.gte` on the date already drops a null date (and the mapper drops one again, so the types narrow), and a null `created_at` becomes `""`, so it loses a same-date tie to a row that has one.
  - `loadTraineeContext(db, traineeIds, today): Promise<{ openGoals: Map<string, string[]>; rejected: Map<string, { metricKey: string; decidedOn: string }[]>; done: Map<string, Set<string>>; sensitive: Map<string, HoldReason[]> }>`: open Goals' metrics (`player_goals`, `achieved_at` null); `goal_proposals` rejected from `addDays(today, -REJECTED_QUIET_DAYS)` (`decidedOn = israelDateStr(decided_at)`); `readDrillsDone(db, ids, addDays(today, -29), today)`; and for Decision 24, `readShiftReports(db, range)` and `readTags(db, ids, range)` of the weekly report (`week-reads.ts`) over `range = { from: addDays(today, -(SENSITIVE_LOOKBACK_DAYS - 1)), to: today }`, through `sensitiveHoldsNow(reports, tags.get(id) ?? [], id)` (`weekly-reports/lib/sensitive-recheck.ts`): Trainee id to its `sensitive` Holds (texts only, never the entry's words).
- `due.ts`: `loadDue(db, traineeIds: readonly string[], today): Promise<DueItem[]>`: `player_assessments` of these Trainees (`id, user_id, assessment_date, created_at`, `deleted_at` null, dated from `addDays(today, -DUE_WINDOW_DAYS)`), their `player_rating_snapshots` (`assessment_id, computed_at`, `deleted_at` null) and `goal_proposal_checks` (`assessment_id, outcome, attempts, checked_at`) by `assessment_id`, through `dueAssessments`. Each `DueRow` is filled as in `loadHistory` (a null date left out, a null `created_at` as `""`), and `changedAt` is the snapshot's `computed_at`, else `created_at`, else the Assessment date at `T00:00:00Z` (a row with no stamp at all counts as changed on its own date).
- `rows.ts`:
  - `claimCheck(db, item: DueItem): Promise<boolean>`: with `previous` null, insert `{ assessment_id, trainee_id, outcome: "unfinished", attempts: 1 }`, and 23505 gives false; otherwise `update({ outcome: "unfinished", attempts: item.attempts, checked_at: now })` where `assessment_id` matches and `outcome` and `checked_at` equal `item.previous` (the values as read), and no row back gives false. One rule for a retry and for a re-check after the Assessment changed; two runs never both claim.
  - `finishCheck(db, assessmentId, values: { outcome: "proposed" | "no_candidates" | "none_picked"; model?: string; promptVersion?: string; usage?: unknown }): Promise<void>`. It leaves `checked_at` as the claim set it, so a change made while the run read the data is still after it and is looked at again.
  - `savedProposalCount(db, assessmentId): Promise<number>`: the `goal_proposals` rows of that Assessment, any status (`count: "exact", head: true`). Read after the claim, for `stepBeforeModel` (Task 13).
  - `saveProposals(db, input: { assessmentId; traineeId; branchIds: string[]; picks: CheckedPick[]; model; promptVersion }): Promise<number>`: first the Trainee's open proposals of other Assessments become `expired` with `decided_at` now (the open-per-metric index would refuse the new ones otherwise); then insert one row per pick (`metric_key`, `rank`, `baseline_value = candidate.value`, `target_value = candidate.target`, `facts = toJson(candidate)`, `reason`, `drill_ids`, `problems = toJson(problems)`) in one statement, with `upsert` `onConflict: "assessment_id,metric_key"` and `ignoreDuplicates: true` as a second guard. The first guard is `stepBeforeModel`: an Assessment that already has proposals never reaches the model again, so a retry after a crash never adds a second set with other metrics. Returns the count inserted.
  - `expireStale(db, today): Promise<number>`: every `proposed` row with its Assessment's `deleted_at` (`player_assessments!goal_proposals_assessment_id_fkey(deleted_at)`), the open Goals of their Trainees, and every live Assessment of those Trainees (`id, user_id, assessment_date, created_at`, by `readInChunks`, filled as in `loadHistory`) through `newestByTrainee`; then `staleProposals`; those ids become `expired` with `decided_at` now, only while still `proposed`.

- [ ] **Step 1:** Write the three files.
- [ ] **Step 2: Run** `npx tsc --noEmit`, `npm run lint`.
- [ ] **Step 3: Commit** `feat(weekly-report): goal proposal loaders and rows`.

---

### Task 13: The nightly job and its cron route

**Files:**
- Create: `src/features/goal-proposals/lib/step.ts` (pure), `src/features/goal-proposals/lib/jobs/propose.ts` (`import "server-only"`), `src/app/api/cron/goal-proposals/route.ts`
- Modify: `vercel.json`
- Test: `src/features/goal-proposals/lib/__tests__/step.test.ts`

**Interfaces:**
- `step.ts` (pure): what the job does with one claimed Assessment, so the decisions are tested and the job only reads and writes.
  - `type StepBefore = { kind: "finish"; outcome: "proposed" | "no_candidates" } | { kind: "ask" }`; `stepBeforeModel(input: { savedProposals: number; candidates: number }): StepBefore`: an Assessment that already has proposals (a run saved them and failed before finishing the check) is finished as `proposed` and never asked about again, whatever the candidates are now; else no candidate gives `no_candidates`; else `ask`.
  - `type StepAfter = { kind: "retry"; reason: string } | { kind: "finish"; outcome: "none_picked"; dropped: string[] } | { kind: "save"; picks: CheckedPick[]; dropped: string[] }`; `stepAfterModel(outcome: ProposalOutcome, candidates: readonly CandidateFacts[], sensitive: readonly HoldReason[]): StepAfter`: an outcome that is not ok is `retry` (the check stays `unfinished`); else `checkPicks`; no pick left is `none_picked`; else `save`, each pick's `problems` the Trainee's `sensitive` Holds first, then its own (Decision 24).
- `proposeGoals(db, today: string, deadline: number): Promise<ProposeResult | { skipped: string; expired: number }>`:
  1. `expireStale(db, today)` first: expiry needs neither a branch setting nor the model, so old proposals expire even while the key is unset or every branch is off.
  2. `loadReportSettings(db)`; no branch that is not off: `{ skipped: "no branch on", expired }`.
  3. `anthropicClient(JOB_LIMITS)`; null: log "ANTHROPIC_API_KEY is not set; no goal proposals are written" and return `{ skipped: "no ANTHROPIC_API_KEY", expired }`. Only the writing is skipped.
  4. `loadAudienceCandidates(db, onBranchIds)`, kept where `reportBranches(candidate, settings)` is not empty: Trainee id to branch ids.
  5. `loadDue(db, audienceIds, today)`; nothing due: return the counts.
  6. Once for the run: `loadHistory(db, today)`, `loadDrillPool(db)`, `loadTraineeContext(db, dueTraineeIds, today)`; then the pure `groupMetrics(...)` and `historyByGroup(...)`.
  7. `runUntil(due, 4, deadline, proposeOne)`, where `proposeOne`:
     - `claimCheck`; false: counted as `claimedElsewhere`.
     - The Assessment's row and the Trainee's profile from the history; the age group `resolveAgeGroup(profile, today)`; the book age group `deriveAgeGroup(profile.birthdate, <Assessment date at noon UTC>)`. No row, no profile or no age group gives no candidates.
     - `fits` from `metricPositionFit(pool, metric, { ageGroup: bookAgeGroup, position: profile.position })` per Goal metric; `exclude` from `excludedMetrics`; `findGaps`; `proposalCandidates` with drills from `drillCandidatesFor(pool, { metrics: [metric], ageGroup: bookAgeGroup, position, doneIds, limit: OFFERED_DRILLS_PER_GOAL })`, each with its parameter name.
     - `stepBeforeModel({ savedProposals: await savedProposalCount(db, id), candidates: candidates.length })`: `finish` gives `finishCheck` with that outcome and no request (a resumed `proposed` is counted as `resumed`); `ask` goes on.
     - `writeProposal(client, proposalInput({ ageGroup: group.label, position }, candidates), writerModel())`, then `stepAfterModel(outcome, candidates, context.sensitive.get(traineeId) ?? [])`: `retry` logs the reason and leaves the check `unfinished` (a later night retries); `finish` logs `dropped` and gives `finishCheck(none_picked)` with the usage; `save` logs `dropped`, runs `saveProposals(...)` with the Trainee's report branch ids, then `finishCheck(proposed)` with the model, `GOAL_PROMPT_VERSION` and usage.
     - One Assessment's failure is logged and never stops the others.
  8. `revalidatePath("/admin/weekly-reports")` in a try (logged on failure).
  9. Return `{ expired, due, proposed, resumed, noCandidates, nonePicked, failed, claimedElsewhere, notStarted }`.
- Route `GET /api/cron/goal-proposals`: `maxDuration = 300`; `PROPOSE_BUDGET_MS = 240_000`; the `CRON_SECRET` checks of `weekly-reports-write` (500 without the secret, 401 on a wrong header); no hour gate; `proposeGoals(createAdminClient(), israelToday(now), startedAt + PROPOSE_BUDGET_MS)`; a throw gives 500 "Run failed".
- `vercel.json`: `{ "path": "/api/cron/goal-proposals", "schedule": "15 4 * * *" }`.

- [ ] **Step 1: Write the failing tests** for `step.ts`: 2 saved proposals and 3 candidates give `finish` `proposed` (the model is not asked again); 0 saved and 0 candidates give `finish` `no_candidates`; 0 saved and 2 candidates give `ask`; an outcome that is not ok gives `retry` with its reason; an answer whose every pick is a metric that was not offered gives `none_picked` with the dropped list; a good answer gives `save` with ranks from 1, and with one `sensitive` Hold each pick's `problems` start with it, while with none they are `checkPicks`' own.
- [ ] **Step 2: Run** (FAIL), **Step 3:** implement `step.ts`, **Step 4: Run** (PASS).
- [ ] **Step 5:** Write the job, the route and the cron entry.
- [ ] **Step 6: Run** `npx tsc --noEmit`, `npm run lint`, `npm run build`.
- [ ] **Step 7:** Manual check with the user's agreement (it reads production, writes proposals and spends a little API credit), with only the pilot branch on and one test Assessment dated yesterday: `curl -H "Authorization: Bearer $CRON_SECRET" ".../api/cron/goal-proposals"` writes up to 3 proposals and a `proposed` check; a second call writes nothing; the stored targets equal the facts' targets; a reason the guardrails dropped shows its problem. Then set that check back to `unfinished` with `checked_at` a day earlier, by hand (the crash between saving and finishing, seen on the next night): the next call makes no model request, counts it as `resumed` and leaves the same proposals.
- [ ] **Step 8: Commit** `feat(weekly-report): nightly goal proposals job and cron`.

---

### Task 14: Staff actions

**Files:**
- Create: `src/lib/validations/goal-proposals.ts`, `src/features/goal-proposals/lib/accept-errors.ts`, `src/features/goal-proposals/lib/proposal-view.ts`, `src/features/goal-proposals/lib/queries/views.ts` (`import "server-only"`), `src/features/goal-proposals/lib/actions/proposal-action.ts` (`import "server-only"`), `actions/accept.ts`, `actions/reject.ts` (`"use server"`)
- Test: `src/lib/validations/__tests__/goal-proposals.test.ts`, `src/features/goal-proposals/lib/__tests__/accept-errors.test.ts`, `__tests__/proposal-view.test.ts`

**Interfaces:**
- `validations/goal-proposals.ts`: `proposalId` (`UUID_REGEX`, "מזהה הצעה לא תקין"), `version` as in `weekly-reports.ts` but required (no `.optional()`): a request without the version the screen showed is refused ("גרסה לא תקינה"), so a target staff never saw cannot be accepted; `acceptProposalSchema = { proposalId, version, target? }` with `target` a finite number above 0 ("היעד חייב להיות מספר חיובי"), at most 9999, at most 3 decimals ("עד 3 ספרות אחרי הנקודה"); `rejectProposalSchema = { proposalId, version, reason? }` with `reason` trimmed, at most 200 characters ("הסיבה ארוכה מדי (מקסימום 200 תווים)"), empty to null.
- `accept-errors.ts` (pure, as `staff-messages.ts` of the surveys): `acceptErrorMessage(error: { code?: string; message: string }): string`: `23505` gives "כבר קיים יעד פעיל למדד זה"; a message holding `proposal_changed` gives "ההצעה השתנתה, רעננו את הדף"; `proposal_not_found` gives "ההצעה לא נמצאה"; `not_a_trainee` gives "ניתן להגדיר יעדים רק לחניכים"; `assessment_deleted` gives "המבדק של ההצעה נמחק"; anything else "קבלת ההצעה נכשלה, נסו שוב".
- `proposal-view.ts` (pure):
  - `factsOf(value: unknown): CandidateFacts | null`: a stored `facts` checked before it is trusted, as `storedSheetOf` does.
  - `targetLine({ baseline, target, unit }): string`: "מ-2.1 ל-2.02 שניות".
  - `standingLine(facts): string`: "רף הקבוצה 1.92 שניות · טוב מ-30% מהקבוצה".
  - `ProposalView = { id; traineeId; fullName; branchNames: string[]; assessmentDate: string; metricKey: string; label: string; unit: string; lowerIsBetter: boolean; baseline: number; target: number; facts: CandidateFacts | null; reason: string | null; problems: HoldReason[]; drills: DrillCandidate[]; version: string }`.
  - `groupByTrainee(views: readonly ProposalView[]): { traineeId: string; fullName: string; branchNames: string[]; assessmentDate: string; proposals: ProposalView[] }[]`: by name (`byFullName`), proposals by rank.
- `views.ts`: `loadOpenProposals(db, query: { scopeBranchIds: readonly string[] | null; filterBranchId?: string }): Promise<ProposalView[]>`: `proposed` rows with their Assessment (`player_assessments!goal_proposals_assessment_id_fkey(assessment_date, deleted_at)`), a row whose Assessment is soft-deleted left out (it would only expire on the next nightly run); `.overlaps("branch_ids", scope)` unless Admin, `.contains("branch_ids", [filter])`, then the Trainees' current memberships in scope (the queue's `inTraineeScope`, moved from `queue.ts` to an exported `src/features/weekly-reports/lib/queries/scope.ts` and used by both); names, branch names, the Assessment date and drills (`readDrillsByIds`) joined. `loadTraineeProposals(db, traineeId, scopeBranchIds: readonly string[] | null): Promise<ProposalView[]>`: the Trainee's `proposed` rows, the same shape, under the same rules: soft-deleted Assessments left out and `.overlaps("branch_ids", scope)` unless Admin, so the card never shows a proposal that the tab hides and every action would refuse (a Trainee in branches A and B, a proposal with `branch_ids` [B], a Trainer of A).
- `proposal-action.ts`: `loadProposalForAction(db, proposalId, version: string): Promise<ActionProposal | { error: string }>`: the row; `isInBranchScope(scope, row.branch_ids)` else "ההצעה לא נמצאה"; `assertTraineeInScope(row.trainee_id)`; `Date.parse(version)` against `updated_at` else "ההצעה השתנתה, רעננו את הדף". `updateProposalIfUnchanged(db, proposal, values)`: `.eq("id").eq("status", "proposed").eq("updated_at", read)`; false when nothing changed. `revalidateProposals(traineeId)`: `/admin/weekly-reports`, `/admin/assessments/${traineeId}`, `/dashboard`, `/dashboard/assessments`.
- `acceptGoalProposalAction(input: AcceptProposalInput): Promise<{ success: true } | { error: string }>`: `verifyAdminOrTrainer()`; the schema; `loadProposalForAction`; not `proposed` gives "ההצעה כבר טופלה"; `target = input.target ?? row.target_value`; `goalRefusal({ metricKey, targetValue: target, baselineValue: row.baseline_value })`; `db.rpc("accept_goal_proposal", { p_proposal_id, p_expected_updated_at: row.updated_at, p_target: target, p_is_lower_better: isLowerBetterMetric(metric), p_actor: user.id })`; an error through `acceptErrorMessage`; `revalidateProposals`.
- `rejectGoalProposalAction(input: RejectProposalInput)`: the same checks; `updateProposalIfUnchanged` to `{ status: "rejected", decided_by, decided_at: now, reject_reason }`; false gives "ההצעה השתנתה, רעננו את הדף"; `revalidateProposals`.

- [ ] **Step 1: Write the failing tests:** the accept schema refuses a target of 0, of 1.2345 and of 10000, a malformed id and a missing version, and accepts no target; the reject schema refuses 201 characters and a missing version, and turns "  " into null; `acceptErrorMessage` maps each of the five codes, the raw `P0001: proposal_changed (CONTEXT: ...)` form, and an unknown message; `targetLine`, `standingLine` give the lines above; `factsOf` refuses a missing `target` and a non-object; `groupByTrainee` groups two Trainees by name with proposals by rank.
- [ ] **Step 2: Run** (FAIL), **Step 3:** implement the pure files, **Step 4: Run** (PASS).
- [ ] **Step 5:** Write the loaders, the helper and the two actions.
- [ ] **Step 6: Run** `npx tsc --noEmit`, `npm run lint`.
- [ ] **Step 7: Commit** `feat(weekly-report): accept, change and reject goal proposals`.

---

### Task 15a: Proposals in the Goals card

**Files:**
- Create: `src/features/goal-proposals/components/ProposalCard.tsx`, `ProposalList.tsx`, `ChangeTargetDialog.tsx`, `RejectProposalDialog.tsx`, `useProposalActions.ts` (client where interactive)
- Modify: `src/features/goals/components/GoalManagementPanel.tsx`, `src/features/goals/types/index.ts`, `src/app/admin/assessments/[userId]/page.tsx`

**What it shows:**
- `ProposalCard` (one proposal): the metric label in bold, `targetLine` ("מ-2.1 ל-2.02 שניות"), `standingLine`, the basis line in muted text, each `sensitive` problem as "שימו לב: <text>" in the warning color (Decision 24), the reason (or, when it was dropped, "הנימוק הוסר: <first problem that is not `sensitive`>" in muted text), the drills as a short list (name, and the "למה" line under it), and three buttons: "קבל" (accepts at once, with a toast "היעד נקבע"), "שנה יעד" (`ChangeTargetDialog`: a number field filled with the target, the unit, "כרגע: <baseline>" and "<direction>"; the client runs `goalRefusal` before sending and shows its text), "דחה" (`RejectProposalDialog`: an optional reason, "דחה הצעה"). Every action sends the proposal's `version`, shows a toast and calls `router.refresh()`; buttons are disabled while one runs.
- `ProposalList`: the heading "הצעות יעד" with the Assessment date ("לפי המבדק מ-<DD.MM>"), then a `ProposalCard` per proposal, `key={proposal.id}`.
- `GoalManagementPanel`: an optional `children?: React.ReactNode` (added to `GoalManagementPanelProps`) rendered first inside `CardContent`, above the open Goals.
- `/admin/assessments/[userId]/page.tsx`: `verifyAdminOrTrainer()`, `getBranchScopeAction()` and `isTraineeInScope(createAdminClient(), scope, userId)`; when in scope, `loadTraineeProposals(createAdminClient(), userId, scope)`; when any, `<GoalManagementPanel ...><ProposalList proposals={proposals} /></GoalManagementPanel>`. Nothing else on the page changes.

- [ ] **Step 1:** Write the components and the page change.
- [ ] **Step 2: Run** `npx tsc --noEmit`, `npm run lint`, `npm run build`.
- [ ] **Step 3:** Manual check at 320 px and 1440 px, on proposals made in Task 13, in the Goals card: "קבל" creates the Goal (it shows under "יעדים פעילים" and on the Trainee's dashboard) and the proposal leaves the card; "שנה יעד" with a target worse than the baseline is refused with the goal rule's text, and a better one creates the Goal and stores `changed`; "דחה" removes it; accepting in two tabs creates one Goal and the second tab gets "ההצעה השתנתה, רעננו את הדף"; after soft-deleting the proposal's Assessment the card no longer shows it, and a crafted accept gets "המבדק של ההצעה נמחק"; a Trainer of the other branch sees no proposal of this Trainee in the card, a Trainer of branch A sees no proposal whose `branch_ids` is only B, and the actions refuse a crafted id.
- [ ] **Step 4: Commit** `feat(weekly-report): goal proposals in the goals card`.

---

### Task 15b: The "הצעות יעד" tab of the queue

**Files:**
- Create: `src/features/goal-proposals/components/ProposalQueue.tsx`
- Modify: `src/features/weekly-reports/lib/queue-view.ts`, `src/features/weekly-reports/components/admin/QueueTabs.tsx`, `src/app/admin/weekly-reports/page.tsx`
- Test: update `src/features/weekly-reports/lib/__tests__/queue-view.test.ts`

**What it shows:**
- `queue-view.ts`: `QueueTab` adds `"proposals"`; `QUEUE_TABS` adds `{ tab: "proposals", label: "הצעות יעד" }` last; `tabCounts`' zero object adds `proposals: 0`; `tabOf` and `countsLine` are unchanged (proposals are not reports).
- `QueueTabs.tsx`: the comment says seven tabs.
- `/admin/weekly-reports/page.tsx`: `loadOpenProposals(db, { scopeBranchIds, filterBranchId: branch })` joins the `Promise.all`; `counts = { ...queue.counts, proposals: proposals.length }` feeds `pickTab` and `QueueTabs`; `EMPTY_TEXT.proposals = "אין הצעות יעד פתוחות"`; on the proposals tab the page renders, in place of `QueueTable`, the line "הצעות פתוחות מכל המבדקים, לא לפי שבוע" and `ProposalQueue`: a card per Trainee (`groupByTrainee`) with the name linking to `/admin/assessments/<traineeId>`, the branch names and the Assessment date, and its `ProposalCard`s (Task 15a).

- [ ] **Step 1: Update the failing tests** in `queue-view.test.ts`: `EMPTY` gains `proposals: 0`; the tabs run held, pending, approved, sent, missed you, absent, proposals with the label "הצעות יעד" last; `pickTab("proposals", counts)` gives `"proposals"`; `tabOf` never gives it.
- [ ] **Step 2: Run** (FAIL), **Step 3:** implement `queue-view.ts`, **Step 4: Run** (PASS).
- [ ] **Step 5:** Write `ProposalQueue` and the page changes.
- [ ] **Step 6: Run** `npx tsc --noEmit`, `npm run lint`, `npm run build`.
- [ ] **Step 7:** Manual check at 320 px and 1440 px: the tab lists the open proposals grouped by Trainee, each name links to the Trainee's page; accepting or rejecting in the tab removes the proposal from the tab and from the Goals card; the branch filter narrows the list; a Trainer of the other branch sees no proposal of this Trainee in the tab.
- [ ] **Step 8: Commit** `feat(weekly-report): goal proposals tab in the queue`.

---

### Task 16: Docs, verification and the pull request

**Files:**
- Modify: `CONTEXT.md` (under "Weekly report": **Goal proposal** (הצעת יעד): "A Goal the system suggests after an Assessment, with a target code set from the academy's own history and drills from the Development book, waiting for staff to accept, change or reject. _Avoid_: recommendation."), `CLAUDE.md` (a "### Goal proposals" section after "### Weekly report": the map table and its Admin page, the drill rules and where the Weekly report uses them, the gap and target rules with their numbers, the two tables and the checks (when an Assessment is due, the re-check of a `no_candidates` or `none_picked` Assessment staff changed later, and the limit that a `proposed` Assessment is never looked at again, so a later edit keeps its proposals' baseline), when proposals expire (a newer live Assessment, 30 days, an open Goal, a deleted Assessment), the cron and its time, the guardrails and the `sensitive` problem, the accept function and the shared `goalRefusal()`, the Goals card and the queue tab, and that automatic mode is step 4; and in "### Weekly report", replace "drill candidates (always empty until the metric-to-book map, so `drill_ids` stay empty and the parent page shows no drills)" with how drills are chosen now)

- [ ] **Step 1:** Write the docs.
- [ ] **Step 2: Run** `npm run test:run`, `npx tsc --noEmit`, `npm run lint`, and `npm run build` with the CI placeholder env. All clean.
- [ ] **Step 3:** Ask for a code review (`code-reviewer`) and a security review (`security-reviewer`: the service role in the job and the actions, scope in every loader and action, the SQL function's checks and grants, the map editor's Admin check, what reaches the model). Fix what they find.
- [ ] **Step 4:** Push the branch and open the PR, with a test plan that lists the manual checks of Tasks 5b, 5c, 6, 13, 15a and 15b and the list below.
- [ ] **Step 5: Commit** `docs(weekly-report): goal proposals notes for agents and the glossary`.

## Before staff rely on it (not code)

- Staff go through `/admin/book/metrics` once and correct the seeded draft, especially Blaze, the agility tests and kick power for positions the book does not list yet (no parameter names GK, CB, CDM, CM or CAM today).
- The goalkeeper parameter is hidden from every Trainee with a position (`is_all_positions` false, no positions). Until staff give it GK, a goalkeeper gets none of its drills; it is not in the draft map for that reason.
- After the first two weeks, look at `goal_proposal_checks` (`no_candidates` share, usage) and at how often proposals end `changed` or with a dropped reason, before step 4 takes it further.
