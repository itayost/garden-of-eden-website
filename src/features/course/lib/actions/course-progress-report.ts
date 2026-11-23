"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { readInChunks } from "@/lib/supabase/in-chunks";
import { getBranchScopeAction } from "@/lib/actions/shared";
import { visibleProfileIds } from "@/features/branches/lib/memberships";
import {
  courseLessonsInOrder,
  tallyLessonViews,
  tallyTraineeProgress,
  type LessonProgressRow,
  type LessonViews,
  type ReportLesson,
  type TraineeCourseProgress,
} from "../lesson-views";

type Db = ReturnType<typeof createAdminClient>;

export interface CourseProgressReport {
  courseTitleHe: string;
  /** Published lessons in the course -- the denominator for every row. */
  lessonTotal: number;
  trainees: TraineeCourseProgress[];
  /** Every published lesson in course order, with who started and finished it. */
  lessons: LessonViews[];
}

/** The course's published lessons in order, or null when a read failed. */
async function readPublishedLessons(db: Db, courseId: string): Promise<ReportLesson[] | null> {
  const { data: chapters, error: chapterError } = await typedFrom(db, "course_chapters")
    .select("id, title_he, order_index")
    .eq("course_id", courseId);
  if (chapterError) {
    console.error("getCourseProgressReport chapters failed:", chapterError);
    return null;
  }

  const chapterRows = (chapters ?? []) as { id: string; title_he: string; order_index: number }[];
  if (chapterRows.length === 0) return [];

  const { data: lessons, error: lessonError } = await typedFrom(db, "course_lessons")
    .select("id, chapter_id, title_he, order_index")
    .in("chapter_id", chapterRows.map((chapter) => chapter.id))
    .eq("is_published", true);
  if (lessonError) {
    console.error("getCourseProgressReport lessons failed:", lessonError);
    return null;
  }

  const lessonRows = (lessons ?? []) as {
    id: string;
    chapter_id: string;
    title_he: string;
    order_index: number;
  }[];
  return courseLessonsInOrder(
    chapterRows.map((c) => ({ id: c.id, titleHe: c.title_he, orderIndex: c.order_index })),
    lessonRows.map((l) => ({
      id: l.id,
      chapterId: l.chapter_id,
      titleHe: l.title_he,
      orderIndex: l.order_index,
    })),
  );
}

/** The live trainees this caller may see, by name, or null when a read failed. */
async function readVisibleTrainees(
  db: Db,
  ids: string[] | null,
): Promise<{ userId: string; fullName: string }[] | null> {
  const { data, error } = await readInChunks<{ id: string; full_name: string | null }>(
    ids,
    "id",
    () =>
      typedFrom(db, "profiles")
        .select("id, full_name")
        .eq("role", "trainee")
        .is("deleted_at", null)
        .order("id", { ascending: true }),
  );
  if (error) {
    console.error("getCourseProgressReport profiles failed:", error);
    return null;
  }

  const hebrewNames = new Intl.Collator("he");
  return data
    .map((profile) => ({ userId: profile.id, fullName: profile.full_name ?? "ללא שם" }))
    .sort((a, b) => hebrewNames.compare(a.fullName, b.fullName));
}

/**
 * Every progress row on these lessons. One row per trainee and lesson played
 * runs well past PostgREST's 1000-row cap, so it is read page by page.
 */
async function readProgressRows(db: Db, lessonIds: string[]): Promise<LessonProgressRow[] | null> {
  if (lessonIds.length === 0) return [];
  const { data, error } = await readInChunks<{
    lesson_id: string;
    user_id: string;
    watched_sec: number;
    completed_at: string | null;
  }>(lessonIds, "lesson_id", () =>
    typedFrom(db, "course_lesson_progress")
      .select("lesson_id, user_id, watched_sec, completed_at")
      .order("id", { ascending: true }),
  );
  if (error) {
    console.error("getCourseProgressReport progress failed:", error);
    return null;
  }
  return data.map((row) => ({
    lessonId: row.lesson_id,
    userId: row.user_id,
    watchedSec: row.watched_sec,
    completedAt: row.completed_at,
  }));
}

/**
 * Who has watched what, for staff: per trainee (to chase up those who have
 * not started) and per lesson (how many watched it, and who). An admin sees
 * every trainee; a trainer only their own branches' trainees. Only published
 * lessons count, so unpublishing one does not leave people at "12 of 11".
 */
export async function getCourseProgressReport(slug: string): Promise<CourseProgressReport | null> {
  const scopeResult = await getBranchScopeAction();
  if ("error" in scopeResult) return null;

  const db = createAdminClient();

  const { data: course, error: courseError } = await typedFrom(db, "courses")
    .select("id, title_he")
    .eq("slug", slug)
    .maybeSingle();
  if (courseError) {
    console.error("getCourseProgressReport course failed:", courseError);
    return null;
  }
  if (!course) return null;

  const lessons = await readPublishedLessons(db, course.id);
  if (lessons === null) return null;

  const visibleIds = await visibleProfileIds(db, scopeResult.data.scope, undefined);
  const lessonIds = lessons.map((lesson) => lesson.id);
  const [trainees, rows] = await Promise.all([
    readVisibleTrainees(db, visibleIds),
    readProgressRows(db, lessonIds),
  ]);
  if (trainees === null || rows === null) return null;

  const names = new Map(trainees.map((trainee) => [trainee.userId, trainee.fullName]));
  return {
    courseTitleHe: course.title_he,
    lessonTotal: lessons.length,
    trainees: tallyTraineeProgress(trainees, new Set(lessonIds), rows),
    lessons: tallyLessonViews(lessons, rows, names),
  };
}
