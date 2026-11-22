# Course Access by Training Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Only trainees who train now (or bought the digital course, or an admin marked active) may open a course, with a 7-day grace period and a nightly sweep that never locks anyone on a bad night.

**Architecture:** Two new profile dates (last seen training, admin mark) and a sweep log table. A nightly step of `/api/cron/arbox-sync` stamps "seen training" from three Arbox reports and the app Plan queues; fulfillment stamps a sale at once. One pure rule, `canOpenCourse()`, decides for every gate (course pages, video URLs, progress writes, the menu), comparing the stamp with the last good sweep, not with today.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Supabase (Postgres, RLS, service role), Vitest.

**Spec:** `docs/superpowers/specs/2026-11-22-course-access-and-management-design.md` (section "1. Who may open a course"). This is PR 2 of the spec's order of work. PR 3 (course management) is `docs/superpowers/plans/2026-11-22-course-management.md` and builds on this one.

## Global Constraints

- Grace period: 7 days (`COURSE_ACTIVE_GRACE_DAYS = 7`), counted back from the day of the last good sweep, inclusive.
- Admin mark: a required last day, from today to 365 days ahead (`MAX_MARK_DAYS = 365`), inclusive; ending it sets null.
- Days are Israel days as `YYYY-MM-DD` strings: `israelDateStr(new Date())` from `src/lib/utils/israel-time.ts`, `addDays()` from `src/lib/utils/iso-date.ts`.
- Digital course buyers exception: `DIGITAL_COURSE_SLUG = "eden-player-development"` with `profiles.arbox_bought_course`.
- Locked copy, verbatim: `"הקורס פתוח למתאמנים פעילים"`.
- New profile columns are written only by server code with the service role and are added to `enforce_profile_column_guard()` in the same migration.
- New activity action: `course_access_mark_changed`, added to the `activity_logs_action_check` in the same migration and to `ACTIVITY_ACTION_LABELS_HE`.
- Migration timestamp must be unique. After it is pushed, run `npm run db:types`; never edit `src/types/database.generated.ts` by hand.
- The migration must be live in production before any preview or deploy of this code: previews use the production database and `getCourseViewer()` selects the new columns.
- All UI text Hebrew, RTL, logical CSS properties, no emojis.
- `arbox_paid_training`, `access_override` and the course-only tier keep their meaning; this plan does not touch them.

## Review Focus

1. **A bad Arbox night.** Arbox returns nothing or far less than last time: nothing is stamped, no sweep is recorded, and nobody's access changes. Tests: `isBelievableSweep` in Task 3.
2. **No good sweep yet** (the day of deploy): the old behaviour holds, the digital course open to every trainee and the tactical course to `is_active` trainees. Test: "falls back to the old rule before the first good sweep" in Task 2.
3. **Boundaries are inclusive.** Seen exactly 7 days before the last good sweep still opens; 8 days does not. A mark ending today opens today; one that ended yesterday does not. Tests in Task 2.
4. **A sale today with an old last sweep.** A trainee stamped today by fulfillment opens courses even if the last good sweep was 10 days ago. Test in Task 2.
5. **Stamps never move backwards.** A trainee already stamped today or later is not rewritten, and a run on an earlier day never lowers a stamp. Test in Task 3.

---

### Task 1: Migration, types and the activity action

**Files:**
- Create: `supabase/migrations/20261122120000_course_access_by_training.sql`
- Modify: `src/types/activity-log.ts` (add the label)
- Regenerate: `src/types/database.generated.ts` (`npm run db:types`, after the push)
- Test: `src/types/__tests__/activity-log-actions.test.ts` (existing drift test, unchanged)

**Interfaces:**
- Produces: `profiles.course_seen_training_on date null`, `profiles.course_access_until date null`; table `public.course_access_sweeps (swept_on date primary key, arbox_ids integer not null, plan_trainees integer not null, stamped integer not null, created_at timestamptz not null default now())`; activity action `course_access_mark_changed`.

- [ ] **Step 1: Write the migration.** Add the two profile columns; create `course_access_sweeps` with RLS enabled, no policies, and `REVOKE ALL ... FROM anon, authenticated`; `CREATE OR REPLACE FUNCTION public.enforce_profile_column_guard()` copied from the newest definition (`supabase/migrations/20261116085729_weekly_report_inputs_column_guard.sql`) with two more `IF NEW.<col> IS DISTINCT FROM OLD.<col> THEN RAISE EXCEPTION` blocks for the new columns; drop and re-add `activity_logs_action_check` with the full list from `20261012150000_profiles_plays_up.sql` plus `'course_access_mark_changed'`. Before writing, run `npm run db:schema` and diff the guard function and the action check against `supabase/schema.sql`; where production differs from the migration files, copy production.

- [ ] **Step 2: Add the label.** In `ACTIVITY_ACTION_LABELS_HE` add `course_access_mark_changed: "סימון גישה לקורסים"`.

- [ ] **Step 3: Run the drift test.**
Run: `npm run test:run -- src/types/__tests__/activity-log-actions.test.ts`
Expected: PASS.

- [ ] **Step 4: Push and regenerate (with Itay's go-ahead).**
Run: `supabase db push`, then `npm run db:types`, then `npx tsc --noEmit`.
Expected: the generated types gain the two columns and the table; tsc passes.

- [ ] **Step 5: Commit** `feat(course): columns and sweep log for course access by training`.

### Task 2: The pure access rule

**Files:**
- Modify: `src/features/course/lib/course-access-rule.ts`
- Test: `src/features/course/lib/__tests__/course-access-rule.test.ts` (rewrite for the new signature)

**Interfaces:**
- Produces:
  ```ts
  export const COURSE_ACTIVE_GRACE_DAYS = 7;
  export const COURSE_ACCESS_DENIED = "הקורס פתוח למתאמנים פעילים";
  export interface CourseViewer {
    readonly role: string | null;
    readonly isActive: boolean;          // profiles.is_active, used only before the first good sweep
    readonly seenTrainingOn: string | null;
    readonly accessUntil: string | null;
    readonly boughtCourse: boolean;      // profiles.arbox_bought_course
  }
  export interface CourseAccessContext {
    readonly today: string;
    readonly lastGoodSweepOn: string | null;
  }
  export function isTrainingNow(viewer: CourseViewer, ctx: CourseAccessContext): boolean;
  export function canOpenCourse(
    course: { readonly slug: string; readonly activeOnly: boolean },
    viewer: CourseViewer,
    ctx: CourseAccessContext,
  ): boolean;
  ```

- [ ] **Step 1: Write the failing tests.** With `ctx = { today: "2026-12-01", lastGoodSweepOn: "2026-11-30" }`, a trainee `base = { role: "trainee", isActive: true, seenTrainingOn: null, accessUntil: null, boughtCourse: false }`, `digital = { slug: "eden-player-development", activeOnly: false }`, `tactical = { slug: "tactical", activeOnly: true }`:
  - `"staff always open"`: roles `"admin"` and `"trainer"` with nothing else set open both courses.
  - `"opens when seen within the grace period"`: `seenTrainingOn: "2026-11-23"` (7 days before the sweep) opens `tactical`.
  - `"locks when seen 8 days before the last good sweep"`: `seenTrainingOn: "2026-11-22"` does not open `tactical` or `digital`.
  - `"a sale today opens with an old sweep"`: `ctx.lastGoodSweepOn = "2026-11-20"`, `seenTrainingOn: "2026-12-01"` opens.
  - `"an admin mark ending today opens"`: `accessUntil: "2026-12-01"` opens; `"2026-11-30"` does not.
  - `"digital course buyers keep the digital course only"`: `boughtCourse: true` opens `digital`, not `tactical`.
  - `"a viewer with no role opens nothing"`: `role: null` opens neither course.
  - `"falls back to the old rule before the first good sweep"`: `lastGoodSweepOn: null`: trainee with nothing seen opens `digital`; opens `tactical` only with `isActive: true`.

- [ ] **Step 2: Run them.**
Run: `npm run test:run -- src/features/course/lib/__tests__/course-access-rule.test.ts`
Expected: FAIL (old signature).

- [ ] **Step 3: Implement.** `isTrainingNow`: mark `accessUntil >= today`, or `seenTrainingOn >= addDays(lastGoodSweepOn, -COURSE_ACTIVE_GRACE_DAYS)` when `lastGoodSweepOn` is set. `canOpenCourse`: staff true; before the first good sweep the old rule (`!activeOnly || (role === "trainee" && isActive)`); otherwise a trainee who `isTrainingNow`, or the digital course with `boughtCourse`. Keep the file pure (no imports beyond `addDays` and `DIGITAL_COURSE_SLUG`).

- [ ] **Step 4: Run them.** Expected: PASS. (Callers fail to compile until Task 4; that is expected inside this task.)

- [ ] **Step 5: Commit** `feat(course): one access rule from training, mark and buyers`.

### Task 3: Pure sweep rules

**Files:**
- Create: `src/lib/course-access/activity.ts`
- Test: `src/lib/course-access/__tests__/activity.test.ts`

**Interfaces:**
- Consumes: `PlanQueueView` from `src/features/plans/lib/queries.ts` (type only).
- Produces:
  ```ts
  export const MIN_SWEEP_SHARE = 0.5;
  export interface ActivityProfile { readonly id: string; readonly arboxUserId: number | null; readonly seenOn: string | null }
  export function queueIsTraining(view: PlanQueueView | undefined): boolean;
  export function isBelievableSweep(arboxIds: number, lastGoodArboxIds: number | null): boolean;
  export function planActivityStamps(input: {
    readonly profiles: readonly ActivityProfile[];
    readonly arboxTrainingIds: ReadonlySet<number>;
    readonly planTrainingIds: ReadonlySet<string>;
    readonly today: string;
  }): string[];   // profile ids to stamp with today
  ```

- [ ] **Step 1: Write the failing tests.**
  - `isBelievableSweep(0, null)` false; `(1, null)` true; `(249, 500)` false; `(250, 500)` true; `(600, 500)` true.
  - `planActivityStamps`: a profile whose `arboxUserId` is in `arboxTrainingIds` is stamped; a profile in `planTrainingIds` with no Arbox link is stamped; a profile in neither is not; a profile already `seenOn: today` is not; a profile with `seenOn` after `today` (a later run already stamped) is not.
  - `queueIsTraining`: `undefined` false; a view with a current Plan true; only queued Plans true; nothing ahead but `frozen` set true; nothing ahead and not frozen false. Build the views with the smallest object literals the type allows (cast through `unknown` where only `queue.current`, `queue.queued`, `queue.frozen` are read).

- [ ] **Step 2: Run them.** Run: `npm run test:run -- src/lib/course-access/__tests__/activity.test.ts`. Expected: FAIL (module missing).

- [ ] **Step 3: Implement** the three functions. `isBelievableSweep`: `arboxIds > 0 && (lastGood === null || arboxIds >= Math.ceil(lastGood * MIN_SWEEP_SHARE))`.

- [ ] **Step 4: Run them.** Expected: PASS.

- [ ] **Step 5: Commit** `feat(course): pure rules for the training sweep`.

### Task 4: Wire the rule into every gate

**Files:**
- Create: `src/features/course/lib/course-access-context.ts` (`import "server-only"`)
- Modify: `src/features/course/lib/actions/course-read.ts` (`getCourseViewer`)
- Modify: `src/features/course/lib/load-course.ts`
- Modify: `src/features/course/lib/actions/course-playback.ts`
- Modify: `src/features/course/lib/actions/course-progress.ts` (`readLessonWithProgress`, `updateLessonProgress`, `markLessonComplete`)
- Modify: `src/app/dashboard/layout.tsx` (tactical capability)

**Interfaces:**
- Consumes: Task 2's `canOpenCourse`, `CourseViewer`, `CourseAccessContext`.
- Produces: `export const getCourseAccessContext: () => Promise<CourseAccessContext>` (React `cache()`; `today = israelDateStr(new Date())`; `lastGoodSweepOn` = newest `swept_on` in `course_access_sweeps` read with the service role, null on none; on a read error log and return `lastGoodSweepOn: null`, which falls back to the old rule). `getCourseViewer()` returns the full `CourseViewer` (selects `role, is_active, course_seen_training_on, course_access_until, arbox_bought_course`). `loadCourseForViewer(slug)` keeps its return shape and adds `canAskParent: boolean` (Task 7 fills it; return `false` here).

- [ ] **Step 1: Context and viewer.** Implement `getCourseAccessContext` and extend `getCourseViewer`; a missing profile returns every field null or false.
- [ ] **Step 2: Pages.** `loadCourseForViewer` calls `canOpenCourse({ slug: course.slug, activeOnly: course.activeOnly }, viewer, ctx)`.
- [ ] **Step 3: Video URLs.** In `getLessonPlaybackUrl` select `chapter:course_chapters!inner(course:courses!inner(slug, active_only))` and gate every course (not only active-only ones); refuse with `COURSE_ACCESS_DENIED`.
- [ ] **Step 4: Progress writes.** Extend `readLessonWithProgress` to return the lesson's course `slug` and `active_only` the same way; `updateLessonProgress` and `markLessonComplete` return `{ success: false, completed: false, error: COURSE_ACCESS_DENIED }` (match each function's result type) when the viewer may not open it. Existing progress rows are never touched.
- [ ] **Step 5: Menu.** In the layout, `canTacticalCourse` uses `canOpenCourse({ slug: TACTICAL_COURSE_SLUG, activeOnly: true }, viewer, ctx)` with the viewer built from the profile the layout already reads (add the three columns to its select). PR 3 replaces this capability; keep the change minimal.
- [ ] **Step 6: Verify.** Run: `npx tsc --noEmit && npm run lint && npm run test:run`. Expected: no errors, all tests pass.
- [ ] **Step 7: Commit** `feat(course): gate pages, videos and progress by training`.

### Task 5: The nightly sweep, its cron step and the dry run

**Files:**
- Modify: `src/lib/arbox/access.ts` (export the row classifier)
- Create: `src/lib/arbox/training-now.ts`
- Create: `src/lib/course-access/sync-activity.ts`
- Modify: `src/app/api/cron/arbox-sync/route.ts`
- Create: `scripts/course-activity-sync.ts`
- Modify: `src/lib/arbox/sync-access.ts` (stamp in chunks)

**Interfaces:**
- Consumes: Task 3's `planActivityStamps`, `isBelievableSweep`, `queueIsTraining`; `loadPlanQueues(db, ids, today)`; `readAllPages`, `chunk` from `src/lib/supabase/in-chunks.ts`; `fetchArboxReport`.
- Produces:
  ```ts
  // training-now.ts
  export interface TrainingNow { ids: Set<number>; rows: { memberships: number; cards: number; onHold: number } }
  export async function fetchTrainingNowUserIds(): Promise<TrainingNow>;
  // sync-activity.ts
  export interface ActivitySweepResult {
    good: boolean; reason: string | null;
    rows: TrainingNow["rows"]; arboxIds: number; planTrainees: number; stamped: number;
    wouldLock: { id: string; fullName: string; branches: string[]; linkedToArbox: boolean }[];
  }
  export async function syncCourseActivity(opts: { dryRun: boolean; today?: string }): Promise<ActivitySweepResult>;
  export async function stampSeenTraining(db: SupabaseClient, profileId: string, today: string): Promise<void>;
  ```

- [ ] **Step 1: Arbox read.** In `access.ts` export `isTrainingMembership(row: MembershipRow, products: ProductTypes): boolean` (the body of `consider()` today) and have `fetchPaidTrainingUserIds` use it. In `training-now.ts` read `activeMembershipsReport` (classified by `isTrainingMembership`), `sessionsReport` (every row with a user id: a live card, whatever its sessions left) and `membersOnHoldReport` (every row with a user id). The on-hold report name is unconfirmed: the dry run in Step 5 prints its row count; if Arbox refuses the name, find the right one in `docs/arbox-api/endpoints-reports.md` (listed there as `membersOnHold`).
- [ ] **Step 2: The sweep.** `syncCourseActivity`: read Arbox; read every `trainee_plans.profile_id` (paged, ordered by `id`, de-duplicated), load their queues with `loadPlanQueues` 200 ids at a time and keep those where `queueIsTraining`; read every live trainee profile (`role = trainee`, `deleted_at is null`: `id, full_name, arbox_user_id, course_seen_training_on, course_access_until`, paged by `id`); read the newest sweep row. If any read throws, return `good: false` with the reason and write nothing. If `!isBelievableSweep(ids.size, last?.arbox_ids ?? null)`, return `good: false, reason: "arbox_rows_too_few"` and write nothing. Otherwise (and not `dryRun`) set `course_seen_training_on = today` for the stamped ids 200 at a time with `.in("id", slice)`, then upsert the sweep row for `today`. `wouldLock` lists live trainees for whom `isTrainingNow` is false with the projected stamps and `lastGoodSweepOn = today`, with their branch names (`loadBranchIdsByProfile` plus `branches.name`) and whether `arbox_user_id` is set; compute it on every run, it is what the dry run prints.
- [ ] **Step 3: Fulfillment helper.** `stampSeenTraining` updates `course_seen_training_on = today` for one profile only when it is null or earlier (`.or("course_seen_training_on.is.null,course_seen_training_on.lt.<today>")`); it logs errors and never throws.
- [ ] **Step 4: Cron step.** In `arbox-sync/route.ts` run `syncCourseActivity({ dryRun: false })` after the access step, in its own try/catch like that step, and add its result (without `wouldLock`, only its length) to the response JSON as `activity`.
- [ ] **Step 5: Dry-run script.** `scripts/course-activity-sync.ts` loads env like `scripts/import-arbox-purchases.ts` does, runs `syncCourseActivity({ dryRun: !process.argv.includes("--apply") })` and prints the row counts per report, `arboxIds`, `planTrainees`, how many would be stamped, and the `wouldLock` list grouped by branch with an "Arbox link: yes/no" column. Run: `npx tsx scripts/course-activity-sync.ts`. Expected: three non-zero-or-explained report counts, a `good: true` result, and a locked list to show Itay. Do not run `--apply` without Itay.
- [ ] **Step 6: Fix the access sync's stamp size.** In `src/lib/arbox/sync-access.ts`, the `arbox_access_synced_at` stamp sends up to 1000 ids in one `.in("id", batch)`, past the gateway's ~640-uuid URL cap once linked profiles grow. Send it with `chunk(toStamp)` (200 per request) from `src/lib/supabase/in-chunks.ts`, keeping the log-and-stop on error.
- [ ] **Step 7: Verify.** Run: `npx tsc --noEmit && npm run lint && npm run test:run`. Expected: clean.
- [ ] **Step 8: Commit** `feat(course): nightly training sweep with dry run`.

### Task 6: Stamp a sale at once

**Files:**
- Modify: `src/features/enrollment/lib/fulfillment.ts`

**Interfaces:**
- Consumes: Task 5's `stampSeenTraining(db, profileId, today)`.

- [ ] **Step 1: Call it** right after the `trainee_plans` insert succeeds, with the same `today` the function already uses, before the agreement patch. A failure must not fail fulfillment (the helper already swallows it).
- [ ] **Step 2: Verify.** Run: `npx tsc --noEmit && npm run test:run -- src/features/enrollment`. Expected: PASS.
- [ ] **Step 3: Commit** `feat(course): a new Plan counts as training the same day`.

### Task 7: The locked view

**Files:**
- Create: `src/features/course/components/trainee/CourseLockedNotice.tsx`
- Modify: `src/features/course/lib/load-course.ts` (`canAskParent`)
- Modify: `src/features/course/components/trainee/CourseHomePage.tsx`, `CourseLessonPage.tsx`

**Interfaces:**
- Consumes: `canAskParentToBuy(db, profileId)` (`src/features/plans/lib/can-ask-parent.ts`), `PurchaseRequestButton` with `label={REQUEST_LABELS.renew}` (`src/features/plans/components/PurchaseRequestButton.tsx`).
- Produces: `CourseLockedNotice({ titleHe, descriptionHe, canAskParent }: { titleHe: string; descriptionHe: string | null; canAskParent: boolean })`.

- [ ] **Step 1:** `loadCourseForViewer` computes `canAskParent` only when the viewer is a trainee and may not open the course (service-role client, the viewer's user id).
- [ ] **Step 2:** `CourseLockedNotice` shows the course title and description in the course's existing header style, then `COURSE_ACCESS_DENIED`, then the purchase button when `canAskParent`. Both course pages render it in place of `<CourseNotice />` when `!canOpen`.
- [ ] **Step 3: Verify** `npx tsc --noEmit && npm run lint`. Expected: clean.
- [ ] **Step 4: Commit** `feat(course): locked course view with the buy button`.

### Task 8: Admin mark

**Files:**
- Create: `src/lib/course-access/mark.ts`
- Test: `src/lib/course-access/__tests__/mark.test.ts`
- Create: `src/lib/actions/admin-course-access-mark.ts`
- Create: `src/components/admin/users/CourseAccessCard.tsx`
- Modify: `src/app/admin/users/[userId]/page.tsx`

**Interfaces:**
- Consumes: Task 2's `isTrainingNow`, Task 4's `getCourseAccessContext`.
- Produces:
  ```ts
  export const MAX_MARK_DAYS = 365;
  export function markProblem(until: string, today: string): string | null;
  export async function setCourseAccessMark(userId: string, until: string | null): Promise<{ success: true } | { error: string }>;
  ```

- [ ] **Step 1: Write the failing tests** with `today = "2026-12-01"`: `markProblem("2026-12-01", today)` null; `markProblem("2027-12-01", today)` null (365 days); `markProblem("2027-12-02", today)` `"עד שנה קדימה"`; `markProblem("2026-11-30", today)` `"התאריך כבר עבר"`; `markProblem("2026-02-30", today)` `"תאריך לא תקין"` (use `isValidDateString` from `src/lib/validations/common.ts`).
- [ ] **Step 2: Run them.** Expected: FAIL. **Step 3: Implement `markProblem`.** **Step 4: Run them.** Expected: PASS.
- [ ] **Step 5: The action.** `verifyAdmin()`; `isValidUUID(userId)`; read the profile with the service role, refuse a non-trainee (`"גישה לקורסים נקבעת רק למתאמנים"`); `markProblem` when `until` is set; update `course_access_until`; insert `activity_logs` with `action: "course_access_mark_changed"` and `changes: [{ field: "course_access_until", old_value, new_value }]` (best-effort, like `src/lib/actions/admin-age-group-override.ts`); `revalidatePath(\`/admin/users/${userId}\`)`.
- [ ] **Step 6: The card.** `CourseAccessCard({ userId, seenTrainingOn, accessUntil, trainingNow, today })`, a client component next to `AccessTierCard` (admins, trainees only). It states one of: "פעיל: נראה מתאמן ב-<date>", "מסומן פעיל עד <date>", "לא פעיל: אין מנוי, כרטיסייה או מסלול פעילים"; a date input (min today, max today plus 365) with "סמן כפעיל עד" and, when a mark exists, "סיים סימון". The page computes `trainingNow` with `isTrainingNow` and `getCourseAccessContext()`, and passes the two dates from the profile it already reads.
- [ ] **Step 7: Verify.** Run: `npx tsc --noEmit && npm run lint && npm run test:run`. Expected: clean.
- [ ] **Step 8: Commit** `feat(course): admins mark a trainee active for courses`.

### Task 9: Docs, review and rollout

**Files:**
- Modify: `CLAUDE.md` (a short "Course access" paragraph: the rule, the sweep, the mark, the files)

- [ ] **Step 1:** Write the CLAUDE.md paragraph.
- [ ] **Step 2: Review.** Run the project's `code-reviewer` and `security-reviewer` agents on the branch diff; fix CRITICAL and HIGH findings.
- [ ] **Step 3: Rollout with Itay.** Push the migration (Task 1) before opening the PR. Run the dry run, show Itay the locked count and list, let staff mark the trainees who train. Only then merge; the first nightly run records the first good sweep and switches the rule on.
- [ ] **Step 4: Commit** `docs(course): course access by training`.
