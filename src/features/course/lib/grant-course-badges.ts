import type { SupabaseClient } from "@supabase/supabase-js";
import { grantBadge } from "@/features/achievements/lib/actions/grant-badge";
import { typedFrom } from "@/lib/supabase/helpers";

interface LessonRow {
  id: string;
  chapter_id: string;
}

/**
 * Award course badges after a lesson has just been completed.
 *
 * Best-effort by design: badges must never fail the progress write that
 * triggered them, so every error is logged and swallowed. `grantBadge` is
 * idempotent, so re-running is harmless.
 *
 * Deliberately two queries rather than one per chapter -- the whole published
 * lesson set for this course is small enough to reason about in memory.
 */
export async function grantCourseBadges(
  supabase: SupabaseClient,
  userId: string,
  completedLessonId: string
): Promise<void> {
  try {
    await grantBadge(supabase, userId, "course_first_lesson");

    // Which chapter does the finished lesson belong to, and which course?
    const { data: lesson } = await typedFrom(supabase, "course_lessons")
      .select("chapter_id")
      .eq("id", completedLessonId)
      .maybeSingle();

    const chapterId: string | undefined = lesson?.chapter_id;
    if (!chapterId) return;

    const { data: chapter } = await typedFrom(supabase, "course_chapters")
      .select("course_id")
      .eq("id", chapterId)
      .maybeSingle();

    const courseId: string | undefined = chapter?.course_id;
    if (!courseId) return;

    const { data: chapters } = await typedFrom(supabase, "course_chapters")
      .select("id")
      .eq("course_id", courseId);

    const chapterIds: string[] = (chapters ?? []).map(
      (row: { id: string }) => row.id
    );
    if (chapterIds.length === 0) return;

    const { data: lessons } = await typedFrom(supabase, "course_lessons")
      .select("id, chapter_id")
      .in("chapter_id", chapterIds)
      .eq("is_published", true);

    const publishedLessons = (lessons ?? []) as LessonRow[];
    if (publishedLessons.length === 0) return;

    const { data: done } = await typedFrom(supabase, "course_lesson_progress")
      .select("lesson_id")
      .eq("user_id", userId)
      .not("completed_at", "is", null);

    const doneIds = new Set(
      (done ?? []).map((row: { lesson_id: string }) => row.lesson_id)
    );

    const chapterLessons = publishedLessons.filter(
      (row) => row.chapter_id === chapterId
    );
    const chapterDone =
      chapterLessons.length > 0 &&
      chapterLessons.every((row) => doneIds.has(row.id));

    if (chapterDone) {
      await grantBadge(supabase, userId, "course_chapter_complete");
    }

    const courseDone = publishedLessons.every((row) => doneIds.has(row.id));
    if (courseDone) {
      await grantBadge(supabase, userId, "course_complete");
    }
  } catch (error) {
    console.error("grantCourseBadges failed:", error);
  }
}
