"use server";

import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import type {
  CourseChapterWithLessons,
  CourseLesson,
  CourseWithChapters,
  LessonProgress,
  LessonProgressMap,
} from "../types";

// --- Raw DB row shapes (snake_case) ---

interface RawCourse {
  id: string;
  slug: string;
  title_he: string;
  description_he: string | null;
  is_published: boolean;
  needs_title: boolean;
  order_index: number;
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
  slug?: string
): Promise<CourseWithChapters | null> {
  const supabase = await createClient();

  let courseQuery = typedFrom(supabase, "courses")
    .select("*")
    .eq("is_published", true)
    .order("order_index", { ascending: true })
    .limit(1);

  if (slug) courseQuery = courseQuery.eq("slug", slug);

  const { data: courseRows, error: courseError } = await courseQuery;
  if (courseError) {
    console.error("getPublishedCourse failed:", courseError);
    return null;
  }

  const course = (courseRows as RawCourse[] | null)?.[0];
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

function toCourse(row: RawCourse) {
  return {
    id: row.id,
    slug: row.slug,
    titleHe: row.title_he,
    descriptionHe: row.description_he,
    isPublished: row.is_published,
    needsTitle: row.needs_title,
    orderIndex: row.order_index,
  };
}

/**
 * The signed-in trainee's progress across every lesson, keyed by lesson id.
 * RLS restricts this to their own rows, so no user id needs passing in.
 */
export async function getMyLessonProgress(): Promise<LessonProgressMap> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return {};

  const { data, error } = await typedFrom(supabase, "course_lesson_progress")
    .select("lesson_id, last_position_sec, watched_sec, completed_at")
    .eq("user_id", user.id);

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
