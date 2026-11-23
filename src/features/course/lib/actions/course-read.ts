"use server";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import type {
  CourseChapterWithLessons,
  CourseLesson,
  CourseWithChapters,
  LessonProgress,
  LessonProgressMap,
} from "../types";
import type { CourseViewer } from "../course-access-rule";
import { COURSE_VIEWER_COLUMNS, courseViewerFromProfile } from "../course-viewer";
import { coverUrlOrNull } from "../course-cover-rules";

// --- Raw DB row shapes (snake_case) ---

interface RawCourse {
  id: string;
  slug: string;
  title_he: string;
  description_he: string | null;
  cover_url: string | null;
  is_published: boolean;
  needs_title: boolean;
  order_index: number;
  active_only: boolean;
}

interface RawChapter {
  id: string;
  course_id: string;
  slug: string;
  title_he: string;
  subtitle_he: string | null;
  needs_title: boolean;
  order_index: number;
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

interface RawProgress {
  lesson_id: string;
  last_position_sec: number;
  watched_sec: number;
  completed_at: string | null;
}

function toLesson(row: RawLesson): CourseLesson {
  return {
    id: row.id,
    chapterId: row.chapter_id,
    slug: row.slug,
    titleHe: row.title_he,
    descriptionHe: row.description_he,
    videoPath: row.video_path,
    videoPathSd: row.video_path_sd,
    durationSec: row.duration_sec,
    needsTitle: row.needs_title,
    isPublished: row.is_published,
    orderIndex: row.order_index,
  };
}

/**
 * Load the published course with its chapters and lessons.
 *
 * RLS already hides drafts from trainees; the explicit `is_published` filters
 * keep the trainee view identical for staff, who can otherwise see drafts.
 */
export async function getPublishedCourse(
  slug: string
): Promise<CourseWithChapters | null> {
  const supabase = await createClient();

  const { data: courseRow, error: courseError } = await typedFrom(supabase, "courses")
    .select("*")
    .eq("slug", slug)
    .eq("is_published", true)
    .maybeSingle();
  if (courseError) {
    console.error("getPublishedCourse failed:", courseError);
    return null;
  }

  const course = courseRow as RawCourse | null;
  if (!course) return null;

  const { data: chapterRows, error: chapterError } = await typedFrom(
    supabase,
    "course_chapters"
  )
    .select("*")
    .eq("course_id", course.id)
    .order("order_index", { ascending: true });

  if (chapterError) {
    console.error("getPublishedCourse chapters failed:", chapterError);
    return null;
  }

  const chapters = (chapterRows ?? []) as RawChapter[];
  if (chapters.length === 0) {
    return { ...toCourse(course), chapters: [] };
  }

  const { data: lessonRows, error: lessonError } = await typedFrom(
    supabase,
    "course_lessons"
  )
    .select("*")
    .in(
      "chapter_id",
      chapters.map((c) => c.id)
    )
    .eq("is_published", true)
    .order("order_index", { ascending: true });

  if (lessonError) {
    console.error("getPublishedCourse lessons failed:", lessonError);
    return null;
  }

  const lessonsByChapter = new Map<string, CourseLesson[]>();
  for (const row of (lessonRows ?? []) as RawLesson[]) {
    const list = lessonsByChapter.get(row.chapter_id) ?? [];
    list.push(toLesson(row));
    lessonsByChapter.set(row.chapter_id, list);
  }

  const withLessons: CourseChapterWithLessons[] = chapters.map((chapter) => ({
    id: chapter.id,
    courseId: chapter.course_id,
    slug: chapter.slug,
    titleHe: chapter.title_he,
    subtitleHe: chapter.subtitle_he,
    needsTitle: chapter.needs_title,
    orderIndex: chapter.order_index,
    lessons: lessonsByChapter.get(chapter.id) ?? [],
  }));

  return { ...toCourse(course), chapters: withLessons };
}

/** A stored cover that fails the cover check is shown as no cover. */
function toCourse(row: RawCourse) {
  return {
    id: row.id,
    slug: row.slug,
    titleHe: row.title_he,
    descriptionHe: row.description_he,
    coverUrl: coverUrlOrNull(
      row.cover_url ?? null,
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      row.id
    ),
    isPublished: row.is_published,
    needsTitle: row.needs_title,
    orderIndex: row.order_index,
    activeOnly: row.active_only === true,
  };
}

/**
 * The signed-in trainee's progress across every lesson, keyed by lesson id.
 * RLS restricts this to their own rows, so no user id needs passing in.
 */
export async function getMyLessonProgress(): Promise<LessonProgressMap> {
  const userId = await getCourseUserId();
  if (!userId) return {};
  const supabase = await createClient();

  const { data, error } = await typedFrom(supabase, "course_lesson_progress")
    .select("lesson_id, last_position_sec, watched_sec, completed_at")
    .eq("user_id", userId);

  if (error) {
    console.error("getMyLessonProgress failed:", error);
    return {};
  }

  const map: Record<string, LessonProgress> = {};
  for (const row of (data ?? []) as RawProgress[]) {
    map[row.lesson_id] = {
      lessonId: row.lesson_id,
      lastPositionSec: row.last_position_sec,
      watchedSec: row.watched_sec,
      completedAt: row.completed_at,
    };
  }
  return map;
}

/** The signed-in user's id, or null. Memoized per request so it is read once. */
export const getCourseUserId = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
});

/**
 * The signed-in viewer as canOpenCourse sees him: role, `is_active` (for the
 * old rule), the seen-training day, the admin mark, and whether he counts as a
 * digital course buyer (`arbox_bought_course` or an `access_override` of
 * course_only; `courseViewerFromProfile`). Nobody signed in, no profile row, a
 * soft-deleted profile or a failed read reads as a viewer with no role, which
 * the rule locks once it is on. Memoized per request with React `cache()`, like
 * verifyAdmin: a course page and its playback check would otherwise each pay an
 * auth.getUser() plus a profiles read.
 */
export const getCourseViewer = cache(async (): Promise<CourseViewer> => {
  const userId = await getCourseUserId();
  if (!userId) return courseViewerFromProfile(null);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(COURSE_VIEWER_COLUMNS)
    .eq("id", userId)
    .is("deleted_at", null)
    .maybeSingle();
  if (error) console.error("getCourseViewer failed:", error);
  return courseViewerFromProfile(data ?? null);
});
