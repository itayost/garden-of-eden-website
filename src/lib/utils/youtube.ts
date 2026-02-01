/**
 * YouTube URL utilities for extracting video IDs and generating URLs
 *
 * Supports multiple YouTube URL formats:
 * - youtube.com/watch?v=VIDEO_ID
 * - youtube.com/shorts/VIDEO_ID
 * - youtu.be/VIDEO_ID
 * - youtube.com/embed/VIDEO_ID
 */

/**
 * Extract YouTube video ID from various URL formats
 *
 * @param url - YouTube URL in any supported format
 * @returns 11-character video ID or null if invalid
 *
 * @example
 * getYouTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ") // "dQw4w9WgXcQ"
 * getYouTubeId("https://youtu.be/dQw4w9WgXcQ") // "dQw4w9WgXcQ"
 * getYouTubeId("https://youtube.com/shorts/dQw4w9WgXcQ") // "dQw4w9WgXcQ"
 * getYouTubeId("https://youtube.com/embed/dQw4w9WgXcQ") // "dQw4w9WgXcQ"
 * getYouTubeId("invalid-url") // null
 */
export function getYouTubeId(url: string): string | null {
  const match = url.match(
    /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/(?:shorts\/)?)([a-zA-Z0-9_-]{11})/
  );
  return match ? match[1] : null;
}

/**
 * Thumbnail quality options for YouTube videos
 * - default: 120x90
 * - mqdefault: 320x180 (recommended)
 * - hqdefault: 480x360
 * - sddefault: 640x480
 * - maxresdefault: 1280x720 (may not exist for all videos)
 */
export type ThumbnailQuality =
  | "default"
  | "mqdefault"
  | "hqdefault"
  | "sddefault"
  | "maxresdefault";

/**
 * Get YouTube thumbnail URL from video ID
 *
 * @param videoId - 11-character YouTube video ID
 * @param quality - Thumbnail quality (default: "mqdefault" for 320x180)
 * @returns Thumbnail URL from img.youtube.com
 *
 * @example
 * getYouTubeThumbnail("dQw4w9WgXcQ") // "https://img.youtube.com/vi/dQw4w9WgXcQ/mqdefault.jpg"
 * getYouTubeThumbnail("dQw4w9WgXcQ", "hqdefault") // "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg"
 */
export function getYouTubeThumbnail(
  videoId: string,
  quality: ThumbnailQuality = "mqdefault"
): string {
  return `https://img.youtube.com/vi/${videoId}/${quality}.jpg`;
}

/**
 * Get YouTube embed URL for iframe embedding
 *
 * @param videoId - 11-character YouTube video ID
 * @param autoplay - Whether to autoplay the video (default: false)
 * @returns Embed URL for use in iframe src
 *
 * @example
 * getYouTubeEmbedUrl("dQw4w9WgXcQ") // "https://www.youtube.com/embed/dQw4w9WgXcQ"
 * getYouTubeEmbedUrl("dQw4w9WgXcQ", true) // "https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1"
 */
export function getYouTubeEmbedUrl(videoId: string, autoplay = false): string {
  return `https://www.youtube.com/embed/${videoId}${autoplay ? "?autoplay=1" : ""}`;
}
