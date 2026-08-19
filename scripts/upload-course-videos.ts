/**
 * Upload the transcoded course renditions into the private `course-videos`
 * bucket and emit the seed file the database seeder consumes.
 *
 * Inputs:
 *   <src>/course-manifest.json  chapter + lesson structure and Hebrew titles
 *   <web>/web-manifest.json     rendition paths produced by transcode-course.ts
 *
 * Output:
 *   <web>/course-seed.json      one file combining both, with storage paths
 *
 * Usage:
 *   node scripts/upload-course-videos.ts --dry-run
 *   node scripts/upload-course-videos.ts
 *
 * Idempotent: an object already in the bucket at the same byte size is skipped,
 * so an interrupted run can simply be repeated.
 *
 * CRITICAL: this writes to the PRODUCTION Supabase project. --dry-run is safe.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { loadEnvLocal, getAdminClient } from "./import-utils.ts";

const DRY_RUN = process.argv.includes("--dry-run");
const BUCKET = "course-videos";
const UPLOAD_ATTEMPTS = 3;

// ---------------------------------------------------------------------------
// Shapes of the two input manifests
// ---------------------------------------------------------------------------
interface ManifestLesson {
  readonly order_index: number;
  readonly slug: string;
  readonly title_he: string;
  readonly needs_title: boolean;
  readonly duration_sec: number;
  readonly file: string;
}

interface ManifestChapter {
  readonly order_index: number;
  readonly slug: string;
  readonly title_he: string;
  readonly subtitle_he: string | null;
  readonly needs_title: boolean;
  readonly lessons: readonly ManifestLesson[];
}

interface CourseManifest {
  readonly course_slug: string;
  readonly title_he: string;
  readonly needs_title: boolean;
  readonly chapters: readonly ManifestChapter[];
}

interface WebRendition {
  readonly label: "720p" | "480p";
  readonly file: string;
  readonly sizeBytes: number;
}

interface WebManifest {
  readonly lessons: readonly {
    readonly file: string;
    readonly durationSec: number;
    readonly renditions: readonly WebRendition[];
  }[];
}

// ---------------------------------------------------------------------------
// Shape of the seed file this script emits
// ---------------------------------------------------------------------------
export interface SeedLesson {
  readonly slug: string;
  readonly titleHe: string;
  readonly needsTitle: boolean;
  readonly orderIndex: number;
  readonly durationSec: number;
  readonly videoPath: string;
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

function readFlag(name: string, fallback: string): string {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx === -1) return fallback;
  const value = process.argv[idx + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`--${name} needs a value`);
  }
  return value;
}

/** Storage keys are always POSIX, whatever platform the manifest was built on. */
function toStorageKey(relative: string): string {
  return relative.split(path.sep).join("/");
}

function readJson<T>(file: string): T {
  if (!fs.existsSync(file)) {
    throw new Error(`Missing ${file}`);
  }
  return JSON.parse(fs.readFileSync(file, "utf-8")) as T;
}

/**
 * Every object already in the bucket under the given prefixes, mapped
 * path -> byte size.
 *
 * The prefixes must be derived from the storage paths this run intends to
 * write, not from the chapter slugs: the paths come from the source directory
 * layout in web-manifest.json, which need not match the manifest slugs. Listing
 * the wrong folders returns nothing, and every object then looks new and gets
 * re-uploaded on every run.
 */
async function listExisting(
  db: ReturnType<typeof getAdminClient>,
  prefixes: readonly string[]
): Promise<ReadonlyMap<string, number>> {
  const existing = new Map<string, number>();

  for (const prefix of prefixes) {
    const { data, error } = await db.storage
      .from(BUCKET)
      .list(prefix, { limit: 1000 });
    // A missing folder is not an error condition; it just has nothing in it.
    if (error) throw new Error(`list ${prefix || "/"}: ${error.message}`);
    for (const entry of data ?? []) {
      const size = (entry.metadata as { size?: number } | null)?.size;
      if (typeof size === "number") {
        existing.set(prefix ? `${prefix}/${entry.name}` : entry.name, size);
      }
    }
  }

  return existing;
}

async function uploadWithRetry(
  db: ReturnType<typeof getAdminClient>,
  storagePath: string,
  body: Buffer
): Promise<void> {
  let lastError = "";
  for (let attempt = 1; attempt <= UPLOAD_ATTEMPTS; attempt++) {
    const { error } = await db.storage.from(BUCKET).upload(storagePath, body, {
      contentType: "video/mp4",
      upsert: true,
    });
    if (!error) return;
    lastError = error.message;
    if (attempt < UPLOAD_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
    }
  }
  throw new Error(`upload ${storagePath} failed after ${UPLOAD_ATTEMPTS} attempts: ${lastError}`);
}

function formatMb(bytes: number): string {
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

async function main(): Promise<void> {
  const srcRoot = path.resolve(
    readFlag("src", path.join(os.homedir(), "Downloads", "eden-course"))
  );
  const webRoot = path.resolve(
    readFlag("web", path.join(os.homedir(), "Downloads", "eden-course-web"))
  );

  const manifest = readJson<CourseManifest>(
    path.join(srcRoot, "course-manifest.json")
  );
  const web = readJson<WebManifest>(path.join(webRoot, "web-manifest.json"));

  // Index renditions by their source-relative path, which both manifests share.
  const renditionsBySource = new Map(
    web.lessons.map((lesson) => [lesson.file, lesson.renditions])
  );

  const chapters: SeedChapter[] = [];
  const pending: { storagePath: string; localPath: string; sizeBytes: number }[] = [];

  for (const chapter of manifest.chapters) {
    const lessons: SeedLesson[] = [];

    for (const lesson of chapter.lessons) {
      const renditions = renditionsBySource.get(lesson.file);
      if (!renditions) {
        throw new Error(`No transcoded rendition for ${lesson.file}. Run transcode-course.ts first.`);
      }

      const hd = renditions.find((r) => r.label === "720p");
      if (!hd) throw new Error(`No 720p rendition for ${lesson.file}`);
      const sd = renditions.find((r) => r.label === "480p") ?? null;

      for (const rendition of [hd, ...(sd ? [sd] : [])]) {
        pending.push({
          storagePath: toStorageKey(rendition.file),
          localPath: path.join(webRoot, rendition.file),
          sizeBytes: rendition.sizeBytes,
        });
      }

      lessons.push({
        slug: lesson.slug,
        titleHe: lesson.title_he,
        needsTitle: lesson.needs_title,
        orderIndex: lesson.order_index,
        durationSec: lesson.duration_sec,
        // The seeder writes these straight into course_lessons.video_path, so
        // they have to be the same keys the objects were uploaded under.
        videoPath: toStorageKey(hd.file),
        videoPathSd: sd ? toStorageKey(sd.file) : null,
      });
    }

    chapters.push({
      slug: chapter.slug,
      titleHe: chapter.title_he,
      subtitleHe: chapter.subtitle_he,
      needsTitle: chapter.needs_title,
      orderIndex: chapter.order_index,
      lessons,
    });
  }

  const seed: CourseSeed = {
    slug: manifest.course_slug,
    titleHe: manifest.title_he,
    needsTitle: manifest.needs_title,
    chapters,
  };

  const totalBytes = pending.reduce((sum, p) => sum + p.sizeBytes, 0);
  console.log(`${chapters.length} chapters, ${chapters.reduce((n, c) => n + c.lessons.length, 0)} lessons`);
  console.log(`${pending.length} objects to consider, ${formatMb(totalBytes)} total\n`);

  const seedPath = path.join(webRoot, "course-seed.json");

  if (DRY_RUN) {
    for (const item of pending.slice(0, 5)) {
      console.log(`  ${item.storagePath}  ${formatMb(item.sizeBytes)}`);
    }
    if (pending.length > 5) console.log(`  ... and ${pending.length - 5} more`);
    fs.writeFileSync(seedPath, `${JSON.stringify(seed, null, 2)}\n`, "utf-8");
    console.log(`\nDry run -- nothing uploaded. Seed written to ${seedPath}`);
    return;
  }

  loadEnvLocal();
  const db = getAdminClient();

  const { data: buckets, error: bucketError } = await db.storage.listBuckets();
  if (bucketError) throw new Error(`listBuckets: ${bucketError.message}`);
  if (!buckets.some((b) => b.name === BUCKET)) {
    throw new Error(
      `Bucket "${BUCKET}" does not exist. Apply the migration first: supabase db push`
    );
  }

  const storagePrefixes = [
    ...new Set(
      pending.map((item) => {
        const dir = path.posix.dirname(item.storagePath);
        return dir === "." ? "" : dir;
      })
    ),
  ];
  const existing = await listExisting(db, storagePrefixes);

  let uploaded = 0;
  let skipped = 0;
  let uploadedBytes = 0;

  for (const item of pending) {
    if (existing.get(item.storagePath) === item.sizeBytes) {
      skipped++;
      continue;
    }
    const body = fs.readFileSync(item.localPath);
    await uploadWithRetry(db, item.storagePath, body);
    uploaded++;
    uploadedBytes += item.sizeBytes;
    process.stdout.write(
      `  [${uploaded + skipped}/${pending.length}] ${item.storagePath} ${formatMb(item.sizeBytes)}\n`
    );
  }

  fs.writeFileSync(seedPath, `${JSON.stringify(seed, null, 2)}\n`, "utf-8");

  console.log(`\nUploaded ${uploaded} (${formatMb(uploadedBytes)}), skipped ${skipped} already present.`);
  console.log(`Seed written to ${seedPath}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
