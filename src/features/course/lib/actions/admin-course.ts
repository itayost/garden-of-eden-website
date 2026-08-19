"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { verifyAdmin } from "@/lib/actions/shared";
import { isValidUUID } from "@/lib/validations/common";
import { lessonVideoSchema, reorderSchema } from "@/lib/validations/course";
import { COURSE_VIDEO_BUCKET } from "../playback-config";

// ---------------------------------------------------------------------------
// Result and view types
// ---------------------------------------------------------------------------

export type CourseActionResult =
  | { success: true }
  | { error: string; fieldErrors?: Record<string, string[]> };

export interface AdminCourseLesson {
  id: string;
  slug: string;
  titleHe: string;
  descriptionHe: string | null;
  videoPath: string | null;
  videoPathSd: string | null;
  durationSec: number;
  needsTitle: boolean;
  isPublished: boolean;
  orderIndex: number;
}

export interface AdminCourseChapter {
  id: string;
  slug: string;
  titleHe: string;
  subtitleHe: string | null;
  needsTitle: boolean;
  orderIndex: number;
  lessons: AdminCourseLesson[];
}

export interface AdminCourse {
  id: string;
  slug: string;
  titleHe: string;
  descriptionHe: string | null;
  isPublished: boolean;
  needsTitle: boolean;
  chapters: AdminCourseChapter[];
}

interface RawLesson {
  id: string;
  chapter_id: string;
  slug: string;
  title_he: string;
  description_he: string | null;
  video_path: string | null;
  video_path_sd: string | null;
  duration_sec: number;
  needs_title: boolean;
  is_published: boolean;
  order_index: number;
}

const ADMIN_PATH = "/admin/course";
const TRAINEE_PATH = "/dashboard/course";

function revalidateCourse(): void {
  revalidatePath(ADMIN_PATH);
  revalidatePath(TRAINEE_PATH);
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

/**
 * The whole course including drafts, for the CMS. Unlike the trainee read this
 * deliberately ignores publish state -- that is the thing Eden is managing.
 */
export async function listCourseAdminTree(): Promise<AdminCourse | null> {
  const { error } = await verifyAdmin();
  if (error) return null;

  const db = createAdminClient();

  const { data: courses, error: courseError } = await typedFrom(db, "courses")
    .select("*")
    .order("order_index", { ascending: true })
    .limit(1);

  if (courseError) {
    console.error("listCourseAdminTree course failed:", courseError);
    return null;
  }

  const course = courses?.[0];
  if (!course) return null;

  const { data: chapters, error: chapterError } = await typedFrom(
    db,
    "course_chapters"
  )
    .select("*")
    .eq("course_id", course.id)
    .order("order_index", { ascending: true });

  if (chapterError) {
    console.error("listCourseAdminTree chapters failed:", chapterError);
    return null;
  }

  const chapterRows = chapters ?? [];
  const chapterIds = chapterRows.map((c: { id: string }) => c.id);

  let lessonRows: RawLesson[] = [];
  if (chapterIds.length > 0) {
    const { data: lessons, error: lessonError } = await typedFrom(
      db,
      "course_lessons"
    )
      .select("*")
      .in("chapter_id", chapterIds)
      .order("order_index", { ascending: true });

    if (lessonError) {
      console.error("listCourseAdminTree lessons failed:", lessonError);
      return null;
    }
    lessonRows = (lessons ?? []) as RawLesson[];
  }

  const byChapter = new Map<string, AdminCourseLesson[]>();
  for (const row of lessonRows) {
    const list = byChapter.get(row.chapter_id) ?? [];
    list.push({
      id: row.id,
      slug: row.slug,
      titleHe: row.title_he,
      descriptionHe: row.description_he,
      videoPath: row.video_path,
      videoPathSd: row.video_path_sd,
      durationSec: row.duration_sec,
      needsTitle: row.needs_title,
      isPublished: row.is_published,
      orderIndex: row.order_index,
    });
    byChapter.set(row.chapter_id, list);
  }

  return {
    id: course.id,
    slug: course.slug,
    titleHe: course.title_he,
    descriptionHe: course.description_he,
    isPublished: course.is_published,
    needsTitle: course.needs_title,
    chapters: chapterRows.map(
      (c: {
        id: string;
        slug: string;
        title_he: string;
        subtitle_he: string | null;
        needs_title: boolean;
        order_index: number;
      }) => ({
        id: c.id,
        slug: c.slug,
        titleHe: c.title_he,
        subtitleHe: c.subtitle_he,
        needsTitle: c.needs_title,
        orderIndex: c.order_index,
        lessons: byChapter.get(c.id) ?? [],
      })
    ),
  };
}

// ---------------------------------------------------------------------------
// Titles
// ---------------------------------------------------------------------------

function validateTitle(title: string): string | null {
  const trimmed = title.trim();
  if (trimmed.length === 0) return "נדרשת כותרת";
  if (trimmed.length > 160) return "כותרת ארוכה מדי";
  return null;
}

/**
 * Optional secondary text (a chapter subtitle, a lesson or course description).
 *
 * Omitting the argument must leave the stored value alone -- the inline title
 * editor only ever sends a title, and an unconditional `?? null` would wipe the
 * subtitle or description every time someone renamed the row. Passing an
 * explicit `null` still clears it.
 */
function optionalText(
  value: string | null | undefined
): { present: false } | { present: true; value: string | null } {
  if (value === undefined) return { present: false };
  const trimmed = value?.trim();
  return { present: true, value: trimmed ? trimmed : null };
}

/**
 * Patch exactly one row by id, and treat "matched nothing" as a failure.
 *
 * `.update().eq("id", ...)` against an id that no longer exists reports no error
 * and updates zero rows, so without the RETURNING clause the CMS would toast
 * "נשמר" over a row it never touched -- which is what a page left open across a
 * re-seed or a deletion produces. `.select("id")` rides along on the same round
 * trip.
 *
 * `messages.constraint` is the Hebrew rendering of a CHECK violation (23514) for
 * this table, since the raw constraint name is no use to Eden.
 */
async function updateOneRow(
  table: string,
  id: string,
  patch: Record<string, unknown>,
  context: string,
  messages: { notFound: string; constraint?: string }
): Promise<CourseActionResult> {
  const db = createAdminClient();
  const { data, error } = await typedFrom(db, table)
    .update(patch)
    .eq("id", id)
    .select("id");

  if (error) {
    if (error.code === "23514" && messages.constraint) {
      return { error: messages.constraint };
    }
    console.error(`${context} failed:`, error);
    return { error: "שמירה נכשלה" };
  }

  if (!Array.isArray(data) || data.length === 0) {
    return { error: messages.notFound };
  }

  revalidateCourse();
  return { success: true };
}

/**
 * The one rule the three rename actions share: setting a real title is what
 * clears `needs_title`, and clearing `needs_title` is what the CHECK constraints
 * require before the row can be published. Keeping it in one place means the rule
 * cannot drift between the course, its chapters and its lessons.
 *
 * `secondaryColumn` is the row's optional prose (a chapter subtitle, a lesson or
 * course description). It is only written when the caller actually supplied a
 * value, so the inline title editor -- which sends a title and nothing else --
 * cannot blank it.
 */
async function renameRow(
  table: "courses" | "course_chapters" | "course_lessons",
  id: string,
  titleHe: string,
  secondaryColumn: "subtitle_he" | "description_he",
  secondaryValue: string | null | undefined,
  labels: { context: string; badId: string; notFound: string }
): Promise<CourseActionResult> {
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };
  if (!isValidUUID(id)) return { error: labels.badId };

  const titleError = validateTitle(titleHe);
  if (titleError) return { error: titleError };

  const secondary = optionalText(secondaryValue);

  return updateOneRow(
    table,
    id,
    {
      title_he: titleHe.trim(),
      ...(secondary.present ? { [secondaryColumn]: secondary.value } : {}),
      needs_title: false,
    },
    labels.context,
    { notFound: labels.notFound }
  );
}

/** Rename a chapter, clearing its placeholder flag. */
export async function renameChapter(
  chapterId: string,
  titleHe: string,
  subtitleHe?: string | null
): Promise<CourseActionResult> {
  return renameRow("course_chapters", chapterId, titleHe, "subtitle_he", subtitleHe, {
    context: "renameChapter",
    badId: "מזהה פרק לא תקין",
    notFound: "הפרק לא נמצא",
  });
}

/** Rename a lesson, clearing its placeholder flag. */
export async function renameLesson(
  lessonId: string,
  titleHe: string,
  descriptionHe?: string | null
): Promise<CourseActionResult> {
  return renameRow("course_lessons", lessonId, titleHe, "description_he", descriptionHe, {
    context: "renameLesson",
    badId: "מזהה שיעור לא תקין",
    notFound: "השיעור לא נמצא",
  });
}

/** Rename the course itself, clearing its placeholder flag. */
export async function renameCourse(
  courseId: string,
  titleHe: string,
  descriptionHe?: string | null
): Promise<CourseActionResult> {
  return renameRow("courses", courseId, titleHe, "description_he", descriptionHe, {
    context: "renameCourse",
    badId: "מזהה קורס לא תקין",
    notFound: "הקורס לא נמצא",
  });
}

// ---------------------------------------------------------------------------
// Publishing
// ---------------------------------------------------------------------------

/**
 * Publish or unpublish one lesson.
 *
 * The database CHECK rejects publishing a lesson that still has a placeholder
 * title or no video, so the error here is translated into something Eden can
 * act on rather than a raw constraint name.
 */
export async function setLessonPublished(
  lessonId: string,
  isPublished: boolean
): Promise<CourseActionResult> {
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };
  if (!isValidUUID(lessonId)) return { error: "מזהה שיעור לא תקין" };

  return updateOneRow(
    "course_lessons",
    lessonId,
    { is_published: isPublished },
    "setLessonPublished",
    {
      notFound: "השיעור לא נמצא",
      constraint: "אי אפשר לפרסם שיעור בלי שם או בלי וידאו",
    }
  );
}

/** Publish or unpublish the whole course -- the single gate trainees see. */
export async function setCoursePublished(
  courseId: string,
  isPublished: boolean
): Promise<CourseActionResult> {
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };
  if (!isValidUUID(courseId)) return { error: "מזהה קורס לא תקין" };

  return updateOneRow(
    "courses",
    courseId,
    { is_published: isPublished },
    "setCoursePublished",
    {
      notFound: "הקורס לא נמצא",
      constraint: "אי אפשר לפרסם קורס בלי שם",
    }
  );
}

// ---------------------------------------------------------------------------
// Ordering
// ---------------------------------------------------------------------------

/**
 * Translate a reorder RPC failure into something the CMS can show.
 *
 * The function raises rather than returning a code, so the message is all there
 * is to go on. A mismatched id list means a stale client, not a server fault.
 */
function reorderError(message: string, context: string): CourseActionResult {
  if (message.includes("does not match")) {
    return { error: "רשימת הסדר לא תואמת את הפריטים" };
  }
  if (message.includes("not authorised")) {
    return { error: "נדרשת הרשאת מנהל" };
  }
  console.error(`${context} failed:`, message);
  return { error: "שמירה נכשלה" };
}

/**
 * Reordering delegates to a Postgres function so the whole renumber is one
 * statement: issuing an UPDATE per row used to leave a chapter half-ordered on a
 * mid-loop failure, with the browser already showing the new arrangement.
 *
 * Both calls use the *request-scoped* client on purpose. The functions re-check
 * `is_course_admin()` against `auth.uid()`, which the service role does not
 * have, so routing them through `createAdminClient()` would both skip that check
 * and make the function raise.
 */
export async function reorderChapters(
  courseId: string,
  ids: string[]
): Promise<CourseActionResult> {
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };
  if (!isValidUUID(courseId)) return { error: "מזהה קורס לא תקין" };

  const parsed = reorderSchema.safeParse({ ids });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("reorder_course_chapters", {
    p_course_id: courseId,
    p_ids: parsed.data.ids,
  });

  if (error) return reorderError(error.message, "reorder_course_chapters");

  revalidateCourse();
  return { success: true };
}

export async function reorderLessons(
  chapterId: string,
  ids: string[]
): Promise<CourseActionResult> {
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };
  if (!isValidUUID(chapterId)) return { error: "מזהה פרק לא תקין" };

  const parsed = reorderSchema.safeParse({ ids });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים" };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("reorder_course_lessons", {
    p_chapter_id: chapterId,
    p_ids: parsed.data.ids,
  });

  if (error) return reorderError(error.message, "reorder_course_lessons");

  revalidateCourse();
  return { success: true };
}

// ---------------------------------------------------------------------------
// Lessons: create, attach video, delete
// ---------------------------------------------------------------------------

/**
 * Turn a Hebrew title into an ASCII slug usable as a storage-path segment.
 *
 * Hebrew does not transliterate cleanly, so rather than mangle it this falls
 * back to a timestamp-free positional slug. The slug is an identifier, not
 * something anyone reads -- `title_he` is what shows in the UI.
 */
function lessonSlug(titleHe: string, position: number): string {
  const ascii = titleHe
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  const suffix = ascii.length >= 2 ? ascii.slice(0, 40) : "lesson";
  return `${String(position).padStart(2, "0")}-${suffix}`;
}

/**
 * Add a lesson to a chapter. It starts unpublished and without a video -- the
 * CHECK constraint would reject anything else, and the video arrives in a
 * second step once the file has finished uploading.
 */
export async function createLesson(
  chapterId: string,
  titleHe: string
): Promise<CourseActionResult & { lessonId?: string }> {
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };
  if (!isValidUUID(chapterId)) return { error: "מזהה פרק לא תקין" };

  const titleError = validateTitle(titleHe);
  if (titleError) return { error: titleError };

  const db = createAdminClient();

  const { data: siblings, error: readError } = await typedFrom(
    db,
    "course_lessons"
  )
    .select("slug, order_index")
    .eq("chapter_id", chapterId);

  if (readError) {
    console.error("createLesson read siblings failed:", readError);
    return { error: "שמירה נכשלה" };
  }

  const existing = (siblings ?? []) as {
    slug: string;
    order_index: number;
  }[];
  const nextIndex =
    existing.reduce((max, row) => Math.max(max, row.order_index), -1) + 1;

  // The slug only has to be unique within the chapter; nudge past a collision
  // rather than failing in front of Eden.
  const taken = new Set(existing.map((row) => row.slug));
  let slug = lessonSlug(titleHe, nextIndex);
  for (let n = 2; taken.has(slug); n++) {
    slug = `${lessonSlug(titleHe, nextIndex)}-${n}`;
  }

  const { data, error } = await typedFrom(db, "course_lessons")
    .insert({
      chapter_id: chapterId,
      slug,
      title_he: titleHe.trim(),
      needs_title: false,
      is_published: false,
      order_index: nextIndex,
    })
    .select("id")
    .single();

  if (error || !data) {
    console.error("createLesson failed:", error);
    return { error: "שמירה נכשלה" };
  }

  revalidateCourse();
  return { success: true, lessonId: data.id };
}

/**
 * Record the storage key of a video the browser has just uploaded.
 *
 * The upload itself goes straight from the browser to the bucket under the
 * "Admins manage course video objects" policy, so this only writes the pointer
 * and the duration the client read off the file's metadata.
 */
export async function setLessonVideo(
  lessonId: string,
  videoPath: string,
  durationSec: number
): Promise<CourseActionResult> {
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };
  if (!isValidUUID(lessonId)) return { error: "מזהה שיעור לא תקין" };

  const parsed = lessonVideoSchema.safeParse({
    video_path: videoPath,
    duration_sec: Math.round(durationSec),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים" };
  }

  return updateOneRow(
    "course_lessons",
    lessonId,
    {
      video_path: parsed.data.video_path,
      // A CMS upload is a single rendition: there is no 480p companion unless
      // the file went through the transcode pipeline.
      video_path_sd: null,
      duration_sec: parsed.data.duration_sec,
    },
    "setLessonVideo",
    { notFound: "שיעור לא נמצא" }
  );
}

/**
 * Delete a lesson and the objects behind it.
 *
 * Storage is cleared first: a failure there leaves a row pointing at a file that
 * still exists, which is recoverable, whereas deleting the row first would
 * orphan the objects with nothing left naming them.
 */
export async function deleteLesson(
  lessonId: string
): Promise<CourseActionResult> {
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };
  if (!isValidUUID(lessonId)) return { error: "מזהה שיעור לא תקין" };

  const db = createAdminClient();

  const { data: lesson, error: readError } = await typedFrom(
    db,
    "course_lessons"
  )
    .select("video_path, video_path_sd")
    .eq("id", lessonId)
    .maybeSingle();

  if (readError) {
    console.error("deleteLesson read failed:", readError);
    return { error: "המחיקה נכשלה" };
  }
  if (!lesson) return { error: "שיעור לא נמצא" };

  const paths = [lesson.video_path, lesson.video_path_sd].filter(
    (path): path is string => typeof path === "string" && path.length > 0
  );

  if (paths.length > 0) {
    const { error: storageError } = await db.storage
      .from(COURSE_VIDEO_BUCKET)
      .remove(paths);
    // A missing object is not a reason to keep the row: log and carry on.
    if (storageError) {
      console.error("deleteLesson storage remove failed:", storageError);
    }
  }

  const { error } = await typedFrom(db, "course_lessons")
    .delete()
    .eq("id", lessonId);

  if (error) {
    console.error("deleteLesson failed:", error);
    return { error: "המחיקה נכשלה" };
  }

  revalidateCourse();
  return { success: true };
}
