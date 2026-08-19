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
 *   - A row that already exists keeps the title, publish state and ordering the
 *     CMS gave it, so a re-run cannot take live content offline, revert a name
 *     Eden typed, or undo her arrangement.
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
import type { CourseSeed } from "./course-content/seed-types.ts";

const DRY_RUN = process.argv.includes("--dry-run");

function readFlag(name: string, fallback: string): string {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  const value = process.argv[idx + 1];
  if (!value || value.startsWith("--")) throw new Error(`--${name} needs a value`);
  return value;
}

/** The title columns this script reads back before overwriting a row. */
interface PriorTitle {
  readonly title_he: string | null;
  readonly needs_title: boolean | null;
}

/**
 * Which title to write for a row that may already exist.
 *
 * The seed file is regenerated from the source filenames on every run, so its
 * titles for un-named lessons are placeholders. Once the CMS has cleared
 * `needs_title` for a row, that row's title is Eden's and must survive a
 * re-seed; otherwise the seed's title wins (it is either the same generated
 * placeholder or a real title from the manifest).
 */
function titleToKeep(
  prior: PriorTitle | null,
  seedTitle: string,
  seedNeedsTitle: boolean
): { titleHe: string; needsTitle: boolean } {
  const named = prior != null && prior.needs_title === false && !!prior.title_he;
  if (named) return { titleHe: prior.title_he as string, needsTitle: false };
  return { titleHe: seedTitle, needsTitle: seedNeedsTitle };
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
    .select("is_published, title_he, needs_title")
    .eq("slug", seed.slug)
    .maybeSingle();

  if (priorCourseError) {
    throw new Error(`read course ${seed.slug}: ${priorCourseError.message}`);
  }

  // A title the CMS has already settled outranks the generated one. The seed is
  // rebuilt from filenames every time, so writing its placeholder back would
  // undo the very renames this script exists to make possible.
  const courseTitle = titleToKeep(
    priorCourse as PriorTitle | null,
    seed.titleHe,
    seed.needsTitle
  );

  const coursePublished =
    Boolean(priorCourse?.is_published) && !courseTitle.needsTitle;

  const { data: course, error: courseError } = await db
    .from("courses")
    .upsert(
      {
        slug: seed.slug,
        title_he: courseTitle.titleHe,
        needs_title: courseTitle.needsTitle,
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
    const { data: priorChapter, error: priorChapterError } = await db
      .from("course_chapters")
      .select("title_he, subtitle_he, needs_title, order_index")
      .eq("course_id", course.id)
      .eq("slug", chapter.slug)
      .maybeSingle();

    if (priorChapterError) {
      throw new Error(
        `read chapter ${chapter.slug}: ${priorChapterError.message}`
      );
    }

    const chapterTitle = titleToKeep(
      priorChapter as PriorTitle | null,
      chapter.titleHe,
      chapter.needsTitle
    );
    // The seed only ever carries a subtitle for the one chapter whose source
    // filenames named it; never blank one the CMS has since filled in.
    const chapterSubtitle =
      chapter.subtitleHe ??
      ((priorChapter as { subtitle_he?: string | null } | null)?.subtitle_he ??
        null);

    // Ordering belongs to the CMS once the row exists: /admin/course is the only
    // reorder UI, and the manifest order is just filename order. Overwriting it
    // would silently undo Eden's arrangement with no way to recover it.
    const chapterOrder =
      (priorChapter as { order_index?: number } | null)?.order_index ??
      chapter.orderIndex;

    const { data: chapterRow, error: chapterError } = await db
      .from("course_chapters")
      .upsert(
        {
          course_id: course.id,
          slug: chapter.slug,
          title_he: chapterTitle.titleHe,
          subtitle_he: chapterSubtitle,
          needs_title: chapterTitle.needsTitle,
          order_index: chapterOrder,
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
      .select("slug, is_published, title_he, needs_title, order_index")
      .eq("chapter_id", chapterRow.id);

    if (priorLessonError) {
      throw new Error(
        `read lessons for ${chapter.slug}: ${priorLessonError.message}`
      );
    }

    const priorBySlug = new Map(
      (priorLessons ?? []).map((row) => [
        row.slug as string,
        row as { is_published: boolean | null; order_index: number | null } &
          PriorTitle,
      ])
    );

    const rows = chapter.lessons.map((lesson) => {
      const prior = priorBySlug.get(lesson.slug) ?? null;
      const title = titleToKeep(prior, lesson.titleHe, lesson.needsTitle);
      const publishable = !title.needsTitle && Boolean(lesson.videoPath);
      const priorPublished = prior ? Boolean(prior.is_published) : undefined;
      return {
        chapter_id: chapterRow.id,
        slug: lesson.slug,
        title_he: title.titleHe,
        video_path: lesson.videoPath,
        video_path_sd: lesson.videoPathSd,
        duration_sec: lesson.durationSec,
        needs_title: title.needsTitle,
        is_published: (priorPublished ?? publishable) && publishable,
        order_index: prior?.order_index ?? lesson.orderIndex,
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
