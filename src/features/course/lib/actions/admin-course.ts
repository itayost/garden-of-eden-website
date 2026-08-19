"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { verifyAdmin } from "@/lib/actions/shared";
import { isValidUUID } from "@/lib/validations/common";
import { reorderSchema } from "@/lib/validations/course";

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
 * Rename a chapter. Supplying a real title is what clears the placeholder flag,
 * which is in turn what lets its lessons be published.
 */
export async function renameChapter(
  chapterId: string,
  titleHe: string,
  subtitleHe?: string | null
): Promise<CourseActionResult> {
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };
  if (!isValidUUID(chapterId)) return { error: "מזהה פרק לא תקין" };

  const titleError = validateTitle(titleHe);
  if (titleError) return { error: titleError };

  const subtitle = optionalText(subtitleHe);

  const db = createAdminClient();
  const { error } = await typedFrom(db, "course_chapters")
    .update({
      title_he: titleHe.trim(),
      ...(subtitle.present ? { subtitle_he: subtitle.value } : {}),
      needs_title: false,
    })
    .eq("id", chapterId);

  if (error) {
    console.error("renameChapter failed:", error);
    return { error: "שמירה נכשלה" };
  }

  revalidateCourse();
  return { success: true };
}

/** Rename a lesson, clearing its placeholder flag. */
export async function renameLesson(
  lessonId: string,
  titleHe: string,
  descriptionHe?: string | null
): Promise<CourseActionResult> {
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };
  if (!isValidUUID(lessonId)) return { error: "מזהה שיעור לא תקין" };

  const titleError = validateTitle(titleHe);
  if (titleError) return { error: titleError };

  const description = optionalText(descriptionHe);

  const db = createAdminClient();
  const { error } = await typedFrom(db, "course_lessons")
    .update({
      title_he: titleHe.trim(),
      ...(description.present ? { description_he: description.value } : {}),
      needs_title: false,
    })
    .eq("id", lessonId);

  if (error) {
    console.error("renameLesson failed:", error);
    return { error: "שמירה נכשלה" };
  }

  revalidateCourse();
  return { success: true };
}

/** Rename the course itself. */
export async function renameCourse(
  courseId: string,
  titleHe: string,
  descriptionHe?: string | null
): Promise<CourseActionResult> {
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };
  if (!isValidUUID(courseId)) return { error: "מזהה קורס לא תקין" };

  const titleError = validateTitle(titleHe);
  if (titleError) return { error: titleError };

  const description = optionalText(descriptionHe);

  const db = createAdminClient();
  const { error } = await typedFrom(db, "courses")
    .update({
      title_he: titleHe.trim(),
      ...(description.present ? { description_he: description.value } : {}),
      needs_title: false,
    })
    .eq("id", courseId);

  if (error) {
    console.error("renameCourse failed:", error);
    return { error: "שמירה נכשלה" };
  }

  revalidateCourse();
  return { success: true };
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

  const db = createAdminClient();
  const { error } = await typedFrom(db, "course_lessons")
    .update({ is_published: isPublished })
    .eq("id", lessonId);

  if (error) {
    if (error.code === "23514") {
      return { error: "אי אפשר לפרסם שיעור בלי שם או בלי וידאו" };
    }
    console.error("setLessonPublished failed:", error);
    return { error: "שמירה נכשלה" };
  }

  revalidateCourse();
  return { success: true };
}

/** Publish or unpublish the whole course -- the single gate trainees see. */
export async function setCoursePublished(
  courseId: string,
  isPublished: boolean
): Promise<CourseActionResult> {
  const { error: authError } = await verifyAdmin();
  if (authError) return { error: authError };
  if (!isValidUUID(courseId)) return { error: "מזהה קורס לא תקין" };

  const db = createAdminClient();
  const { error } = await typedFrom(db, "courses")
    .update({ is_published: isPublished })
    .eq("id", courseId);

  if (error) {
    if (error.code === "23514") {
      return { error: "אי אפשר לפרסם קורס בלי שם" };
    }
    console.error("setCoursePublished failed:", error);
    return { error: "שמירה נכשלה" };
  }

  revalidateCourse();
  return { success: true };
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
