# הקורס הטקטי: a second course of Zoom recordings, for active trainees

Date: 2026-09-27. Extends the digital course (`src/features/course/`, Aug 2026).

## Goal

A new page, "הקורס הטקטי", built like the digital course, holding recordings
of the course's Zoom lessons. Only trainees whose account is active can watch.
Itay or Eden upload the recordings themselves.

## Decisions made with the owner

- It works like the digital course (chapters, lessons, video, progress) but
  on its own page.
- Access: staff, and trainees whose account is active (`profiles.is_active`).
  Arbox status does not matter.
- Course-only buyers (trainees who bought only the digital course and do not
  train) do not see it.
- Videos are hosted like the digital course: the private `course-videos`
  bucket, played through short-lived signed URLs. Zoom share links and
  unlisted YouTube/Vimeo were rejected: anyone holding the link could watch.

## What exists

- `courses`, `course_chapters`, `course_lessons`, `course_lesson_progress`
  already allow several courses. Today there is one:
  `eden-player-development` ("קורס דיגיטלי גארדן אוף עדן", 39 lessons).
- Publishing: `courses.is_published` is the one visibility gate, and CHECK
  constraints refuse publishing placeholder titles or lessons without video.
- Row-level security lets any signed-in user read published content, and only
  course admins write it.
- The trainee reader `getPublishedCourse(slug?)` can load a course by slug.
  But these still assume one course:
  - the admin tree `listCourseAdminTree()` and the progress report take the
    first course;
  - the trainee components link to the hardcoded `/dashboard/course`.
- Upload: `LessonVideoUpload` sends the file in one request, capped at 250 MB
  (both the bucket limit and the component's check). A one-hour Zoom recording
  is typically 300 to 600 MB.
- Course-only buyers are limited by the middleware
  (`isPathAllowedForTier`) to `/dashboard/course`, `/dashboard/profile` and
  `/dashboard/settings`.
- Nothing in login or the middleware stops an inactive account. As of
  2026-09-27 there are 10 inactive trainees and 525 active ones.

## Design

### 1. Data (one migration)

- `courses.active_only boolean NOT NULL DEFAULT false`: a course only active
  trainees and staff may open.
- Insert the tactical course:
  - slug `tactical`, title "הקורס הטקטי";
  - `active_only = true`, `is_published = false`;
  - `order_index` after the digital course;
  - one first chapter, "שיעורי זום". Admins can add more.
- Raise `course-videos.file_size_limit` from 250 MB to 2 GB. Allowed types
  stay `video/mp4`.
- Before deploying, the Supabase project's global upload size limit
  (Storage settings) must be at least 2 GB. This is a manual dashboard step.
- Regenerate the types (`npm run db:types`) and refresh the schema snapshot.

### 2. Access

A pure function, tested:

```
canOpenCourse({ activeOnly, role, isActive }): boolean
  staff (admin or trainer) -> true
  course is not active_only -> true
  active_only -> the trainee's is_active
```

It is enforced in two places:

- **The course pages.** The server page loads the viewer's profile. If
  `canOpenCourse` refuses, it renders a notice ("הגישה לקורס זה פתוחה
  למתאמנים פעילים") instead of chapters.
- **`getLessonPlaybackUrl`,** the only way to get a video URL. It resolves the
  lesson's course and refuses to sign a URL when `canOpenCourse` refuses. This
  closes the path even if someone calls the action directly.

Lesson titles of a published tactical course remain readable under row-level
security, as today's policies allow. Titles are not sensitive; the video is
the protected asset.

Course-only buyers: the new path is not in `COURSE_ONLY_ALLOWED`, so the
middleware keeps them out with no change.

### 3. Trainee pages

- The digital course moves nothing: `/dashboard/course` keeps its pages, and
  `getPublishedCourse` is now called with its slug explicitly.
- New: `/dashboard/tactical-course`, `/[chapterSlug]` and `/[lessonSlug]`.
  They are thin pages that load the `tactical` course and render the same
  components.
- The trainee components (`ChapterList`, `LessonPlaylist`, `ResumeCard`,
  lesson page links) take a `basePath` prop instead of hardcoding
  `/dashboard/course`.
- Progress uses the existing per-lesson table and needs no change.
- Menu: a "הקורס הטקטי" item in `dashboard-nav.ts`, shown only when the viewer
  can open the course and it is published.

### 4. Admin

- `/admin/course` gets a switcher between the two courses (`?course=<slug>`,
  defaulting to the digital course).
- `listCourseAdminTree(slug)` and the progress report
  (`course-progress-report`) take the chosen course.
- The existing actions (rename, publish, reorder, create lesson, upload) keep
  working per course, because they act on ids under the chosen course.
- `LessonVideoUpload` switches to resumable upload (TUS, via `tus-js-client`,
  against Supabase's `/storage/v1/upload/resumable` endpoint with the
  signed-in admin's token). It shows progress, survives a dropped connection,
  and allows up to 2 GB. The storage path scheme is unchanged.

## Testing

- `canOpenCourse`: staff, active trainee, inactive trainee, and a
  non-`active_only` course with an inactive trainee.
- The existing course-access and progress tests still pass.
- By hand, after deploy:
  - upload one real long Zoom recording;
  - publish;
  - watch as an active trainee;
  - confirm an inactive trainee sees the notice and cannot get a video URL;
  - confirm a course-only buyer is redirected;
  - confirm the digital course is unchanged.

## Cost note

At roughly 0.5 GB per watched hour, 100 trainees watching 10 hours each is
about 500 GB of egress. That is above the 250 GB the plan includes, so an
overage of tens of dollars in a heavy month. If this grows, re-encode the
recordings smaller before upload, as the digital course did
(`scripts/transcode-course.ts`).

## Out of scope

- Live Zoom sessions and automatic import from Zoom's cloud.
- Per-trainee enrollment in the tactical course: access is by account status.
- Adaptive bitrate or HLS.
