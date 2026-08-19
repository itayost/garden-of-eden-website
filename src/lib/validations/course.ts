import { z } from "zod";

/**
 * Validation schemas for the trainee video course.
 *
 * Only the payloads that actually cross a trust boundary live here. Titles are
 * validated in `admin-course.ts` next to the update they guard, because that is
 * also where the "a real title clears needs_title" rule lives.
 */

/** Storage key inside the course-videos bucket, e.g. "01-chapter-1/03.720p.mp4". */
const videoPath = z
  .string()
  .min(1)
  .max(300)
  .regex(/^[a-z0-9][a-z0-9/._-]*\.mp4$/i, "נתיב וידאו לא תקין")
  // Reject anything that could climb out of the bucket prefix.
  .refine((value) => !value.includes(".."), "נתיב וידאו לא תקין");

/**
 * Recording a video the CMS has just uploaded.
 *
 * `video_path` is the one place a storage key supplied by a browser reaches the
 * database, so the `..` refinement above is what stops it naming an object
 * outside the bucket prefix. `duration_sec` comes from the client reading the
 * file's own metadata, which is why it is bounded rather than trusted outright.
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

export type LessonVideoInput = z.infer<typeof lessonVideoSchema>;
export type LessonProgressInput = z.infer<typeof lessonProgressSchema>;
export type ReorderInput = z.infer<typeof reorderSchema>;
