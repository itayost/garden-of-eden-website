"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";

/** Rows per page when reading completions; stays inside PostgREST's row cap. */
const PROGRESS_PAGE_SIZE = 1000;

export interface TraineeCourseProgress {
  userId: string;
  fullName: string;
  /** Published lessons this trainee has finished. */
  doneCount: number;
  /** ISO timestamp of their most recent completion, or null if they never started. */
  lastActivityAt: string | null;
}

export interface CourseProgressReport {
  courseTitleHe: string;
  /** Published lessons in the course -- the denominator for every row. */
  lessonTotal: number;
  trainees: TraineeCourseProgress[];
}

/**
 * Who has watched what, for staff.
 *
 * Trainers read this to chase up trainees who have not started. It counts only
 * published lessons, so unpublishing a lesson does not leave people showing as
 * "12 of 11" complete.
 */
export async function getCourseProgressReport(): Promise<CourseProgressReport | null> {
  const { error } = await verifyAdminOrTrainer();
  if (error) return null;

  const db = createAdminClient();

  const { data: courses, error: courseError } = await typedFrom(db, "courses")
    .select("id, title_he")
    .order("order_index", { ascending: true })
    .limit(1);

  if (courseError) {
    console.error("getCourseProgressReport course failed:", courseError);
    return null;
  }

  const course = courses?.[0];
  if (!course) return null;

  const { data: chapters, error: chapterError } = await typedFrom(
    db,
    "course_chapters"
  )
    .select("id")
    .eq("course_id", course.id);

  if (chapterError) {
    console.error("getCourseProgressReport chapters failed:", chapterError);
    return null;
  }

  const chapterIds = (chapters ?? []).map((row: { id: string }) => row.id);

  let publishedLessonIds: string[] = [];
  if (chapterIds.length > 0) {
    const { data: lessons, error: lessonError } = await typedFrom(
      db,
      "course_lessons"
    )
      .select("id")
      .in("chapter_id", chapterIds)
      .eq("is_published", true);

    if (lessonError) {
      console.error("getCourseProgressReport lessons failed:", lessonError);
      return null;
    }
    publishedLessonIds = (lessons ?? []).map((row: { id: string }) => row.id);
  }

  const { data: profiles, error: profileError } = await typedFrom(db, "profiles")
    .select("id, full_name")
    .eq("role", "trainee")
    .is("deleted_at", null)
    .order("full_name", { ascending: true });

  if (profileError) {
    console.error("getCourseProgressReport profiles failed:", profileError);
    return null;
  }

  const doneByUser = new Map<string, { count: number; last: string | null }>();

  if (publishedLessonIds.length > 0) {
    // One row per (trainee, completed lesson): the whole cohort times the whole
    // course runs into the thousands, well past PostgREST's default row cap, so
    // this has to be paged or the report silently under-counts.
    for (let offset = 0; ; offset += PROGRESS_PAGE_SIZE) {
      const { data: progress, error: progressError } = await typedFrom(
        db,
        "course_lesson_progress"
      )
        .select("user_id, completed_at")
        .in("lesson_id", publishedLessonIds)
        .not("completed_at", "is", null)
        .order("id", { ascending: true })
        .range(offset, offset + PROGRESS_PAGE_SIZE - 1);

      if (progressError) {
        console.error("getCourseProgressReport progress failed:", progressError);
        return null;
      }

      const rows = (progress ?? []) as {
        user_id: string;
        completed_at: string;
      }[];

      for (const row of rows) {
        const entry = doneByUser.get(row.user_id) ?? { count: 0, last: null };
        entry.count += 1;
        if (entry.last === null || row.completed_at > entry.last) {
          entry.last = row.completed_at;
        }
        doneByUser.set(row.user_id, entry);
      }

      if (rows.length < PROGRESS_PAGE_SIZE) break;
    }
  }

  const trainees: TraineeCourseProgress[] = (
    (profiles ?? []) as { id: string; full_name: string | null }[]
  ).map((profile) => {
    const entry = doneByUser.get(profile.id);
    return {
      userId: profile.id,
      fullName: profile.full_name ?? "ללא שם",
      doneCount: entry?.count ?? 0,
      lastActivityAt: entry?.last ?? null,
    };
  });

  return {
    courseTitleHe: course.title_he,
    lessonTotal: publishedLessonIds.length,
    trainees,
  };
}
