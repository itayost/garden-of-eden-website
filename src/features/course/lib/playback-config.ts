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
 * Two key shapes coexist in this bucket, and the difference is meaningful:
 *
 *   `{chapter}/{lesson}.720p.mp4` + `.480p.mp4` — produced by
 *     `scripts/transcode-course.ts`, which derives keys from the source tree, so
 *     a lesson from the pipeline has two renditions.
 *   `{chapter}/{lesson}.mp4` — this function. A CMS upload is whatever file Eden
 *     picked, so there is exactly one rendition and no quality suffix to claim
 *     otherwise.
 *
 * Anything reading a key treats it as opaque; only the writers care.
 */
export function cmsVideoPath(chapterSlug: string, lessonSlug: string): string {
  return `${chapterSlug}/${lessonSlug}.mp4`;
}
