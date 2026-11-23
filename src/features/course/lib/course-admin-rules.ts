/**
 * Pure rules for managing courses, chapters and lessons. The server actions
 * enforce them; the UI only mirrors them.
 */

const MAX_SLUG_LENGTH = 40;

/** Lowercase ASCII, runs of anything else become one dash, edges trimmed. */
function asciiSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/**
 * Slug for a chapter or lesson: padded position plus the ASCII title, or the
 * fallback word when the title (Hebrew) leaves nothing usable. The slug is an
 * identifier, not something anyone reads.
 */
export function positionalSlug(
  titleHe: string,
  position: number,
  fallback: string
): string {
  const ascii = asciiSlug(titleHe);
  const suffix = ascii.length >= 2 ? ascii.slice(0, MAX_SLUG_LENGTH) : fallback;
  return `${String(position).padStart(2, "0")}-${suffix}`;
}

/** A course slug unique across all courses; `-2`, `-3`, ... on collision. */
export function courseSlugFor(
  titleHe: string,
  taken: ReadonlySet<string>
): string {
  const ascii = asciiSlug(titleHe);
  const base = ascii.length >= 2 ? ascii.slice(0, MAX_SLUG_LENGTH) : "course";
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

export function publishCourseProblem(course: {
  needsTitle: boolean;
  publishedLessons: number;
}): string | null {
  if (course.needsTitle) return "יש לתת לקורס שם לפני פרסום";
  if (course.publishedLessons < 1) {
    return "אפשר לפרסם קורס רק כשיש בו לפחות שיעור אחד שפורסם";
  }
  return null;
}

export function deleteCourseProblem(chapters: number): string | null {
  return chapters > 0
    ? "אפשר למחוק רק קורס ריק. כדי להסתיר אותו מהמתאמנים, בטלו את הפרסום"
    : null;
}

export function deleteChapterProblem(lessons: number): string | null {
  return lessons > 0 ? "אפשר למחוק רק פרק ריק" : null;
}

export function validateTitle(title: string): string | null {
  const trimmed = title.trim();
  if (trimmed.length === 0) return "נדרשת כותרת";
  if (trimmed.length > 160) return "כותרת ארוכה מדי";
  return null;
}

/** Optional prose: trimmed, empty becomes null, refused past `max`. */
export function cleanOptionalText(
  value: string | null,
  max: number
): { value: string | null } | { error: string } {
  const trimmed = value?.trim() ?? "";
  if (trimmed.length > max) return { error: "הטקסט ארוך מדי" };
  return { value: trimmed.length > 0 ? trimmed : null };
}
