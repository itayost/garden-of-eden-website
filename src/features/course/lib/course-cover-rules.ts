/** Pure rules for a course's cover image. */

/**
 * The largest cover the upload route takes. Vercel refuses a request body over
 * 4.5 MB before the route runs, so the cap stays under it; the browser
 * compresses a phone photo well below it first.
 */
export const MAX_COVER_BYTES = 4 * 1024 * 1024;

const COVER_EXTENSIONS: Readonly<Record<string, string>> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const COVER_MIME_TYPES = Object.keys(COVER_EXTENSIONS);

/** Why a file's type cannot be a cover, in Hebrew, or null when it can. */
export function coverTypeProblem(type: string): string | null {
  return type in COVER_EXTENSIONS ? null : "אפשר להעלות רק תמונות JPEG, PNG או WebP";
}

/** Why a file cannot be a cover, in Hebrew, or null when it can. */
export function coverFileProblem(file: {
  readonly type: string;
  readonly size: number;
}): string | null {
  const typeProblem = coverTypeProblem(file.type);
  if (typeProblem) return typeProblem;
  if (file.size <= 0) return "הקובץ ריק";
  if (file.size > MAX_COVER_BYTES) return "התמונה גדולה מדי (עד 4MB)";
  return null;
}

const COVER_FOLDER = "course-covers";

/** Where a cover is stored in the avatars bucket. */
export function coverStoragePath(
  courseId: string,
  timestamp: number,
  mimeType: string
): string {
  return `${COVER_FOLDER}/${courseId.toLowerCase()}/${timestamp}.${COVER_EXTENSIONS[mimeType] ?? "jpg"}`;
}

const PUBLIC_AVATARS_PATH = "/storage/v1/object/public/avatars/";

/** The one shape a stored cover's path may have: a timestamped image of one course. */
const COVER_PATHNAME =
  /^\/storage\/v1\/object\/public\/avatars\/course-covers\/([0-9a-f-]+)\/\d{1,16}\.(?:jpg|png|webp)$/;

function parseUrl(value: string): URL | null {
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

/**
 * Whether a link may be stored or shown as this course's cover: exactly a file
 * this project's upload route writes for this course, and nothing else. The
 * link must already be in its canonical form (`href` unchanged by parsing), so
 * encoded dot segments, backslashes, an empty `?` or `#` and credentials are
 * refused rather than normalised into something that passes.
 */
export function isAllowedCoverUrl(
  url: string,
  supabaseUrl: string,
  courseId: string
): boolean {
  const parsed = parseUrl(url);
  const project = parseUrl(supabaseUrl);
  if (parsed === null || project === null) return false;
  if (parsed.origin !== project.origin) return false;
  if (parsed.search || parsed.hash || parsed.username || parsed.password) return false;
  if (parsed.href !== url || url !== `${parsed.origin}${parsed.pathname}`) return false;
  const match = COVER_PATHNAME.exec(parsed.pathname);
  return match !== null && match[1] === courseId.toLowerCase();
}

/** A stored cover link when it passes the check, else null (the plain gradient). */
export function coverUrlOrNull(
  stored: string | null,
  supabaseUrl: string,
  courseId: string
): string | null {
  return stored !== null && isAllowedCoverUrl(stored, supabaseUrl, courseId) ? stored : null;
}

/**
 * The avatars-bucket path of this course's cover, or null when the link is not
 * one, so a replaced cover's file can be removed without ever touching another
 * folder.
 */
export function coverObjectPath(
  stored: string | null,
  supabaseUrl: string,
  courseId: string
): string | null {
  if (stored === null || !isAllowedCoverUrl(stored, supabaseUrl, courseId)) return null;
  return new URL(stored).pathname.slice(PUBLIC_AVATARS_PATH.length);
}
