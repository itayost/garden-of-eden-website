# הקורס הטקטי Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A second course, "הקורס הטקטי", with its own trainee page for Zoom recordings, open only to staff and active trainees, managed from the existing course admin with resumable uploads up to 2 GB.

**Architecture:**
- The tactical course is a second row in `courses`, marked `active_only`.
- One pure rule, `canOpenCourse`, decides access. It is enforced in the course pages and in the only video-URL action.
- The trainee page bodies move into shared components that take the course slug and a base path. The digital and tactical routes become thin wrappers.
- The admin screens gain a course switcher.
- The uploader switches to TUS resumable upload.

**Tech Stack:** Next.js 16 App Router (server components and server actions), Supabase (Postgres, RLS, Storage), `tus-js-client`, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-27-tactical-course-design.md`

## Global Constraints

- Tactical course slug: `tactical`; title "הקורס הטקטי"; first chapter slug `zoom-lessons`, title "שיעורי זום".
- Digital course slug: `eden-player-development` (unchanged).
- Access: staff (admin, trainer) always; otherwise a trainee with `profiles.is_active = true`, and only for `active_only` courses. Arbox status is irrelevant.
- Course-only buyers must not reach the tactical page. The middleware already blocks any `/dashboard/*` path outside `COURSE_ONLY_ALLOWED`; do not add the new path there.
- Denied text: "הגישה לקורס זה פתוחה למתאמנים פעילים".
- Upload cap: 2 GB (`2 * 1024 ** 3` bytes). MP4 only.
- Trainee route: `/dashboard/tactical-course`. Menu label: "הקורס הטקטי".
- Hebrew UI, RTL, no emojis, immutable updates, files under 400 lines.
- Tests cover pure functions only (project rule: no mock-based tests).

## Review Focus

- **An inactive trainee calling `getLessonPlaybackUrl` directly** must get no URL. Pinned by the `canOpenCourse` tests (Task 1) and the action's use of it (Task 4).
- **The digital course page must never load the tactical course**, even if `order_index` changes. Both pages ask for their course by explicit slug (Task 5).
- **Two courses whose lessons share chapter and lesson slugs** must not overwrite each other's video. Paths are keyed by lesson id; tested in Task 2.
- **A viewer with no profile row** (null) must be treated as not active. Tested in Task 1.
- **A file over 2 GB** is refused before any upload starts, with a Hebrew message. The uploader checks the size first (Task 2).

---

### Task 1: The access rule

**Files:**
- Create: `src/features/course/lib/course-access-rule.ts`
- Create: `src/features/course/lib/course-slugs.ts`
- Test: `src/features/course/lib/__tests__/course-access-rule.test.ts`

**Interfaces:**
- Produces:
  - `interface CourseViewer { role: string | null; isActive: boolean }`
  - `canOpenCourse(activeOnly: boolean, viewer: CourseViewer): boolean`
  - `DIGITAL_COURSE_SLUG = "eden-player-development"`
  - `TACTICAL_COURSE_SLUG = "tactical"`
  - `COURSE_ACCESS_DENIED = "הגישה לקורס זה פתוחה למתאמנים פעילים"`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";

import { canOpenCourse } from "../course-access-rule";

describe("canOpenCourse", () => {
  test("staff always open a course", () => {
    expect(canOpenCourse(true, { role: "admin", isActive: false })).toBe(true);
    expect(canOpenCourse(true, { role: "trainer", isActive: false })).toBe(true);
  });

  test("an active trainee opens an active-only course", () => {
    expect(canOpenCourse(true, { role: "trainee", isActive: true })).toBe(true);
  });

  test("an inactive trainee cannot open an active-only course", () => {
    expect(canOpenCourse(true, { role: "trainee", isActive: false })).toBe(false);
  });

  test("anyone signed in opens a course that is not active-only", () => {
    expect(canOpenCourse(false, { role: "trainee", isActive: false })).toBe(true);
  });

  test("a viewer with no profile is not active", () => {
    expect(canOpenCourse(true, { role: null, isActive: false })).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:run -- src/features/course/lib/__tests__/course-access-rule.test.ts`
Expected: FAIL, cannot resolve `../course-access-rule`.

- [ ] **Step 3: Implement**

`src/features/course/lib/course-slugs.ts`:

```ts
/** The course pages ask for their course by slug, never "the first one". */
export const DIGITAL_COURSE_SLUG = "eden-player-development";
export const TACTICAL_COURSE_SLUG = "tactical";
```

`src/features/course/lib/course-access-rule.ts`:

```ts
/**
 * Who may open a course. Staff always may. A course marked active_only (הקורס
 * הטקטי) is otherwise open only to a trainee whose account is active; Arbox
 * status plays no part. Pure, so the pages and the video-URL action cannot
 * disagree.
 */
export interface CourseViewer {
  readonly role: string | null;
  readonly isActive: boolean;
}

export const COURSE_ACCESS_DENIED = "הגישה לקורס זה פתוחה למתאמנים פעילים";

export function canOpenCourse(activeOnly: boolean, viewer: CourseViewer): boolean {
  if (viewer.role === "admin" || viewer.role === "trainer") return true;
  if (!activeOnly) return true;
  return viewer.role === "trainee" && viewer.isActive;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run test:run -- src/features/course/lib/__tests__/course-access-rule.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/course/lib/course-access-rule.ts src/features/course/lib/course-slugs.ts src/features/course/lib/__tests__/course-access-rule.test.ts
git commit -m "feat(course): who may open an active-only course"
```

---

### Task 2: Video path by lesson id, and resumable upload up to 2 GB

**Files:**
- Modify: `src/features/course/lib/playback-config.ts:32-34` (`cmsVideoPath`)
- Modify: `src/features/course/components/admin/LessonVideoUpload.tsx`
- Test: `src/features/course/lib/__tests__/playback-config.test.ts`
- Modify: `package.json` (add `tus-js-client`)

**Interfaces:**
- Produces:
  - `cmsVideoPath(lessonId: string): string`, which returns `cms/<lessonId>.mp4`
  - `MAX_LESSON_VIDEO_BYTES = 2 * 1024 ** 3`, exported from `playback-config.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, expect, test } from "vitest";

import { cmsVideoPath, MAX_LESSON_VIDEO_BYTES } from "../playback-config";

describe("cmsVideoPath", () => {
  test("is keyed by lesson id, so two courses never share a path", () => {
    // Chapter slugs are unique only within a course; a lesson id is unique everywhere.
    expect(cmsVideoPath("11111111-1111-4111-8111-111111111111")).toBe(
      "cms/11111111-1111-4111-8111-111111111111.mp4",
    );
  });
});

describe("MAX_LESSON_VIDEO_BYTES", () => {
  test("allows a two-gigabyte recording", () => {
    expect(MAX_LESSON_VIDEO_BYTES).toBe(2 * 1024 ** 3);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test:run -- src/features/course/lib/__tests__/playback-config.test.ts`
Expected: FAIL. `cmsVideoPath` returns `<a>/<b>.mp4`, and `MAX_LESSON_VIDEO_BYTES` is undefined.

- [ ] **Step 3: Implement the path and the cap**

In `playback-config.ts`, replace `cmsVideoPath` with:

```ts
/**
 * Where an uploaded lesson video lives. Keyed by lesson id: chapter slugs are
 * unique only within a course, so a slug path could let two courses overwrite
 * each other. Videos already uploaded keep the path stored on their lesson.
 */
export function cmsVideoPath(lessonId: string): string {
  return `cms/${lessonId}.mp4`;
}

/** Matches course-videos.file_size_limit (raised to 2 GB for Zoom recordings). */
export const MAX_LESSON_VIDEO_BYTES = 2 * 1024 ** 3;
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npm run test:run -- src/features/course/lib/__tests__/playback-config.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Add tus-js-client**

Run: `npm install tus-js-client`
Expected: added to `dependencies`. It ships its own types.

- [ ] **Step 6: Switch the uploader to resumable upload**

In `LessonVideoUpload.tsx`:
- Remove the local `MAX_BYTES` and import `MAX_LESSON_VIDEO_BYTES`.
- Replace the size check message with `"הקובץ גדול מדי (X MB). המקסימום הוא 2 GB."`
- Add a `progress` state (`number | null`).
- Replace the `supabase.storage...upload(...)` call with the function below. Call it with the path `cmsVideoPath(lessonId)`, and pass `setProgress` as the progress callback.

```ts
import * as tus from "tus-js-client";

/** TUS resumable upload into the private bucket as the signed-in admin. */
function uploadResumable(
  file: File,
  path: string,
  accessToken: string,
  onProgress: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/upload/resumable`,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: { authorization: `Bearer ${accessToken}`, "x-upsert": "true" },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      // Supabase's TUS endpoint requires 6 MB chunks.
      chunkSize: 6 * 1024 * 1024,
      metadata: {
        bucketName: COURSE_VIDEO_BUCKET,
        objectName: path,
        contentType: "video/mp4",
        cacheControl: "3600",
      },
      onError: reject,
      onProgress: (sent, total) => onProgress(Math.round((sent / total) * 100)),
      onSuccess: () => resolve(),
    });
    upload.findPreviousUploads().then((previous) => {
      if (previous.length > 0) upload.resumeFromPreviousUpload(previous[0]);
      upload.start();
    });
  });
}
```

The upload call site, inside `handleFile`, after the duration check:

```ts
      const path = cmsVideoPath(lessonId);
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("פג תוקף ההתחברות, התחבר מחדש");
        return;
      }
      try {
        await uploadResumable(file, path, session.access_token, setProgress);
      } catch (uploadError) {
        console.error("lesson video upload failed:", uploadError);
        toast.error("ההעלאה נכשלה, נסה שוב. ההעלאה תמשיך מהמקום שבו נעצרה.");
        return;
      }
```

- In `finally`, add `setProgress(null)` alongside `setBusy(false)`.
- While busy, the button shows the percentage instead of the spinner: `{busy ? (progress !== null ? <span className="text-[10px] tabular-nums">{progress}%</span> : <Loader2 ... />) : <Upload ... />}`.
- Widen the button from `h-7 w-7` to `h-7 min-w-7 px-1` so "100%" fits.

The `chapterSlug` and `lessonSlug` props are now unused. Remove them from `LessonVideoUploadProps`, and from the call site in `src/features/course/components/admin/LessonAdminRow.tsx:112-117`.

- [ ] **Step 7: Type-check and lint**

Run: `npx tsc --noEmit && npx eslint src/features/course/components/admin/LessonVideoUpload.tsx src/features/course/components/admin/LessonAdminRow.tsx src/features/course/lib/playback-config.ts`
Expected: no output.

- [ ] **Step 8: Commit**

```bash
git add package.json package-lock.json src/features/course/lib/playback-config.ts src/features/course/lib/__tests__/playback-config.test.ts src/features/course/components/admin/LessonVideoUpload.tsx src/features/course/components/admin/LessonAdminRow.tsx
git commit -m "feat(course): resumable lesson uploads up to 2 GB, stored by lesson id"
```

---

### Task 3: Migration, the tactical course and the bucket limit

**Files:**
- Create: `supabase/migrations/20260927120000_tactical_course.sql`
- Modify (generated): `src/types/database.generated.ts`

- [ ] **Step 1: Write the migration**

```sql
-- הקורס הטקטי: a second course of Zoom recordings, open only to staff and
-- trainees whose account is active. Spec:
-- docs/superpowers/specs/2026-09-27-tactical-course-design.md

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS active_only boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.courses.active_only IS
  'Open only to staff and trainees with profiles.is_active; enforced in the course pages and getLessonPlaybackUrl.';

INSERT INTO public.courses (slug, title_he, description_he, is_published, needs_title, order_index, active_only)
VALUES (
  'tactical',
  'הקורס הטקטי',
  'הקלטות שיעורי הזום של הקורס הטקטי',
  false,
  false,
  (SELECT coalesce(max(order_index), 0) + 1 FROM public.courses),
  true
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.course_chapters (course_id, slug, title_he, order_index)
SELECT id, 'zoom-lessons', 'שיעורי זום', 0
FROM public.courses
WHERE slug = 'tactical'
ON CONFLICT (course_id, slug) DO NOTHING;

-- Zoom recordings run to an hour or more; resumable uploads (TUS) up to 2 GB.
UPDATE storage.buckets
SET file_size_limit = 2147483648
WHERE id = 'course-videos';
```

- [ ] **Step 2: Apply it (owner step)**

Applying a migration writes to the production database. The owner runs it:

```
! supabase db push
```

Then check it: `supabase db query --linked "select slug, active_only, is_published from courses order by order_index"`.
Expected: two rows. `eden-player-development` has `active_only = false`; `tactical` has `active_only = true` and is not published.

- [ ] **Step 3: Regenerate the types and the snapshot**

Run: `npm run db:types && npm run db:schema && npx tsc --noEmit`
Expected: `courses.Row` has `active_only: boolean`, and tsc is clean.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260927120000_tactical_course.sql src/types/database.generated.ts
git commit -m "feat(course): הקורס הטקטי course row, active_only, 2 GB video uploads"
```

---

### Task 4: Reads and playback enforce the rule

**Files:**
- Modify: `src/features/course/lib/types.ts` (`Course` gains `activeOnly`)
- Modify: `src/features/course/lib/actions/course-read.ts` (map `active_only`; add `getCourseViewer`)
- Modify: `src/features/course/lib/actions/course-playback.ts`
- Modify: `src/features/course/lib/actions/index.ts` (export `getCourseViewer`)

**Interfaces:**
- Consumes: `canOpenCourse`, `CourseViewer`, `COURSE_ACCESS_DENIED` (Task 1)
- Produces:
  - `Course.activeOnly: boolean`
  - `getCourseViewer(): Promise<CourseViewer>`

- [ ] **Step 1: Carry `active_only` on the course**

- In `types.ts`, add `activeOnly: boolean;` to `interface Course`.
- In `course-read.ts`, add `active_only: boolean;` to `RawCourse`, and `activeOnly: row.active_only,` in `toCourse`.
- Update any other literal that builds a `Course` so tsc is clean. Find them with `npx tsc --noEmit`.

- [ ] **Step 2: Add `getCourseViewer`**

Append to `course-read.ts`:

```ts
/**
 * The signed-in viewer's role and account status, for canOpenCourse. A viewer
 * with no profile row reads as not active.
 */
export async function getCourseViewer(): Promise<CourseViewer> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { role: null, isActive: false };
  const { data } = (await typedFrom(supabase, "profiles")
    .select("role, is_active")
    .eq("id", user.id)
    .maybeSingle()) as { data: { role: string | null; is_active: boolean | null } | null };
  return { role: data?.role ?? null, isActive: data?.is_active === true };
}
```

Import `type CourseViewer` from `../course-access-rule`. In `actions/index.ts`, change the first export line to `export { getPublishedCourse, getMyLessonProgress, getCourseViewer } from "./course-read";`.

- [ ] **Step 3: Refuse the video URL**

In `course-playback.ts`:

- Change the lesson select to `"video_path, video_path_sd, chapter:course_chapters!inner(course:courses!inner(active_only))"`.
- Widen `LessonVideoRow` to `LessonVideoRow & { chapter: { course: { active_only: boolean } | null } | null }`.
- After the `if (!lesson)` check, add:

```ts
  // An active-only course (הקורס הטקטי) signs a URL only for staff and active
  // trainees. Row-level security lets any signed-in user read a published
  // lesson row; the video is the protected asset, so the gate is here.
  const activeOnly = lesson.chapter?.course?.active_only === true;
  if (activeOnly && !canOpenCourse(true, await getCourseViewer())) {
    return { url: null, quality: null, error: COURSE_ACCESS_DENIED };
  }
```

Import `canOpenCourse` and `COURSE_ACCESS_DENIED` from `../course-access-rule`, and `getCourseViewer` from `./course-read`.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm run test:run -- src/features/course src/lib/access`
Expected: tsc clean; course and access tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/course/lib/types.ts src/features/course/lib/actions/course-read.ts src/features/course/lib/actions/course-playback.ts src/features/course/lib/actions/index.ts
git commit -m "feat(course): an active-only course signs video only for staff and active trainees"
```

---

### Task 5: Trainee pages from shared components

**Files:**
- Create: `src/features/course/components/trainee/CourseHomePage.tsx`
- Create: `src/features/course/components/trainee/CourseLessonPage.tsx`
- Create: `src/features/course/components/trainee/CourseAccessNotice.tsx`
- Modify: `src/features/course/components/trainee/ChapterList.tsx:15-20,91`, `LessonPlaylist.tsx:13-27,45`, `ResumeCard.tsx:7-22` (a `basePath` prop)
- Modify: `src/app/dashboard/course/page.tsx`, `src/app/dashboard/course/[chapterSlug]/[lessonSlug]/page.tsx` (thin wrappers)
- Create: `src/app/dashboard/tactical-course/page.tsx`, `src/app/dashboard/tactical-course/[chapterSlug]/[lessonSlug]/page.tsx`, `src/app/dashboard/tactical-course/loading.tsx`

**Interfaces:**
- Consumes: `getPublishedCourse(slug)`, `getMyLessonProgress()`, `getCourseViewer()`, `canOpenCourse`, `DIGITAL_COURSE_SLUG`, `TACTICAL_COURSE_SLUG`
- Produces:
  - `CourseHomePage({ slug, basePath }: { slug: string; basePath: string })`
  - `CourseLessonPage({ slug, basePath, chapterSlug, lessonSlug })`

- [ ] **Step 1: Give the three components a `basePath`**

In each of `ChapterList`, `LessonPlaylist` and `ResumeCard`:
- add `basePath?: string` to its props interface, defaulting to `"/dashboard/course"` in the destructuring;
- replace the hardcoded `` `/dashboard/course/${...}` `` with `` `${basePath}/${...}` ``.

The default keeps any other caller unchanged.

- [ ] **Step 2: The access notice**

```tsx
import { COURSE_ACCESS_DENIED } from "@/features/course/lib/course-access-rule";

/** Shown instead of a course the viewer may not open. */
export function CourseAccessNotice() {
  return (
    <div className="rounded-xl border border-dashed border-border bg-card/50 py-16 text-center">
      <p className="text-sm text-muted-foreground">{COURSE_ACCESS_DENIED}</p>
    </div>
  );
}
```

- [ ] **Step 3: `CourseHomePage`**

Move the body of today's `src/app/dashboard/course/page.tsx` into `CourseHomePage.tsx` as an async server component with props `{ slug: string; basePath: string }`. The changes from the moved code:
- Load `getPublishedCourse(slug)`, `getMyLessonProgress()` and `getCourseViewer()` in the `Promise.all`.
- After the `!course` notice, add `if (!canOpenCourse(course.activeOnly, viewer)) return <CourseAccessNotice />;`.
- Pass `basePath={basePath}` to `ResumeCard` and `ChapterList`.

The imports and JSX are otherwise exactly today's page.

- [ ] **Step 4: `CourseLessonPage`**

Move the body of today's lesson page into `CourseLessonPage.tsx` with props `{ slug; basePath; chapterSlug; lessonSlug }`. The changes from the moved code:
- Load `getPublishedCourse(slug)`, `getMyLessonProgress()` and `getCourseViewer()`.
- After `if (!course) notFound();`, add `if (!canOpenCourse(course.activeOnly, viewer)) return <CourseAccessNotice />;`.
- Replace every `/dashboard/course` with `basePath`: the back link, `nextHref` and `nextChapterHref`.
- Pass `basePath={basePath}` to `LessonPlaylist`.

- [ ] **Step 5: Thin route wrappers**

`src/app/dashboard/course/page.tsx`. Keep its `metadata` and `dynamic` exports, and replace the component with:

```tsx
export default function CoursePage() {
  return <CourseHomePage slug={DIGITAL_COURSE_SLUG} basePath="/dashboard/course" />;
}
```

`src/app/dashboard/course/[chapterSlug]/[lessonSlug]/page.tsx`. Keep `metadata`, `dynamic` and the params interface:

```tsx
export default async function LessonPage({ params }: LessonPageProps) {
  const { chapterSlug, lessonSlug } = await params;
  return (
    <CourseLessonPage
      slug={DIGITAL_COURSE_SLUG}
      basePath="/dashboard/course"
      chapterSlug={chapterSlug}
      lessonSlug={lessonSlug}
    />
  );
}
```

Create the same two files under `src/app/dashboard/tactical-course/`:
- slug `TACTICAL_COURSE_SLUG`;
- basePath `"/dashboard/tactical-course"`;
- metadata titles "הקורס הטקטי | Garden of Eden" and "שיעור | Garden of Eden".

Copy `src/app/dashboard/course/loading.tsx` to `src/app/dashboard/tactical-course/loading.tsx`.

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit && npx eslint src/features/course/components/trainee src/app/dashboard/course src/app/dashboard/tactical-course && npm run test:run -- src/features/course`
Expected: clean and passing.

- [ ] **Step 7: Commit**

```bash
git add src/features/course/components/trainee src/app/dashboard/course src/app/dashboard/tactical-course
git commit -m "feat(course): /dashboard/tactical-course on shared course pages, gated by canOpenCourse"
```

---

### Task 6: Menu item

**Files:**
- Modify: `src/lib/navigation/types.ts:15,40-42` (a new capability)
- Modify: `src/lib/navigation/dashboard-nav.ts` (the item)
- Modify: `src/app/dashboard/layout.tsx:31-64` (compute it)
- Modify: `src/components/dashboard/DashboardSidebar.tsx`, `src/components/dashboard/DashboardBottomNav.tsx` (pass it)

**Interfaces:**
- Consumes: `canOpenCourse`, `TACTICAL_COURSE_SLUG`

- [ ] **Step 1: A new capability**

In `types.ts`:
- change `requires?: "booking";` to `requires?: "booking" | "tacticalCourse";`;
- change the `capabilities` parameter type to `{ booking: boolean; tacticalCourse: boolean }`.

- [ ] **Step 2: The item**

In `DASHBOARD_NAV`, after the digital course entry:

```ts
  { href: "/dashboard/tactical-course", label: "הקורס הטקטי", icon: GraduationCap, mobileOrder: 2, requires: "tacticalCourse" },
```

- [ ] **Step 3: Compute it in the layout**

In `src/app/dashboard/layout.tsx`:
- add `is_active` to the profile select string;
- after `canBook`, add:

```ts
  // Shown only when the course is published and the viewer may open it.
  const { data: tacticalCourse } = (await typedFrom(supabase, "courses")
    .select("id")
    .eq("slug", TACTICAL_COURSE_SLUG)
    .eq("is_published", true)
    .maybeSingle()) as { data: { id: string } | null };
  const canTacticalCourse =
    tacticalCourse !== null &&
    canOpenCourse(true, { role: profile?.role ?? null, isActive: profile?.is_active === true });
```

Pass `canTacticalCourse={canTacticalCourse}` to `DashboardSidebar` and `DashboardBottomNav`. In both components:
- add `canTacticalCourse: boolean` to the props;
- change the capabilities argument to `{ booking: canBook, tacticalCourse: canTacticalCourse }`.

Import `typedFrom` if the layout does not already import it.

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npx eslint src/lib/navigation src/app/dashboard/layout.tsx src/components/dashboard && npm run test:run -- src/lib/navigation src/lib/access`
Expected: clean and passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/navigation src/app/dashboard/layout.tsx src/components/dashboard/DashboardSidebar.tsx src/components/dashboard/DashboardBottomNav.tsx
git commit -m "feat(course): הקורס הטקטי in the menu for those who may open it"
```

---

### Task 7: Admin course switcher and per-course progress

**Files:**
- Modify: `src/features/course/lib/actions/admin-course.ts:83-100` (`listCourseAdminTree(slug?)`, and a new `listCourses`)
- Modify: `src/features/course/lib/actions/course-progress-report.ts:33-50` (`getCourseProgressReport(slug?)`)
- Create: `src/features/course/components/admin/CourseSwitcher.tsx`
- Modify: `src/app/admin/course/page.tsx`, `src/app/admin/course/progress/page.tsx`

**Interfaces:**
- Produces:
  - `listCourseAdminTree(slug?: string)`
  - `getCourseProgressReport(slug?: string)`
  - `listCourses(): Promise<{ slug: string; titleHe: string }[]>`

- [ ] **Step 1: Filter by slug**

In both loaders, replace the fixed query with a `let` query, the same way `getPublishedCourse` does it:

```ts
  let courseQuery = typedFrom(db, "courses").select("*").order("order_index", { ascending: true }).limit(1);
  if (slug) courseQuery = courseQuery.eq("slug", slug);
  const { data: courses, error: courseError } = await courseQuery;
```

The report selects `"id, title_he"`; keep its own select list.

- [ ] **Step 2: `listCourses`**

Append to `admin-course.ts`:

```ts
/** Every course, for the admin switcher. Staff only. */
export async function listCourses(): Promise<{ slug: string; titleHe: string }[]> {
  const { error } = await verifyAdminOrTrainer();
  if (error) return [];
  const { data } = (await typedFrom(createAdminClient(), "courses")
    .select("slug, title_he")
    .order("order_index", { ascending: true })) as { data: { slug: string; title_he: string }[] | null };
  return (data ?? []).map((c) => ({ slug: c.slug, titleHe: c.title_he }));
}
```

Import `verifyAdminOrTrainer` alongside `verifyAdmin` from `@/lib/actions/shared`.

- [ ] **Step 3: The switcher**

```tsx
import Link from "next/link";

import { cn } from "@/lib/utils";

interface CourseSwitcherProps {
  courses: { slug: string; titleHe: string }[];
  current: string;
  /** "/admin/course" or "/admin/course/progress". */
  basePath: string;
}

/** Tabs between courses; the choice lives in ?course= so it survives reloads. */
export function CourseSwitcher({ courses, current, basePath }: CourseSwitcherProps) {
  if (courses.length < 2) return null;
  return (
    <nav aria-label="בחירת קורס" className="flex flex-wrap gap-2">
      {courses.map((course) => (
        <Link
          key={course.slug}
          href={`${basePath}?course=${course.slug}`}
          aria-current={course.slug === current ? "page" : undefined}
          className={cn(
            "rounded-full border px-4 py-1.5 text-sm transition-colors",
            course.slug === current
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          {course.titleHe}
        </Link>
      ))}
    </nav>
  );
}
```

- [ ] **Step 4: Wire the pages**

`src/app/admin/course/page.tsx`:
- take `searchParams: Promise<{ course?: string }>`;
- `const slug = (await searchParams).course ?? DIGITAL_COURSE_SLUG;`;
- load `listCourses()`, and call `listCourseAdminTree(slug)`;
- render `<CourseSwitcher courses={courses} current={slug} basePath="/admin/course" />` under the header;
- change the heading from "הקורס הדיגיטלי" to "קורסים";
- make the progress button link to `` `/admin/course/progress?course=${slug}` ``;
- metadata title: "קורסים | Garden of Eden".

`src/app/admin/course/progress/page.tsx`:
- take the same `searchParams`;
- call `getCourseProgressReport(slug)`;
- render `<CourseSwitcher ... basePath="/admin/course/progress" />`;
- make the back link `` `/admin/course?course=${slug}` ``.

Because `CourseAdminClient` keeps selection state per course, render it with `key={course.id}`.

- [ ] **Step 5: Verify**

Run: `npx tsc --noEmit && npx eslint src/features/course src/app/admin/course && npm run test:run -- src/features/course`
Expected: clean and passing.

- [ ] **Step 6: Commit**

```bash
git add src/features/course/lib/actions/admin-course.ts src/features/course/lib/actions/course-progress-report.ts src/features/course/components/admin/CourseSwitcher.tsx src/app/admin/course
git commit -m "feat(course): admin switches between courses; progress per course"
```

---

### Task 8: Full verification and owner steps

**Files:** none.

- [ ] **Step 1: Full suite**

Run: `npx tsc --noEmit && npm run lint && npm run test:run`
Expected: tsc and lint clean; the only failures are the 20 known localStorage tests (goals, streak-tracking).

- [ ] **Step 2: Owner steps before merge**

1. In the Supabase dashboard, set Storage > Settings > "Upload file size limit" to at least 2 GB.
2. Run `! supabase db push` (Task 3), unless it is already applied.

- [ ] **Step 3: Owner checks after deploy**

1. In /admin/course, switch to "הקורס הטקטי", add a lesson and upload a real Zoom recording. Watch the percentage climb, and confirm the upload survives a reload in the middle.
2. Name the lesson, publish it, then publish the course.
3. As an active trainee: the menu shows "הקורס הטקטי", and the lesson plays.
4. As an inactive trainee: the page shows the notice and the video does not load.
5. As a course-only buyer: `/dashboard/tactical-course` redirects away.
6. The digital course is unchanged.
