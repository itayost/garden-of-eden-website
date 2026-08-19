/**
 * Transcode the consolidated course tree into web-ready renditions.
 *
 * The source masters are 1080p at ~6 Mbps, roughly three times what a static
 * interview shot needs on a phone. This produces two smaller renditions per
 * lesson and leaves the masters untouched:
 *
 *   720p CRF 23 -> the default stream (~1.1 Mbps)
 *   480p CRF 26 -> the fallback a trainee can pick on a weak connection
 *
 * Supabase Storage does not do adaptive bitrate, so the 480p rendition plus a
 * quality toggle in the player is what stands in for it.
 *
 * Preset choice: benchmarked on a real lesson, veryfast came out both faster
 * and smaller than medium at the same CRF (15s/16.9 MB vs 24s/20.4 MB), which
 * is the usual trade of a little fidelity for speed. On a static interview shot
 * viewed at phone size that difference is not visible, and the whole course
 * still lands far inside the storage budget.
 *
 * Usage:
 *   node scripts/transcode-course.ts --dry-run
 *   node scripts/transcode-course.ts
 *   node scripts/transcode-course.ts --src <dir> --out <dir> --concurrency 3
 *
 * Idempotent: an output newer than its source is skipped, so a failed or
 * interrupted run can simply be repeated.
 */

import { execFile } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const DRY_RUN = process.argv.includes("--dry-run");

const RENDITIONS = [
  {
    label: "720p" as const,
    args: [
      "-vf", "scale=-2:720",
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "23",
      "-profile:v", "high",
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      "-c:a", "aac",
      "-b:a", "96k",
      "-ac", "2",
    ],
  },
  {
    label: "480p" as const,
    args: [
      "-vf", "scale=-2:480",
      "-c:v", "libx264",
      "-preset", "veryfast",
      "-crf", "26",
      "-profile:v", "main",
      "-pix_fmt", "yuv420p",
      "-movflags", "+faststart",
      "-c:a", "aac",
      "-b:a", "64k",
      "-ac", "2",
    ],
  },
];

export type RenditionLabel = (typeof RENDITIONS)[number]["label"];

interface RenditionOutput {
  readonly label: RenditionLabel;
  /** Path relative to the output root, and the storage key we will upload to. */
  readonly file: string;
  readonly sizeBytes: number;
}

interface TranscodedLesson {
  /** Path relative to the source root, matching course-manifest.json. */
  readonly file: string;
  readonly durationSec: number;
  readonly sourceBytes: number;
  readonly renditions: readonly RenditionOutput[];
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

/** List every .mp4 under root, as paths relative to root, sorted. */
function listVideos(root: string): readonly string[] {
  const walk = (dir: string): readonly string[] =>
    fs
      .readdirSync(dir, { withFileTypes: true })
      .flatMap((entry) => {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) return walk(full);
        return entry.isFile() && entry.name.endsWith(".mp4") ? [full] : [];
      });

  return walk(root)
    .map((full) => path.relative(root, full))
    .sort((a, b) => a.localeCompare(b));
}

async function probeDuration(file: string): Promise<number> {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "csv=p=0",
    file,
  ]);
  const seconds = Number.parseFloat(stdout.trim());
  if (!Number.isFinite(seconds)) {
    throw new Error(`Could not read duration from ${file}`);
  }
  return Math.round(seconds);
}

/** True when the output exists and is at least as new as the source. */
function isUpToDate(source: string, output: string): boolean {
  if (!fs.existsSync(output)) return false;
  return fs.statSync(output).mtimeMs >= fs.statSync(source).mtimeMs;
}

function renditionPath(relative: string, label: RenditionLabel): string {
  const dir = path.dirname(relative);
  const base = path.basename(relative, ".mp4");
  return path.join(dir, `${base}.${label}.mp4`);
}

async function transcodeOne(
  srcRoot: string,
  outRoot: string,
  relative: string
): Promise<TranscodedLesson> {
  const source = path.join(srcRoot, relative);
  const durationSec = await probeDuration(source);
  const sourceBytes = fs.statSync(source).size;
  const renditions: RenditionOutput[] = [];

  for (const rendition of RENDITIONS) {
    const outRelative = renditionPath(relative, rendition.label);
    const output = path.join(outRoot, outRelative);
    fs.mkdirSync(path.dirname(output), { recursive: true });

    if (isUpToDate(source, output)) {
      process.stdout.write(`  skip ${outRelative}\n`);
    } else {
      // Write to a temp file first so an interrupted run never leaves a
      // truncated output that the next run would treat as up to date.
      // -f mp4 is explicit because the temp name has no recognised extension.
      const temp = `${output}.partial`;
      try {
        await execFileAsync("ffmpeg", [
          "-y", "-v", "error",
          "-i", source,
          ...rendition.args,
          "-f", "mp4",
          temp,
        ]);
        fs.renameSync(temp, output);
      } catch (error) {
        if (fs.existsSync(temp)) fs.unlinkSync(temp);
        throw error;
      }
      process.stdout.write(`  wrote ${outRelative}\n`);
    }

    renditions.push({
      label: rendition.label,
      file: outRelative,
      sizeBytes: fs.statSync(output).size,
    });
  }

  return { file: relative, durationSec, sourceBytes, renditions };
}

/** Run tasks with a bounded number in flight; ffmpeg already uses many threads. */
async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<readonly R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  const worker = async (): Promise<void> => {
    for (;;) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await fn(items[index], index);
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker())
  );
  return results;
}

function formatGb(bytes: number): string {
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

async function main(): Promise<void> {
  const srcRoot = path.resolve(
    readFlag("src", path.join(os.homedir(), "Downloads", "eden-course"))
  );
  const outRoot = path.resolve(
    readFlag("out", path.join(os.homedir(), "Downloads", "eden-course-web"))
  );
  const concurrency = Number.parseInt(readFlag("concurrency", "2"), 10);

  if (!fs.existsSync(srcRoot)) {
    throw new Error(`Source directory not found: ${srcRoot}`);
  }
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error("--concurrency must be a positive integer");
  }

  const videos = listVideos(srcRoot);
  if (videos.length === 0) {
    throw new Error(`No .mp4 files under ${srcRoot}`);
  }

  console.log(`Source: ${srcRoot}`);
  console.log(`Output: ${outRoot}`);
  console.log(`${videos.length} lessons, ${RENDITIONS.length} renditions each\n`);

  if (DRY_RUN) {
    for (const relative of videos) {
      console.log(`  ${relative}`);
      for (const rendition of RENDITIONS) {
        console.log(`    -> ${renditionPath(relative, rendition.label)}`);
      }
    }
    console.log("\nDry run -- nothing transcoded.");
    return;
  }

  const started = Date.now();
  const lessons = await mapWithConcurrency(videos, concurrency, (relative) =>
    transcodeOne(srcRoot, outRoot, relative)
  );

  const sourceBytes = lessons.reduce((sum, l) => sum + l.sourceBytes, 0);
  const byLabel = RENDITIONS.map((rendition) => ({
    label: rendition.label,
    bytes: lessons.reduce(
      (sum, lesson) =>
        sum +
        (lesson.renditions.find((r) => r.label === rendition.label)?.sizeBytes ?? 0),
      0
    ),
  }));

  fs.writeFileSync(
    path.join(outRoot, "web-manifest.json"),
    `${JSON.stringify({ srcRoot, outRoot, lessons }, null, 2)}\n`,
    "utf-8"
  );

  const elapsed = Math.round((Date.now() - started) / 1000);
  console.log(`\nDone in ${Math.floor(elapsed / 60)}m ${elapsed % 60}s`);
  console.log(`  source  ${formatGb(sourceBytes)}`);
  for (const { label, bytes } of byLabel) {
    const ratio = ((bytes / sourceBytes) * 100).toFixed(1);
    console.log(`  ${label}    ${formatGb(bytes)}  (${ratio}% of source)`);
  }
  console.log(`\nManifest: ${path.join(outRoot, "web-manifest.json")}`);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
