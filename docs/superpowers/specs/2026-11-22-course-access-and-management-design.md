# Course access and self-serve course management

Date: 2026-11-22. Status: decided with Itay, not built (part 2 is built on a branch).

## Why

The owner asked for three things about the courses:

1. People who no longer train should not watch the courses.
2. Staff should see how many trainees watched each lesson, and who.
3. A new course, a mental-training one, next to the tactical course.

Itay added a fourth: the owner should create and manage courses (courses, chapters, lessons, names, videos) without us, so a new course never needs a developer. Today every course is a page and a menu entry written in code.

## Goals

- One rule for who may open a course: the trainee trains here now. Staff always may. The digital course also stays open to whoever bought it in Arbox.
- A trainee who stops training keeps 7 days of access, so a renewal gap does not lock anyone out.
- Staff see per-lesson counts (started, watched to the end) with names.
- An admin creates a course and its chapters and lessons in `/admin/course`, and it appears to trainees without a deploy.
- Trainees reach every course from one "קורסים" menu entry.

## Non-goals

- No per-course access setting. Every course follows the one rule; the buyers exception belongs to the digital course alone.
- No badges for courses other than the digital course.
- No video compression on upload. Admin uploads are stored as they are.
- No per-lesson CSV export.
- No course editing for Branch managers or trainers. Admins only, as today.

## Anti-goals

These would make it a failure even if it works:

- A trainee who trains and pays is locked out by a failed Arbox read or a sale made today. A missing Arbox link is fixed by an admin mark, which staff set from the dry run's list before the switch.
- A trainee loses progress. A lock hides a course; it never deletes anything.
- Links trainees already have stop working (`/dashboard/course/...`, `/dashboard/tactical-course/...`).
- Someone who bought the digital course loses it.

## How it works today

Facts the builder needs, checked 2026-11-22.

**Tables.** `courses` (`slug`, `title_he`, `description_he`, `cover_url`, `is_published`, `needs_title`, `order_index`, `active_only`), `course_chapters` (`title_he`, `subtitle_he`, `order_index`, `slug`), `course_lessons` (video paths, `duration_sec`, `is_published`, `order_index`, `slug`) and `course_lesson_progress` (one row per trainee and lesson: `watched_sec`, `completed_at`). Deleting a lesson cascades its progress rows. CHECK constraints stop publishing a placeholder title or a lesson without a video.

**Who may open a course.** `canOpenCourse()` (`src/features/course/lib/course-access-rule.ts`): staff always; a course with `active_only` (the tactical course) only for a trainee with `profiles.is_active`. The digital course is open to every trainee. `is_active` does not mean "trains now": the nightly Arbox sync creates an account for every Arbox client who ever had a phone, all active. Only 10 of 694 live trainees are marked inactive. The rule is applied by the course pages (`loadCourseForViewer()`), the signed video URL action (`course-playback.ts`) and the dashboard layout (menu).

**The Arbox access sync.** The `syncCourseAccess()` step of `/api/cron/arbox-sync` (`src/lib/arbox/sync-access.ts`, reads in `src/lib/arbox/access.ts`) writes `arbox_paid_training` (ever paid for training, monotonic on purpose), `arbox_bought_course` and `arbox_access_synced_at`. It already reads Arbox's `activeMembershipsReport`, and it classifies rows by type: `plan` and `session` are training, `item` and `trial` are not, and an unknown product name counts as training. The course-only tier (`resolveAccessTier()`, `src/lib/access/course-access.ts`, enforced in the middleware) keeps someone who bought only the course inside `/dashboard/course`, profile and settings.

**Production numbers (2026-11-22):** 694 live trainees; 531 linked to Arbox, 163 not linked (85 of those have an app Plan); 187 with a live app Plan; 16 trainees watched a lesson in the last 30 days; **0 profiles flagged `arbox_bought_course`**. Either nobody has bought the course item or the sync does not find the sales (it matches the item name "קורס דיגיטלי"). Check this before telling the owner buyers are covered.

**Trainee routes.** `/dashboard/course` serves the digital course (`DIGITAL_COURSE_SLUG = "eden-player-development"`) and is also `COURSE_ONLY_HOME`; `/dashboard/tactical-course` serves `TACTICAL_COURSE_SLUG = "tactical"`. Both are pages over `CourseHomePage` / `CourseLessonPage` with a `basePath`. The menu (`src/lib/navigation/dashboard-nav.ts`) has one entry per course; the tactical entry needs the `tacticalCourse` capability, worked out in `src/app/dashboard/layout.tsx` by reading that course by slug. The survey popup skips lesson pages through `MID_ACTIVITY_PATHS` in `src/features/surveys/lib/offer.ts`, which names both routes. `revalidateCourse()` in `admin-course.ts` revalidates `/dashboard/course` only. Badges are the digital course's (`courseEarnsBadges()`).

**The course admin.** `/admin/course` (admins; trainers see only the progress link) can rename a course, chapter or lesson, publish a lesson or course, reorder chapters and lessons, add a lesson, upload or replace its video (straight from the browser to the private `course-videos` bucket, up to 2 GB) and delete a lesson. It cannot create a course, create or delete a chapter, or edit a course's description or cover. Both existing courses were created by migration or seed script.

## Approaches considered

**Who is active.**

1. Ask Arbox at read time. Rejected: an Arbox call on every page, slow, and down whenever Arbox is.
2. Store an "active" yes/no each night. Rejected: no grace period, one bad night flips everyone, and a sale made today waits for the night.
3. **Chosen:** store the last day each trainee was seen training, stamped by the nightly sweep and at once when the app sells a Plan. Active means seen within 7 days of the last good sweep. The grace period falls out of it, a failed sweep cannot expire anyone, and a sale counts the same day.

**Trainee routes.**

1. Keep a page and a menu entry per course in code. Rejected: every course needs a developer, which is what Itay wants to end.
2. One menu entry per course, generated from data. Rejected: with three or more courses the menu and the phone's bottom bar get crowded.
3. **Chosen:** one data-driven route, `/dashboard/courses/[courseSlug]/...`, a `/dashboard/courses` page of course cards, and one "קורסים" menu entry. The old addresses redirect.

## Design

### 1. Who may open a course

One pure rule, used by every place that decides today (course pages, the video URL action, progress writes, the menu and the course list):

- Admins and trainers: always.
- A trainee: **active now**, or the course is the digital course and `arbox_bought_course` is set.

**Active now** is either of:

- **Seen training lately.** A new profile column holds the last Israel day the trainee was seen training. It counts when that day is no more than 7 days before the day of the **last good sweep**. Comparing with the last good sweep, not with today, means a sweep that fails for a week expires nobody.
- **Marked active by an admin** until a day that has not passed (decided by Itay after the builder check). See "Admin mark" below.

**Seen training** is stamped (only ever moved forward) from:

- **Arbox, nightly**, matched on `arbox_user_id`, from three reads (my call, after the builder check):
  - `activeMembershipsReport`: a row of a training type, classified exactly as `fetchPaidTrainingUserIds()` does (`plan` and `session`, an unknown name counts).
  - `sessionsReport`: any live card. Cards are not in the memberships report (the Arbox import spec found 166 live cards there and none in `activeMembershipsReport`), so without this read every card holder would lock. A card counts while Arbox lists it, whatever its sessions left.
  - `membersOnHold`: a frozen Arbox membership counts as training, like a frozen app Plan.
  The builder may replace these with Arbox's own `activeMembers` report if a dry run shows it covers all three.
- **App Plans, nightly:** the trainee's Plan queue has a Current or Queued Plan (`loadPlanQueues()`). A frozen Plan counts as training (my call: a medical pause is still a member).
- **App sale, at once:** fulfillment stamps today when it places a Plan, so a trainee who just bought does not wait for the night.

**A good sweep** is one where every Arbox read and the Plan read succeeded and Arbox returned a believable number of rows (my call: the memberships and cards reads together are not empty and not a sharp drop from the last good sweep, the builder picks the threshold; the on-hold read may be legitimately empty). Only a good sweep records its day. The sweep runs as a step of `/api/cron/arbox-sync`, isolated like the access step, with a dry run that prints how many trainees would become locked.

**Before the first good sweep** the rule falls back to today's behaviour, so the deploy never locks everyone while the column is empty.

**Admin mark.** For a trainee who trains but has no evidence the sweep can see: no Arbox link and no app Plan (78 trainees on 2026-11-22), or someone who renewed in Arbox this morning. Decided by Itay:

- Admins only, on the staff trainee page.
- The admin picks the last day it holds; it is required, today or later, and at most a year ahead (my call). It can be ended early or changed.
- Each set, change or end is written to `activity_logs` with the day chosen. A new action string needs a migration that widens the `activity_logs` action CHECK, or the insert is refused.
- The page shows the mark and its day to staff, so nobody wonders why a trainee with no membership can watch.
- The mark only grants course access; it does not touch `access_override`, the course-only tier or anything else.

**The columns are server-only.** Add the seen-training day and the admin mark's day to `enforce_profile_column_guard()` in the same migration, or a trainee can set them from the browser (see the profiles column guard gotcha).

**Course-only buyers** keep the digital course through the buyers exception. They are not active, so every other course is locked for them.

**Nothing else moves.** `arbox_paid_training`, the course-only tier and `access_override` keep their meaning. `courses.active_only` and `profiles.is_active` stop deciding course access.

**What a locked trainee sees.** The course stays in the list with a lock. Its page shows the cover and title and "הקורס פתוח למתאמנים פעילים". Where the app sells (`canAskParentToBuy()`), a "בקשה מההורה" button goes under it. The video URL action and the progress write both refuse. Progress rows stay, so a returning trainee picks up where they stopped.

**Who this affects.** Trainees seen neither in Arbox's active memberships nor in an app Plan queue lose the courses, the tactical course included, which today lets former clients in. A trainee with no Arbox link and no Plan has no evidence of training and is locked until an admin marks them. The dry run lists the trainees who would become locked, with their branches and whether they have an Arbox link, so staff can mark the ones who train before the switch. Show Itay the count before switching the rule on.

### 2. Per-lesson views (built)

Built on branch `feat/course-lesson-views`, not merged. `/admin/course/progress` gets two tabs, "לפי מתאמן" and "לפי שיעור" (`?view=lessons`). Per lesson: סיימו (has `completed_at`, the trainee's own 90% rule) and התחילו (any time played, finished included), and the names, finished first. Rules in `src/features/course/lib/lesson-views.ts`. The report is now branch-scoped for trainers (it showed every branch before) and pages its trainee read. Ships first, on its own.

### 3. Course management (admins)

In `/admin/course`, next to the course switcher:

- **New course:** title (required) and description (optional). It starts unpublished and empty. Its slug is generated once, unique, and never changes, so addresses stay stable; the admin never sees it.
- **Edit a course:** title, description, cover image (optional; a course with no cover keeps today's look), and its order among the courses.
- **Chapters:** add (title, optional subtitle), rename and reorder (both exist), and delete while the chapter has no lessons.
- **Lessons:** as today.
- **Publish a course:** only with at least one published lesson, as well as today's title rule (my call: an empty course must not appear to trainees).
- **Delete a course:** only while it has no chapters. A course with content is hidden by unpublishing it.
- The two existing courses become ordinary rows, edited the same way. The digital course keeps two things tied to its slug: the buyers exception and the badges.
- Every write is admin-only (`verifyAdmin()` in the action, as the current CMS actions do) and revalidates the trainee course pages under `/dashboard/courses`.

### 4. Trainee side

- **`/dashboard/courses`:** a card per published course, in admin order, with cover, title, the trainee's progress (finished of total lessons) and a lock when they may not open it.
- **`/dashboard/courses/[courseSlug]`** and **`/dashboard/courses/[courseSlug]/[chapterSlug]/[lessonSlug]`:** the existing `CourseHomePage` and `CourseLessonPage` with the course taken from the address.
- **Redirects:** `/dashboard/course/...` goes to the digital course's new address and `/dashboard/tactical-course/...` to the tactical one's, nested paths included.
- **Menu:** one "קורסים" entry replaces the two course entries. It shows while at least one course is published, even if all are locked, so a lapsed trainee sees why and how to renew. The layout's tactical read goes away.
- **Course-only tier:** `COURSE_ONLY_HOME` becomes the digital course's new address, and the allowed paths cover it and the course list (where only the digital course opens for them).
- **Survey popup:** `MID_ACTIVITY_PATHS` names `courses` at the lesson depth (5 segments counting "dashboard") instead of the two old sections.

### Data changes

- `profiles`: the seen-training day (a date, null until first seen) and the admin mark's last day (a date, null for none), both added to `enforce_profile_column_guard()`.
- `activity_logs`: the action CHECK widened for the admin mark's set, change and end.
- The day of the last good sweep: a small server-only table or settings row (builder's call), service role only.
- `courses.active_only`: no longer read. Drop it in a later migration, after the code that reads it is gone.
- No change to the progress tables.

## Order of work

Three separate PRs, in this order:

1. Per-lesson views (the branch above).
2. The active rule: column, guard, sweep step with dry run, the fulfillment stamp, the rule in every gate, the locked view. Check the dry-run count with Itay before the switch.
3. Course management, the data-driven routes, the course list, the menu entry and the redirects.

After 3, the owner creates the mental-training course in the course admin.

## Risks and things noticed

- **0 course buyers are flagged** in production. Verify the Arbox item name and the sales sweep before relying on the exception.
- **Uploaded video is not compressed.** A 1080p file from the owner costs more bandwidth than the first course, which was compressed by script. Watch usage.
- **The access sync's stamp is near the URL cap.** `syncCourseAccess()` stamps `arbox_access_synced_at` with `.in("id", batch)` of up to 1000 ids. With 531 linked profiles it fits today, but past about 640 ids the request fails (see the long `.in()` gotcha). Send it 200 at a time while touching that file.

## Left to the builder

Column and table names; the "believable sweep" threshold; where covers are stored and how they upload; slug generation for courses and chapters; how the redirects are done; the course card layout; whether the lock notice and the buy button reuse existing components.
