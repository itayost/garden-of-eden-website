/** Pure rules for a course's cover image. */

export const MAX_COVER_BYTES = 5 * 1024 * 1024;

const COVER_EXTENSIONS: Readonly<Record<string, string>> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const COVER_MIME_TYPES = Object.keys(COVER_EXTENSIONS);

/** Why a file cannot be a cover, in Hebrew, or null when it can. */
export function coverFileProblem(file: {
  readonly type: string;
  readonly size: number;
}): string | null {
  if (!(file.type in COVER_EXTENSIONS)) {
    return "אפשר להעלות רק תמונות JPEG, PNG או WebP";
  }
  if (file.size <= 0) return "הקובץ ריק";
  if (file.size > MAX_COVER_BYTES) return "התמונה גדולה מדי (עד 5MB)";
  return null;
}

/** Where a cover is stored in the avatars bucket. */
export function coverStoragePath(
  courseId: string,
  timestamp: number,
  mimeType: string
): string {
  return `course-covers/${courseId}/${timestamp}.${COVER_EXTENSIONS[mimeType] ?? "jpg"}`;
}

/** Public-URL prefix every stored cover starts with. */
export function coverPrefix(supabaseUrl: string): string {
  return `${supabaseUrl}/storage/v1/object/public/avatars/course-covers/`;
}

/** Only a link into this project's cover folder may be stored on a course. */
export function isAllowedCoverUrl(url: string, supabaseUrl: string): boolean {
  if (!supabaseUrl) return false;
  return url.startsWith(coverPrefix(supabaseUrl)) && !url.includes("..");
}
