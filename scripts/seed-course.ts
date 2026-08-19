/**
 * Seed the course tables from the file produced by upload-course-videos.ts.
 *
 * Idempotent on slug: re-running updates titles, durations and video paths in
 * place rather than creating duplicates, so it is safe to run again after Eden
 * fills in the missing titles.
 *
 * Publishing rules applied here:
 *   - A course this run creates starts unpublished. Eden flips it when she is
 *     ready, and until then trainees see nothing at all -- the course flag is
 *     the single gate over everything below it.
 *   - Lessons that have a real title and a video are marked published, so Eden
 *     does not have to tick 39 boxes by hand. They stay invisible until the
 *     course itself goes live.
 *   - A row that already exists keeps the publish state the CMS gave it, so a
 *     re-run cannot take live content offline.
 *   - Nothing is ever published while it still carries a generated placeholder
 *     title or has no video; the database CHECK constraints enforce the same
 *     rule independently.
 *
 * Usage:
 *   node scripts/seed-course.ts --dry-run
 *   node scripts/seed-course.ts
 *
 * CRITICAL: writes to the PRODUCTION Supabase database. --dry-run is safe.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { loadEnvLocal, getAdminClient } from "./import-utils.ts";

const DRY_RUN = process.argv.includes("--dry-run");

interface SeedLesson {
  readonly slug: string;
  readonly titleHe: string;
  readonly needsTitle: boolean;
  readonly orderIndex: number;
  readonly durationSec: number;
  readonly videoPath: string;
  readonly videoPathSd: string | null;
}

interface SeedChapter {
  readonly slug: string;
  readonly titleHe: string;
  readonly subtitleHe: string | null;
  readonly needsTitle: boolean;
  readonly orderIndex: number;
  readonly lessons: readonly SeedLesson[];
}

interface CourseSeed {
  readonly slug: string;
  readonly titleHe: string;
  readonly needsTitle: boolean;
  readonly chapters: readonly SeedChapter[];
}

function readFlag(name: string, fallback: string): string {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  const value = process.argv[idx + 1];
  if (!value || value.startsWith("--")) throw new Error(`--${name} needs a value`);
  return value;
}

async function main(): Promise<void> {
  const seedFile = readFlag(
    "seed",
    path.join(os.homedir(), "Downloads", "eden-course-web", "course-seed.json")
  );

  if (!fs.existsSync(seedFile)) {
    throw new Error(
      `Missing ${seedFile}. Run upload-course-videos.ts first (it writes the seed file).`
    );
  }

  const seed = JSON.parse(fs.readFileSync(seedFile, "utf-8")) as CourseSeed;

  const lessonCount = seed.chapters.reduce((n, c) => n + c.lessons.length, 0);
  const publishable = seed.chapters
    .flatMap((c) => c.lessons)
    .filter((l) => !l.needsTitle && l.videoPath).length;

  console.log(`Course: ${seed.slug} (${seed.titleHe})`);
  console.log(`  ${seed.chapters.length} chapters, ${lessonCount} lessons`);
  console.log(`  ${publishable} publishable now, ${lessonCount - publishable} awaiting titles\n`);

  if (DRY_RUN) {
    for (const chapter of seed.chapters) {
      const flag = chapter.needsTitle ? " [needs title]" : "";
      console.log(`  ${chapter.slug} — ${chapter.titleHe}${flag}`);
      for (const lesson of chapter.lessons) {
        const state = !lesson.needsTitle && lesson.videoPath ? "publish" : "draft  ";
        console.log(`    ${state} ${lesson.slug.padEnd(28)} ${lesson.titleHe}`);
      }
    }
    console.log("\nDry run -- no DB writes.");
    return;
  }

  loadEnvLocal();
  const db = getAdminClient();

  // A re-run must never take a live course offline, so the publish flag is only
  // decided for a course this script is creating; an existing one keeps whatever
  // Eden set in the CMS (minus the case where the seed says the title is still a
  // placeholder, which the CHECK constraint forbids publishing anyway).
  const { data: priorCourse, error: priorCourseError } = await db
    .from("courses")
    .select("is_published")
    .eq("slug", seed.slug)
    .maybeSingle();

  if (priorCourseError) {
    throw new Error(`read course ${seed.slug}: ${priorCourseError.message}`);
  }

  const coursePublished = Boolean(priorCourse?.is_published) && !seed.needsTitle;

  const { data: course, error: courseError } = await db
    .from("courses")
    .upsert(
      {
        slug: seed.slug,
        title_he: seed.titleHe,
        needs_title: seed.needsTitle,
        // Left unpublished on purpose for a new course: Eden decides when it
        // goes live.
        is_published: coursePublished,
        order_index: 0,
      },
      { onConflict: "slug" }
    )
    .select("id")
    .single();

  if (courseError || !course) {
    throw new Error(`upsert course: ${courseError?.message ?? "no row returned"}`);
  }

  let chaptersWritten = 0;
  let lessonsWritten = 0;

  for (const chapter of seed.chapters) {
    const { data: chapterRow, error: chapterError } = await db
      .from("course_chapters")
      .upsert(
        {
          course_id: course.id,
          slug: chapter.slug,
          title_he: chapter.titleHe,
          subtitle_he: chapter.subtitleHe,
          needs_title: chapter.needsTitle,
          order_index: chapter.orderIndex,
        },
        { onConflict: "course_id,slug" }
      )
      .select("id")
      .single();

    if (chapterError || !chapterRow) {
      throw new Error(
        `upsert chapter ${chapter.slug}: ${chapterError?.message ?? "no row returned"}`
      );
    }
    chaptersWritten++;

    // Same rule per lesson: a lesson already in the database keeps the publish
    // state the CMS gave it, so re-seeding does not unpublish (or re-publish)
    // anything behind Eden's back.
    const { data: priorLessons, error: priorLessonError } = await db
      .from("course_lessons")
      .select("slug, is_published")
      .eq("chapter_id", chapterRow.id);

    if (priorLessonError) {
      throw new Error(
        `read lessons for ${chapter.slug}: ${priorLessonError.message}`
      );
    }

    const priorPublished = new Map(
      (priorLessons ?? []).map((row) => [row.slug as string, Boolean(row.is_published)])
    );

    const rows = chapter.lessons.map((lesson) => {
      const publishable = !lesson.needsTitle && Boolean(lesson.videoPath);
      const prior = priorPublished.get(lesson.slug);
      return {
        chapter_id: chapterRow.id,
        slug: lesson.slug,
        title_he: lesson.titleHe,
        video_path: lesson.videoPath,
        video_path_sd: lesson.videoPathSd,
        duration_sec: lesson.durationSec,
        needs_title: lesson.needsTitle,
        is_published: (prior ?? publishable) && publishable,
        order_index: lesson.orderIndex,
      };
    });

    const { error: lessonError } = await db
      .from("course_lessons")
      .upsert(rows, { onConflict: "chapter_id,slug" });

    if (lessonError) {
      throw new Error(`upsert lessons for ${chapter.slug}: ${lessonError.message}`);
    }
    lessonsWritten += rows.length;
  }

  console.log(`Seeded ${chaptersWritten} chapters and ${lessonsWritten} lessons.`);
  console.log(
    coursePublished
      ? "The course stays published — review the new lessons in /admin/course."
      : "The course is still unpublished — publish it from /admin/course when ready."
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
