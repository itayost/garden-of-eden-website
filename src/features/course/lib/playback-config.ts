/**
 * Playback constants for the trainee video course.
 *
 * These live outside the `"use server"` action module on purpose: Next.js only
 * allows async function exports from a server-action file, so a plain string or
 * number exported from there fails the build the moment anything imports it.
 */

export const COURSE_VIDEO_BUCKET = "course-videos";

/**
 * How long a playback URL stays valid. Long enough to watch the longest lesson
 * several times over without a refresh, short enough that a leaked link dies
 * the same day.
 */
export const PLAYBACK_URL_TTL_SEC = 2 * 60 * 60;

/**
 * Storage key for a video uploaded through the CMS.
 *
 * Key shapes coexist in this bucket, and the difference is meaningful:
 *
 *   `{chapter}/{lesson}.720p.mp4` + `.480p.mp4` — produced by
 *     `scripts/transcode-course.ts`, which derives keys from the source tree, so
 *     a lesson from the pipeline has two renditions.
 *   `cms/{lessonId}.mp4` — this function. A CMS upload is whatever file was
 *     picked, so there is exactly one rendition. It is keyed by lesson id
 *     because chapter slugs are unique only within a course, and a slug path
 *     let two courses overwrite each other. Older CMS uploads keep their
 *     `{chapter}/{lesson}.mp4` key, stored on the lesson.
 *
 * Anything reading a key treats it as opaque; only the writers care.
 */
export function cmsVideoPath(lessonId: string): string {
  return `cms/${lessonId}.mp4`;
}

/** Matches course-videos.file_size_limit (raised to 2 GB for Zoom recordings). */
export const MAX_LESSON_VIDEO_BYTES = 2 * 1024 ** 3;
