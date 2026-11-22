# Course Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An admin creates and manages courses, chapters and lessons in `/admin/course`, and every published course reaches trainees through one "קורסים" menu entry and one data-driven route, with no code change per course.

**Architecture:** New admin actions (create, edit, reorder, delete course; create and delete chapter) beside the existing CMS actions, with the rules (slugs, publish, delete) pure and tested. The trainee side moves to `/dashboard/courses` (list) and `/dashboard/courses/[courseSlug]/...` over the existing `CourseHomePage` and `CourseLessonPage`; the old addresses redirect.

**Tech Stack:** Next.js 16 App Router (server components, server actions, `next.config.ts` redirects), React 19, TypeScript strict, Supabase, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-22-course-access-and-management-design.md` (sections 3 and 4). This is PR 3 of the spec's order of work and builds on `docs/superpowers/plans/2026-11-22-course-access-by-training.md` being merged: it uses that plan's `loadCourseForViewer()` (with `canOpen` and `canAskParent`) and `canOpenCourse()`.

## Global Constraints

- Admins only for every write: `verifyAdmin()` in each action (RLS `is_course_admin()` already backs it).
- A course's and a chapter's slug is generated once, ASCII, unique (a course across all courses, a chapter within its course), and never changes; the admin never sees it.
- Publish a course only when `needs_title` is false and it has at least one published lesson.
- Delete a course only while it has no chapters; delete a chapter only while it has no lessons. Otherwise refuse on the server, whatever the UI shows.
- The digital course (`eden-player-development`) keeps its buyers exception and its badges (`courseEarnsBadges()`); no other course earns badges.
- Trainee addresses: `/dashboard/courses` and `/dashboard/courses/<courseSlug>[/<chapterSlug>/<lessonSlug>]`. Old `/dashboard/course[/...]` and `/dashboard/tactical-course[/...]` redirect permanently to the same lesson under the new address.
- Menu label verbatim: `"קורסים"`. It shows while at least one course is published.
- All UI text Hebrew, RTL, logical CSS properties, no emojis.
- New action files stay under 400 lines; do not grow `admin-course.ts` (656 lines) except to call the new rules.

## Review Focus

1. **Two courses or chapters with Hebrew-only names** get distinct slugs and never a collision error in front of the admin. Test: `courseSlugFor` in Task 1.
2. **An old link to a lesson** (`/dashboard/course/<chapter>/<lesson>`, `/dashboard/tactical-course/<chapter>/<lesson>`) lands on the same lesson, not the course home or a 404. Test: `courseRedirects()` in Task 5.
3. **Publishing a course whose lessons are all drafts** is refused with a reason. Test: `publishCourseProblem` in Task 1.
4. **Deleting a chapter that has lessons through a stale screen** is refused by the server. Test: `deleteChapterProblem` in Task 1, used by the action in Task 2.
5. **Someone who bought only the digital course** lands on its new address, sees it in the course list, and every other course shows locked. Tests in Task 6 (`course-access.test.ts`).

---

### Task 1: Pure course admin rules

**Files:**
- Create: `src/features/course/lib/course-admin-rules.ts`
- Test: `src/features/course/lib/__tests__/course-admin-rules.test.ts`
- Modify: `src/features/course/lib/actions/admin-course.ts` (use `positionalSlug` instead of its private `lessonSlug`)

**Interfaces:**
- Produces:
  ```ts
  export function positionalSlug(titleHe: string, position: number, fallback: string): string; // today's lessonSlug, fallback "lesson"
  export function courseSlugFor(titleHe: string, taken: ReadonlySet<string>): string;
  export function publishCourseProblem(course: { needsTitle: boolean; publishedLessons: number }): string | null;
  export function deleteCourseProblem(chapters: number): string | null;
  export function deleteChapterProblem(lessons: number): string | null;
  ```

- [ ] **Step 1: Write the failing tests.**
  - `positionalSlug("Intro Lesson", 3, "lesson")` is `"03-intro-lesson"`; `positionalSlug("פתיחה", 0, "chapter")` is `"00-chapter"` (the existing lesson slugs must not change: also assert `positionalSlug("פתיחה", 0, "lesson")` is `"00-lesson"`).
  - `courseSlugFor("Mental Training", new Set())` is `"mental-training"`; `courseSlugFor("אימון מנטלי", new Set())` is `"course"`; with `taken = new Set(["course"])` it is `"course-2"`; with `new Set(["course", "course-2"])` it is `"course-3"`; it never returns a slug in `taken`.
  - `publishCourseProblem({ needsTitle: true, publishedLessons: 5 })` is `"יש לתת לקורס שם לפני פרסום"`; `({ needsTitle: false, publishedLessons: 0 })` is `"אפשר לפרסם קורס רק כשיש בו לפחות שיעור אחד שפורסם"`; `({ needsTitle: false, publishedLessons: 1 })` is null.
  - `deleteCourseProblem(0)` null, `deleteCourseProblem(1)` `"אפשר למחוק רק קורס ריק. כדי להסתיר אותו מהמתאמנים, בטלו את הפרסום"`.
  - `deleteChapterProblem(0)` null, `deleteChapterProblem(2)` `"אפשר למחוק רק פרק ריק"`.

- [ ] **Step 2: Run them.** Run: `npm run test:run -- src/features/course/lib/__tests__/course-admin-rules.test.ts`. Expected: FAIL (module missing).
- [ ] **Step 3: Implement.** `courseSlugFor`: ASCII-ify like `positionalSlug` (lowercase, non `[a-z0-9]` runs to `-`, trim dashes, at most 40 chars), `"course"` when fewer than 2 characters remain, then `-2`, `-3`, ... until free. Replace `lessonSlug` in `admin-course.ts` with `positionalSlug(titleHe, nextIndex, "lesson")`.
- [ ] **Step 4: Run them, then the whole suite.** Expected: PASS.
- [ ] **Step 5: Commit** `feat(course): pure rules for course and chapter management`.

### Task 2: Admin actions for courses and chapters

**Files:**
- Create: `src/features/course/lib/actions/admin-course-structure.ts`
- Modify: `src/features/course/lib/actions/admin-course.ts` (`setCoursePublished` runs `publishCourseProblem`; `revalidateCourse()` revalidates `/admin/course` and `revalidatePath("/dashboard/courses", "layout")`)
- Modify: `src/features/course/lib/actions/index.ts` (re-export)

**Interfaces:**
- Consumes: Task 1's rules.
- Produces (each returns `CourseActionResult` from `admin-course.ts`, plus the field named):
  ```ts
  export async function createCourse(titleHe: string, descriptionHe: string | null): Promise<CourseActionResult & { slug?: string }>;
  export async function updateCourseDetails(courseId: string, details: { titleHe: string; descriptionHe: string | null }): Promise<CourseActionResult>;
  export async function moveCourse(courseId: string, direction: "up" | "down"): Promise<CourseActionResult>;
  export async function deleteCourse(courseId: string): Promise<CourseActionResult>;
  export async function createChapter(courseId: string, titleHe: string, subtitleHe: string | null): Promise<CourseActionResult & { chapterId?: string }>;
  export async function deleteChapter(chapterId: string): Promise<CourseActionResult>;
  ```

- [ ] **Step 1: Implement the actions.** Each: `verifyAdmin()`, `isValidUUID()` on ids, the existing `validateTitle()` on titles (move it to `course-admin-rules.ts` if it is private), description and subtitle trimmed, empty to null, at most 500 and 200 characters. `createCourse` inserts unpublished, `needs_title = false`, `order_index` = max + 1, slug from `courseSlugFor` over every existing slug. `moveCourse` swaps `order_index` with its neighbour in that direction (no-op at the end). `deleteCourse` counts chapters and runs `deleteCourseProblem`; `deleteChapter` counts lessons and runs `deleteChapterProblem`. `createChapter` uses `positionalSlug(titleHe, nextIndex, "chapter")` with the same collision nudge `createLesson` uses, `order_index` = max + 1. `setCoursePublished(id, true)` counts the course's published lessons and runs `publishCourseProblem` before writing. All call `revalidateCourse()`.
- [ ] **Step 2: Verify.** Run: `npx tsc --noEmit && npm run lint && npm run test:run`. Expected: clean.
- [ ] **Step 3: Commit** `feat(course): admins create, edit, order and delete courses and chapters`.

### Task 3: Admin screens

**Files:**
- Create: `src/features/course/components/admin/NewCourseDialog.tsx`
- Create: `src/features/course/components/admin/CourseDetailsEditor.tsx`
- Create: `src/features/course/components/admin/ChapterCreateForm.tsx`
- Modify: `src/features/course/components/admin/CourseAdminClient.tsx`
- Modify: `src/app/admin/course/page.tsx`
- Modify: `src/features/course/lib/actions/admin-course.ts` (`listCourseAdminTree` returns `descriptionHe` and per chapter `lessonCount`, if missing)

**Interfaces:**
- Consumes: Task 2's actions.

- [ ] **Step 1: New course.** On `/admin/course` (admins) a "קורס חדש" button opens `NewCourseDialog` (fields "שם הקורס", "תיאור (לא חובה)", submit "צור קורס"); on success `router.push(\`/admin/course?course=${slug}\`)`. With no course at all, the page's empty state offers the same button instead of the seed-script advice (admins only; trainers keep their message).
- [ ] **Step 2: Course details.** `CourseDetailsEditor` in the course header edits the description (title keeps its `InlineTitleEdit`), and has "הזז קדימה" / "הזז אחורה" (`moveCourse`) and "מחק קורס", shown only when the course has no chapters, behind `DeleteConfirmDialog`. A refused publish shows the action's error in a toast.
- [ ] **Step 3: Chapters.** `ChapterCreateForm` under the chapter list ("פרק חדש": "שם הפרק", "כותרת משנה (לא חובה)", "הוסף פרק"). Each chapter with no lessons shows "מחק פרק" behind `DeleteConfirmDialog`.
- [ ] **Step 4: Verify** `npx tsc --noEmit && npm run lint`; then in the browser as an admin create a course, add a chapter, add a lesson, try to publish with a draft lesson (refused), delete the empty chapter, delete the empty course.
- [ ] **Step 5: Commit** `feat(course): course and chapter management screens`.

### Task 4: Course cover image

**Files:**
- Create: `src/app/api/images/course-cover/route.ts`
- Create: `src/features/course/components/admin/CourseCoverUpload.tsx`
- Modify: `src/features/course/lib/actions/admin-course-structure.ts` (`setCourseCover`)
- Modify: `src/features/course/lib/types.ts` (`Course.coverUrl: string | null`), `src/features/course/lib/actions/course-read.ts` (map `cover_url`), `src/features/course/components/trainee/CourseCover.tsx`

**Interfaces:**
- Produces: `POST /api/images/course-cover` (FormData `file`, `courseId`) returning `{ success: true, url } | { success: false, error }`; `setCourseCover(courseId: string, url: string | null): Promise<CourseActionResult>`.

- [ ] **Step 1: Route.** Follow `src/app/api/images/upload-original/route.ts`: admin check, rate limit, image types JPEG, PNG, WebP only, at most 5 MB, upload with the service role to the public `avatars` bucket at `course-covers/<courseId>/<timestamp>.<ext>`, return the public URL. The action stores it in `courses.cover_url`; null removes it.
- [ ] **Step 2: Screens.** `CourseCoverUpload` in `CourseDetailsEditor` (preview, "החלף תמונה", "הסר תמונה"). `CourseCover` draws the image behind its existing gradient when `coverUrl` is set (`next/image` with `fill`, `sizes="100vw"`, `alt=""`, the gradient kept above it for text contrast); with no cover it looks as today.
- [ ] **Step 3: Verify** `npx tsc --noEmit && npm run lint`; upload a cover in the browser and see it on the trainee course page.
- [ ] **Step 4: Commit** `feat(course): course cover image`.

### Task 5: Data-driven trainee routes and redirects

**Files:**
- Modify: `src/features/course/lib/course-slugs.ts` (`courseHref`)
- Create: `src/lib/navigation/course-redirects.ts`
- Test: `src/lib/navigation/__tests__/course-redirects.test.ts`
- Modify: `next.config.ts` (`redirects()` includes `courseRedirects()`)
- Create: `src/app/dashboard/courses/page.tsx`, `src/app/dashboard/courses/[courseSlug]/page.tsx`, `src/app/dashboard/courses/[courseSlug]/[chapterSlug]/[lessonSlug]/page.tsx`
- Create: `src/features/course/lib/load-course-list.ts` (`import "server-only"`), `src/features/course/components/trainee/CourseList.tsx`
- Delete: `src/app/dashboard/course/`, `src/app/dashboard/tactical-course/`

**Interfaces:**
- Consumes: `loadCourseForViewer(slug)` and `canOpenCourse` from the access plan; `getPublishedCourse(slug)`, `getMyLessonProgress()`, `countCourseProgress()`.
- Produces:
  ```ts
  export const courseHref = (slug: string): string => `/dashboard/courses/${slug}`;
  export function courseRedirects(): { source: string; destination: string; permanent: true }[];
  export interface CourseCard { slug: string; titleHe: string; descriptionHe: string | null; coverUrl: string | null; done: number; total: number; canOpen: boolean }
  export async function loadCourseList(): Promise<CourseCard[]>;
  ```

- [ ] **Step 1: Write the failing redirect test.** `courseRedirects()` contains `{ source: "/dashboard/course", destination: "/dashboard/courses/eden-player-development" }`, `{ source: "/dashboard/course/:path*", destination: "/dashboard/courses/eden-player-development/:path*" }`, and the same two for `"/dashboard/tactical-course"` to `"/dashboard/courses/tactical"`, all `permanent: true`; no source starts with `/dashboard/courses`.
- [ ] **Step 2: Run it.** Expected: FAIL. **Step 3: Implement** `courseRedirects()` from `DIGITAL_COURSE_SLUG` and `TACTICAL_COURSE_SLUG`, and spread it into `next.config.ts`'s `redirects()` (create the function if the config has none). **Step 4: Run it.** Expected: PASS.
- [ ] **Step 5: Routes.** The course page renders `CourseHomePage` with `slug` from the address and `basePath={courseHref(slug)}`; the lesson page renders `CourseLessonPage` the same way. Both `dynamic = "force-dynamic"`; the title metadata comes from the course where it is cheap, else "קורס | Garden of Eden" / "שיעור | Garden of Eden". Delete the two old route folders.
- [ ] **Step 6: Course list.** `loadCourseList()` reads published course slugs in `order_index` order, loads each with `getPublishedCourse`, counts with `countCourseProgress` over the viewer's progress, and decides `canOpen` with `canOpenCourse(course, await getCourseViewer(), await getCourseAccessContext())` (both from the access plan, memoized per request). `/dashboard/courses` renders `CourseList`: a card per course (cover or the gradient, title, "<done> מתוך <total> שיעורים", a lock and "הקורס פתוח למתאמנים פעילים" when `!canOpen`), each linking to `courseHref(slug)`. No published course: "עוד אין קורסים. נעדכן כשיעלה קורס חדש."
- [ ] **Step 7: Verify** `npx tsc --noEmit && npm run lint && npm run test:run`. Expected: clean.
- [ ] **Step 8: Commit** `feat(course): one route for every course and a course list`.

### Task 6: Menu, course-only tier, survey popup, links

**Files:**
- Modify: `src/lib/navigation/dashboard-nav.ts`, `src/lib/navigation/types.ts` (`requires: "booking" | "courses"`)
- Modify: `src/app/dashboard/layout.tsx` (capability `courses`)
- Modify: `src/lib/access/course-access.ts` (`COURSE_ONLY_HOME`, `COURSE_ONLY_ALLOWED`)
- Test: `src/lib/access/__tests__/course-access.test.ts`
- Modify: `src/features/surveys/lib/offer.ts` (`MID_ACTIVITY_PATHS`)
- Test: `src/features/surveys/lib/__tests__/offer.test.ts`
- Modify: `src/features/course/lib/actions/admin-course.ts` (`TRAINEE_PATH`, if still used)

**Interfaces:**
- Consumes: Task 5's `courseHref`.

- [ ] **Step 1: Update the tests first.**
  - `course-access.test.ts`: `COURSE_ONLY_HOME` is `"/dashboard/courses/eden-player-development"`; for tier `course_only`, `isPathAllowedForTier` allows `"/dashboard/courses"`, `"/dashboard/courses/eden-player-development/01-intro/00-lesson"` and `"/dashboard/courses/tactical"` (the page itself shows it locked), and still refuses `"/dashboard/schedule"`; remove the old `/dashboard/course` expectations.
  - `offer.test.ts`: the popup is not allowed on `"/dashboard/courses/tactical/01-x/02-y"` (5 segments) and is allowed on `"/dashboard/courses"` and `"/dashboard/courses/tactical"`; remove the old `course` and `tactical-course` cases.
- [ ] **Step 2: Run them.** Expected: FAIL.
- [ ] **Step 3: Implement.** `COURSE_ONLY_HOME = courseHref(DIGITAL_COURSE_SLUG)`; `COURSE_ONLY_ALLOWED` = `"/dashboard/courses"`, `"/dashboard/profile"`, `"/dashboard/settings"`. `MID_ACTIVITY_PATHS`: replace the two course entries with `{ section: "courses", segments: 5 }`. Nav: replace the two course entries with `{ href: "/dashboard/courses", label: "קורסים", icon: GraduationCap, mobileOrder: 2, requires: "courses" }`. Layout: drop the tactical read and set `courses` true when any course is published (`courses` where `is_published`, `limit(1)`).
- [ ] **Step 4: Remaining links.** Run: `grep -rn -e "/dashboard/course\b" -e "/dashboard/course\"" -e "/dashboard/course/" -e "tactical-course" src`. Expected: no hits outside tests and `course-redirects.ts`; change any that remain to `courseHref(...)`.
- [ ] **Step 5: Run the suite.** Run: `npx tsc --noEmit && npm run lint && npm run test:run`. Expected: clean.
- [ ] **Step 6: Commit** `feat(course): one courses menu entry; course-only and survey paths follow`.

### Task 7: Docs, review and browser check

**Files:**
- Modify: `CLAUDE.md` (course management, the routes, the redirects)

- [ ] **Step 1:** Update CLAUDE.md.
- [ ] **Step 2: Review.** Run the `code-reviewer` and `security-reviewer` agents on the branch diff; fix CRITICAL and HIGH findings.
- [ ] **Step 3: Browser check** on the preview, signed in as an admin and as a trainee: old links `/dashboard/course` and a tactical lesson link redirect to the right lesson; the menu shows "קורסים"; the list shows each published course with progress; a course created in the admin appears in the list once published; a locked course shows the lock. Phone width 375 and desktop.
- [ ] **Step 4: Commit** `docs(course): self-serve course management`.
