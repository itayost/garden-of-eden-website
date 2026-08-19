import { z } from "zod";

/**
 * Validation schemas for the trainee video course CMS.
 *
 * Slugs double as storage-path segments, so they stay ASCII kebab-case even
 * though every human-facing title is Hebrew.
 */

const slug = z
  .string()
  .min(1, "נדרש מזהה")
  .max(80, "מזהה ארוך מדי")
  .regex(/^[a-z0-9-]+$/, "מזהה חייב להכיל אותיות לועזיות קטנות, ספרות ומקפים בלבד");

const titleHe = z.string().min(1, "נדרשת כותרת").max(160, "כותרת ארוכה מדי");

/** Storage key inside the course-videos bucket, e.g. "01-chapter-1/03.720p.mp4". */
const videoPath = z
  .string()
  .min(1)
  .max(300)
  .regex(
    /^[a-z0-9][a-z0-9/._-]*\.mp4$/i,
    "נתיב וידאו לא תקין"
  )
  // Reject anything that could climb out of the bucket prefix.
  .refine((value) => !value.includes(".."), "נתיב וידאו לא תקין");

export const courseSchema = z.object({
  slug,
  title_he: titleHe,
  description_he: z.string().max(2000).nullable().optional(),
  cover_url: z.string().url("כתובת תמונה לא תקינה").nullable().optional(),
  // Clearing the placeholder flag is what unlocks publishing (the DB CHECK
  // rejects a published row that still needs a title), so the CMS must be able
  // to send it.
  needs_title: z.boolean().optional(),
  is_published: z.boolean().optional(),
  order_index: z.number().int().min(0).optional(),
});

export const courseChapterSchema = z.object({
  course_id: z.string().uuid("מזהה קורס לא תקין"),
  slug,
  title_he: titleHe,
  subtitle_he: z.string().max(300).nullable().optional(),
  needs_title: z.boolean().optional(),
  order_index: z.number().int().min(0).optional(),
});

export const courseLessonSchema = z.object({
  chapter_id: z.string().uuid("מזהה פרק לא תקין"),
  slug,
  title_he: titleHe,
  description_he: z.string().max(2000).nullable().optional(),
  video_path: videoPath.nullable().optional(),
  video_path_sd: videoPath.nullable().optional(),
  duration_sec: z.number().int().min(0, "אורך לא יכול להיות שלילי").optional(),
  needs_title: z.boolean().optional(),
  is_published: z.boolean().optional(),
  order_index: z.number().int().min(0).optional(),
});

/**
 * Recording a video the CMS has just uploaded.
 *
 * `video_path` reuses the storage-key schema, which is the one place a path
 * supplied by a browser reaches the database -- the `..` refinement above is
 * what stops it naming an object outside the bucket prefix. `duration_sec` comes
 * from the client reading the file's own metadata, which is why it is bounded
 * rather than trusted outright.
 */
export const lessonVideoSchema = z.object({
  video_path: videoPath,
  duration_sec: z
    .number()
    .int("אורך חייב להיות מספר שלם")
    .min(1, "לא ניתן לקרוא את אורך הווידאו")
    .max(86_400, "אורך מחוץ לטווח"),
});

/**
 * A player position report. `positionSec` is clamped against the lesson's real
 * duration server-side -- never trust the client's own idea of how long the
 * video is.
 */
export const lessonProgressSchema = z.object({
  lesson_id: z.string().uuid("מזהה שיעור לא תקין"),
  position_sec: z
    .number()
    .int("מיקום חייב להיות מספר שלם")
    .min(0, "מיקום לא יכול להיות שלילי")
    .max(86_400, "מיקום מחוץ לטווח"),
});

/** Reorder payload: the ids of a parent's children in their new order. */
export const reorderSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, "נדרש לפחות פריט אחד").max(500),
});

export type CourseInput = z.infer<typeof courseSchema>;
export type CourseChapterInput = z.infer<typeof courseChapterSchema>;
export type CourseLessonInput = z.infer<typeof courseLessonSchema>;
export type LessonVideoInput = z.infer<typeof lessonVideoSchema>;
export type LessonProgressInput = z.infer<typeof lessonProgressSchema>;
export type ReorderInput = z.infer<typeof reorderSchema>;
