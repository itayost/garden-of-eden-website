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
