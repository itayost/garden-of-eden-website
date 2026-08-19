"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { isValidUUID } from "@/lib/validations/common";
import type { VideoQuality } from "../types";
import { COURSE_VIDEO_BUCKET, PLAYBACK_URL_TTL_SEC } from "../playback-config";

interface PlaybackResult {
  url: string | null;
  quality: VideoQuality | null;
  error?: string;
}

interface LessonVideoRow {
  video_path: string | null;
  video_path_sd: string | null;
}

/**
 * Mint a short-lived signed URL for one lesson's video.
 *
 * The order here is the whole security model:
 *   1. The caller must be signed in.
 *   2. The lesson is read through the *request-scoped* client, so RLS decides
 *      whether this caller may see it at all. For a trainee a draft, or a lesson
 *      under an unpublished course, simply is not found; staff may preview one,
 *      which they must be able to do since a lesson cannot be published without
 *      a video in the first place. Do not re-add an `is_published` filter here.
 *   3. Only after that does the service-role client sign the URL.
 *
 * The service-role key never leaves the server, and the returned URL grants
 * access to exactly one object for a bounded time.
 */
export async function getLessonPlaybackUrl(
  lessonId: string,
  quality: VideoQuality = "hd"
): Promise<PlaybackResult> {
  if (!isValidUUID(lessonId)) {
    return { url: null, quality: null, error: "מזהה שיעור לא תקין" };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { url: null, quality: null, error: "לא מחובר" };
  }

  const { data: lesson, error: lessonError } = (await typedFrom(
    supabase,
    "course_lessons"
  )
    .select("video_path, video_path_sd")
    .eq("id", lessonId)
    .maybeSingle()) as { data: LessonVideoRow | null; error: unknown };

  if (lessonError) {
    console.error("getLessonPlaybackUrl lookup failed:", lessonError);
    return { url: null, quality: null, error: "טעינת השיעור נכשלה" };
  }
  if (!lesson) {
    return { url: null, quality: null, error: "שיעור לא נמצא" };
  }

  // Fall back to whichever rendition exists rather than failing outright.
  const requested = quality === "sd" ? lesson.video_path_sd : lesson.video_path;
  const fallback = quality === "sd" ? lesson.video_path : lesson.video_path_sd;
  const path = requested ?? fallback;
  const servedQuality: VideoQuality | null =
    requested != null ? quality : fallback != null ? (quality === "sd" ? "hd" : "sd") : null;

  if (!path || !servedQuality) {
    return { url: null, quality: null, error: "לשיעור זה עדיין אין וידאו" };
  }

  const admin = createAdminClient();
  const { data, error } = await admin.storage
    .from(COURSE_VIDEO_BUCKET)
    .createSignedUrl(path, PLAYBACK_URL_TTL_SEC);

  if (error || !data?.signedUrl) {
    console.error("getLessonPlaybackUrl signing failed:", error);
    return { url: null, quality: null, error: "לא ניתן לנגן את השיעור כרגע" };
  }

  return { url: data.signedUrl, quality: servedQuality };
}
