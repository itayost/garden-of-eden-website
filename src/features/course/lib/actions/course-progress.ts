"use server";

import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import { isValidUUID } from "@/lib/validations/common";
import { lessonProgressSchema } from "@/lib/validations/course";
import { checkRateLimit } from "@/lib/rate-limit";
import { shouldMarkComplete } from "../progress-utils";
import { grantCourseBadges } from "../grant-course-badges";

interface ProgressResult {
  success: boolean;
  completed: boolean;
  error?: string;
}

interface ExistingProgress {
  watched_sec: number;
  completed_at: string | null;
}

/**
 * The lesson's duration plus this trainee's own progress row, in one round trip.
 *
 * `course_lesson_progress` embeds as an array because a trainee who has never
 * opened the lesson has no row; the lesson itself still comes back either way,
 * so an empty array means "no progress yet" rather than "no such lesson".
 */
interface LessonWithProgress {
  duration_sec: number;
  course_lesson_progress: ExistingProgress[];
}

const LESSON_WITH_PROGRESS =
  "duration_sec, course_lesson_progress(watched_sec, completed_at)";

/**
 * Read the lesson and the caller's progress together.
 *
 * The embedded filter on `user_id` is required, not merely defensive: staff may
 * SELECT every trainee's progress, so without it their own write would embed the
 * whole cohort's rows for that lesson and pick an arbitrary one.
 */
async function readLessonWithProgress(
  supabase: Awaited<ReturnType<typeof createClient>>,
  lessonId: string,
  userId: string
): Promise<
  | { ok: true; durationSec: number; existing: ExistingProgress | null }
  | { ok: false; error: string }
> {
  const { data, error } = (await typedFrom(supabase, "course_lessons")
    .select(LESSON_WITH_PROGRESS)
    .eq("id", lessonId)
    .eq("is_published", true)
    .eq("course_lesson_progress.user_id", userId)
    .maybeSingle()) as { data: LessonWithProgress | null; error: unknown };

  // A failed read must not be mistaken for "no progress yet": that would send
  // watched_sec backwards and, worse, clear a completion stamp.
  if (error) {
    console.error("readLessonWithProgress failed:", error);
    return { ok: false, error: "שמירה נכשלה" };
  }
  // RLS hides drafts and anything the caller may not read, so a miss here means
  // "no access" just as much as "no such lesson".
  if (!data) return { ok: false, error: "שיעור לא נמצא" };

  return {
    ok: true,
    durationSec: data.duration_sec ?? 0,
    existing: data.course_lesson_progress[0] ?? null,
  };
}

/**
 * Record where the trainee has reached in a lesson.
 *
 * The player calls this every 15 s, on pause and on visibilitychange, so it has
 * to be cheap and idempotent. The client's reported position is clamped against
 * the lesson's real duration from the database -- a client claiming it watched
 * an hour of a four-minute lesson must not be able to mark it complete.
 */
export async function updateLessonProgress(
  lessonId: string,
  positionSec: number
): Promise<ProgressResult> {
  const parsed = lessonProgressSchema.safeParse({
    lesson_id: lessonId,
    position_sec: Math.floor(positionSec),
  });
  if (!parsed.success) {
    return {
      success: false,
      completed: false,
      error: parsed.error.issues[0]?.message ?? "נתונים לא תקינים",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, completed: false, error: "לא מחובר" };
  }

  // The player drives this every 15 s, so it is the one write a trainee can
  // trigger at will. The general limiter (100/min) is far above the ~4/min a
  // real player produces and fails open, so a Redis outage cannot stop playback
  // progress being recorded.
  const rate = await checkRateLimit(user.id, "general");
  void rate.pending.catch(() => {});
  if (rate.rateLimited) {
    return { success: false, completed: false, error: "יותר מדי בקשות, נסה שוב" };
  }

  const read = await readLessonWithProgress(
    supabase,
    parsed.data.lesson_id,
    user.id
  );
  if (!read.ok) {
    return { success: false, completed: false, error: read.error };
  }

  const { durationSec, existing } = read;
  const clampedPosition =
    durationSec > 0
      ? Math.min(parsed.data.position_sec, durationSec)
      : parsed.data.position_sec;

  const alreadyComplete = existing?.completed_at != null;
  const nowComplete =
    alreadyComplete || shouldMarkComplete(clampedPosition, durationSec);

  // watched_sec only ever grows, so re-watching from the start does not undo
  // the record of how far they got.
  const watchedSec = Math.max(existing?.watched_sec ?? 0, clampedPosition);

  // completed_at is written only on the transition to complete. Omitting the
  // column otherwise leaves it untouched by the ON CONFLICT update, so a tick
  // whose read predates a concurrent "סיימתי" cannot wipe the stamp.
  const stampCompletion = nowComplete && !alreadyComplete;

  const { error } = await typedFrom(supabase, "course_lesson_progress").upsert(
    {
      user_id: user.id,
      lesson_id: parsed.data.lesson_id,
      last_position_sec: clampedPosition,
      watched_sec: watchedSec,
      ...(stampCompletion ? { completed_at: new Date().toISOString() } : {}),
    },
    { onConflict: "user_id,lesson_id" }
  );

  if (error) {
    console.error("updateLessonProgress failed:", error);
    return { success: false, completed: alreadyComplete, error: "שמירה נכשלה" };
  }

  // Badges are granted only on the transition, and never allowed to fail the
  // write that triggered them.
  if (stampCompletion) {
    await grantCourseBadges(supabase, user.id, parsed.data.lesson_id);
  }

  return { success: true, completed: nowComplete };
}

/**
 * Mark a lesson finished from the "סיימתי" button, regardless of position.
 * Idempotent: completing an already-complete lesson keeps the original stamp.
 */
export async function markLessonComplete(
  lessonId: string
): Promise<ProgressResult> {
  if (!isValidUUID(lessonId)) {
    return { success: false, completed: false, error: "מזהה שיעור לא תקין" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { success: false, completed: false, error: "לא מחובר" };
  }

  // Limited for the same reason as updateLessonProgress, and more so: this path
  // costs two reads, an upsert and then the badge sweep.
  const rate = await checkRateLimit(user.id, "general");
  void rate.pending.catch(() => {});
  if (rate.rateLimited) {
    return { success: false, completed: false, error: "יותר מדי בקשות, נסה שוב" };
  }

  const read = await readLessonWithProgress(supabase, lessonId, user.id);
  if (!read.ok) {
    return { success: false, completed: false, error: read.error };
  }

  const { durationSec, existing } = read;

  if (existing?.completed_at) {
    return { success: true, completed: true };
  }

  const { error } = await typedFrom(supabase, "course_lesson_progress").upsert(
    {
      user_id: user.id,
      lesson_id: lessonId,
      last_position_sec: existing?.watched_sec ?? 0,
      watched_sec: Math.max(existing?.watched_sec ?? 0, durationSec),
      completed_at: new Date().toISOString(),
    },
    { onConflict: "user_id,lesson_id" }
  );

  if (error) {
    console.error("markLessonComplete failed:", error);
    return { success: false, completed: false, error: "שמירה נכשלה" };
  }

  await grantCourseBadges(supabase, user.id, lessonId);

  return { success: true, completed: true };
}
