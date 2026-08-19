/**
 * Shape of `course-seed.json`, the handoff between the content pipeline and the
 * database seeder.
 *
 * Its own module rather than living in either script: both
 * `upload-course-videos.ts` (which writes the file) and `seed-course.ts` (which
 * reads it) need these types, and importing from a script that calls `main()` at
 * module scope would execute it.
 */

export interface SeedLesson {
  readonly slug: string;
  readonly titleHe: string;
  /** True while the title is still a placeholder generated from the filename. */
  readonly needsTitle: boolean;
  readonly orderIndex: number;
  readonly durationSec: number;
  /** Storage key of the 720p rendition. */
  readonly videoPath: string;
  /** Storage key of the 480p rendition, when one was produced. */
  readonly videoPathSd: string | null;
}

export interface SeedChapter {
  readonly slug: string;
  readonly titleHe: string;
  readonly subtitleHe: string | null;
  readonly needsTitle: boolean;
  readonly orderIndex: number;
  readonly lessons: readonly SeedLesson[];
}

export interface CourseSeed {
  readonly slug: string;
  readonly titleHe: string;
  readonly needsTitle: boolean;
  readonly chapters: readonly SeedChapter[];
}
