/**
 * Weekly report preview: builds the Fact sheets of one past Report week from
 * production, asks the model for the texts with direct requests, runs the
 * guardrails and writes an HTML page for people to read. It is how the style
 * guide is tuned with Eden and how the blind comparison of the models runs.
 *
 * READ-ONLY: it never writes to the database and never sends a message. It
 * does read PRODUCTION (and the Arbox entrance report) and it SPENDS API
 * CREDIT, one request per Trainee per model: run it only with the owner's
 * agreement.
 *
 * Usage (the loaders are server-only, hence the react-server condition):
 *   npx tsx --conditions=react-server scripts/weekly-reports-preview.ts \
 *     --week=2026-11-13 --branch=<branch id> [--birth-years=2013,2014] [--limit=10] \
 *     [--models=claude-opus-5-5,claude-sonnet-5-5] [--blind] [--out=<file>]
 *
 * --week     a Friday, the Report week's start
 * --branch   the branch to preview, as if it were set to "באישור צוות"
 * --limit    how many reports to write (default 10), in Hebrew name order
 * --models   default: WEEKLY_REPORT_MODEL, else claude-opus-5-5
 * --blind    models shown as א, ב... in a shuffled order per Trainee; the key
 *            goes to <out>-key.json next to the page
 * --out      default: the system temp directory. The page holds children's
 *            names: keep it out of git and delete it when done.
 */
import { randomInt } from "node:crypto";
import { writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";
import type { WeekKind } from "../src/features/weekly-reports/lib/audience";
import type { BuiltSheet } from "../src/features/weekly-reports/lib/fact-sheet/types";
import { fillName, firstNameOf } from "../src/features/weekly-reports/lib/fill-name";
import { replaceTextProblems, reportProblems } from "../src/features/weekly-reports/lib/guardrails";
import { reportWeekLabel, reportWeekStart, reportWeekEnd } from "../src/features/weekly-reports/lib/report-week";
import type { WriteOutcome } from "../src/features/weekly-reports/lib/writer/output";
import { WRITER_MODELS, writerModel, type WriterModel } from "../src/features/weekly-reports/lib/writer/request";
import { PROMPT_VERSION, STYLE_GUIDE_HAS_PLACEHOLDER_SAMPLES } from "../src/features/weekly-reports/lib/writer/style-guide";
import { isValidUUID } from "../src/lib/validations/common";
import { addDays } from "../src/lib/utils/iso-date";
import { israelToday } from "../src/lib/utils/tasks";
import { loadEnvLocal } from "./import-utils";

const DEFAULT_LIMIT = 10;
const CONCURRENCY = 4;
const BLIND_LETTERS = ["א", "ב", "ג", "ד"];

/** List prices per million tokens (2026-11); a cache write is 1.25x input. Batch requests cost half. */
const PRICES: Record<WriterModel, { input: number; cacheWrite: number; cacheRead: number; output: number }> = {
  "claude-opus-5-5": { input: 4, cacheWrite: 5, cacheRead: 0.2, output: 20 },
  "claude-sonnet-5-5": { input: 2, cacheWrite: 2.5, cacheRead: 0.1, output: 10 },
};

interface Options {
  week: string;
  branchId: string;
  birthYears: number[] | null;
  limit: number;
  models: WriterModel[];
  blind: boolean;
  out: string;
}

interface Version {
  model: WriterModel;
  outcome: WriteOutcome;
}

interface Preview {
  name: string;
  built: BuiltSheet;
  versions: Version[];
}

function fail(message: string): never {
  console.error(`weekly-reports-preview: ${message}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Arguments
// ---------------------------------------------------------------------------

function isWriterModel(value: string): value is WriterModel {
  return WRITER_MODELS.some((model) => model === value);
}

function parseBirthYears(value: string | undefined): number[] | null {
  if (value === undefined || value.trim() === "") return null;
  const years = value.split(",").map((part) => Number(part.trim()));
  if (years.some((year) => !Number.isInteger(year) || year < 1950 || year > 2030)) {
    fail(`--birth-years takes whole years from 1950 to 2030, got "${value}"`);
  }
  return [...new Set(years)];
}

function parseModels(value: string | undefined): WriterModel[] {
  if (value === undefined) return [writerModel()];
  const names = [...new Set(value.split(",").map((part) => part.trim()).filter((part) => part !== ""))];
  const unknown = names.filter((name) => !isWriterModel(name));
  if (unknown.length > 0) fail(`unknown model ${unknown.join(", ")}; known: ${WRITER_MODELS.join(", ")}`);
  return names.filter(isWriterModel);
}

function parseOptions(): Options {
  const { values } = parseArgs({
    options: {
      week: { type: "string" },
      branch: { type: "string" },
      "birth-years": { type: "string" },
      limit: { type: "string" },
      models: { type: "string" },
      blind: { type: "boolean", default: false },
      out: { type: "string" },
    },
    strict: true,
  });
  const week = values.week ?? fail("--week=<a Friday, YYYY-MM-DD> is required");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(week) || reportWeekStart(week) !== week) fail(`--week must be a Friday, got "${week}"`);
  const branchId = values.branch ?? fail("--branch=<branch id> is required");
  if (!isValidUUID(branchId)) fail(`--branch must be a branch id, got "${branchId}"`);
  const limit = values.limit === undefined ? DEFAULT_LIMIT : Number(values.limit);
  if (!Number.isInteger(limit) || limit < 1) fail(`--limit must be a positive whole number, got "${values.limit}"`);
  const models = parseModels(values.models);
  if (models.length === 0) fail("--models names no model");
  if (values.blind && (models.length < 2 || models.length > BLIND_LETTERS.length)) {
    fail(`--blind compares 2 to ${BLIND_LETTERS.length} models; pass them with --models`);
  }
  return {
    week,
    branchId,
    birthYears: parseBirthYears(values["birth-years"]),
    limit,
    models,
    blind: values.blind ?? false,
    out: values.out ?? join(tmpdir(), `weekly-reports-preview-${week}.html`),
  };
}

// ---------------------------------------------------------------------------
// The server modules: loaded after the refusals, and only under react-server
// ---------------------------------------------------------------------------

async function loadServer() {
  try {
    const [plan, direct, client, admin] = await Promise.all([
      import("../src/features/weekly-reports/lib/jobs/week-plan"),
      import("../src/features/weekly-reports/lib/writer/direct"),
      import("../src/features/weekly-reports/lib/writer/client"),
      import("../src/lib/supabase/admin"),
    ]);
    return { ...plan, ...direct, ...client, ...admin };
  } catch (error) {
    if (error instanceof Error && error.message.includes("Server Component")) {
      fail("the loaders are server-only: run it with npx tsx --conditions=react-server scripts/weekly-reports-preview.ts ...");
    }
    throw error;
  }
}

type Server = Awaited<ReturnType<typeof loadServer>>;
type Db = ReturnType<Server["createAdminClient"]>;

async function branchName(db: Db, branchId: string): Promise<string> {
  const { data, error } = await db.from("branches").select("name_he").eq("id", branchId).maybeSingle();
  if (error) fail(`branches read failed: ${error.message}`);
  return data?.name_he ?? fail(`no branch ${branchId}`);
}

/** Runs `work` over the items, `limit` at a time, in their order. */
async function mapPool<T, R>(items: readonly T[], limit: number, work: (item: T) => Promise<R>): Promise<R[]> {
  let next = 0;
  const lane = async (): Promise<{ index: number; result: R }[]> => {
    let done: { index: number; result: R }[] = [];
    while (next < items.length) {
      const index = next;
      next += 1;
      done = [...done, { index, result: await work(items[index]) }];
    }
    return done;
  };
  const lanes = await Promise.all(Array.from({ length: Math.min(limit, items.length) }, lane));
  return lanes
    .flat()
    .sort((a, b) => a.index - b.index)
    .map((item) => item.result);
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

interface Picked {
  traineeId: string;
  name: string;
  built: BuiltSheet;
}

const hebrew = new Intl.Collator("he");

/**
 * The week's report Trainees with a sheet, in Hebrew name order. Those with no
 * gender are left out as the write job leaves them: they wait for "בן" / "בת".
 */
async function pickTrainees(server: Server, db: Db, options: Options): Promise<Picked[]> {
  const setting = { branchId: options.branchId, mode: "approval" as const, birthYears: options.birthYears, missedYou: false };
  const plan = await server.planWeek(db, options.week, [setting]);
  if (plan.arboxFailed) console.warn("Arbox read failed: Trainees who train through Arbox only are left out.");
  const kinds = plan.trainees.reduce<Record<WeekKind, number>>(
    (counts, trainee) => ({ ...counts, [trainee.kind]: counts[trainee.kind] + 1 }),
    { report: 0, missed_you: 0, absent: 0, nothing: 0 },
  );
  console.log(`${plan.trainees.length} Trainees in the audience: ${kinds.report} trained this week.`);

  const reports = plan.trainees.filter((trainee) => trainee.kind === "report");
  const sheets = await server.buildSheets(db, plan, reports, addDays(reportWeekEnd(options.week), 1));
  const withSheet = reports
    .flatMap((trainee) => {
      const built = sheets.get(trainee.traineeId);
      return built === undefined ? [] : [{ traineeId: trainee.traineeId, name: trainee.fullName, built }];
    })
    .sort((a, b) => hebrew.compare(a.name, b.name));
  const noGender = withSheet.filter((picked) => picked.built.sheet.player.gender === null);
  if (noGender.length > 0) console.log(`${noGender.length} left out for missing gender.`);
  return withSheet.filter((picked) => picked.built.sheet.player.gender !== null).slice(0, options.limit);
}

async function writeAll(server: Server, picked: readonly Picked[], models: readonly WriterModel[]): Promise<Preview[]> {
  const client = server.anthropicClient() ?? fail("ANTHROPIC_API_KEY is not set");
  const jobs = picked.flatMap((trainee) => models.map((model) => ({ trainee, model })));
  console.log(`Writing ${jobs.length} texts (${picked.length} Trainees x ${models.length} models)...`);
  const outcomes = await mapPool(jobs, CONCURRENCY, async ({ trainee, model }) => {
    const outcome = await server.writeDirect(client, trainee.built.sheet, model);
    console.log(`  ${outcome.ok ? "ok" : `failed (${outcome.reason})`}  ${model}`);
    return outcome;
  });
  return picked.map((trainee, t) => ({
    name: trainee.name,
    built: trainee.built,
    versions: models.map((model, m) => ({ model, outcome: outcomes[t * models.length + m] })),
  }));
}

// ---------------------------------------------------------------------------
// Usage and cost
// ---------------------------------------------------------------------------

interface Tokens {
  input: number;
  cacheWrite: number;
  cacheRead: number;
  output: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function tokensOf(usage: unknown): Tokens {
  const field = (key: string): number => {
    const value = isRecord(usage) ? usage[key] : undefined;
    return typeof value === "number" ? value : 0;
  };
  return {
    input: field("input_tokens"),
    cacheWrite: field("cache_creation_input_tokens"),
    cacheRead: field("cache_read_input_tokens"),
    output: field("output_tokens"),
  };
}

/** USD of one direct request, at the prices of the model that answered when it is a known one. */
function costOf(tokens: Tokens, model: WriterModel): number {
  const price = PRICES[model];
  const perToken = (count: number, perMillion: number) => (count * perMillion) / 1_000_000;
  return (
    perToken(tokens.input, price.input) +
    perToken(tokens.cacheWrite, price.cacheWrite) +
    perToken(tokens.cacheRead, price.cacheRead) +
    perToken(tokens.output, price.output)
  );
}

function printCosts(previews: readonly Preview[], models: readonly WriterModel[]): void {
  console.log("\nTokens and cost per report (direct requests; the Friday batch costs about half):");
  for (const model of models) {
    const written = previews.flatMap((preview) =>
      preview.versions.flatMap((v) => (v.model === model && v.outcome.ok ? [v.outcome] : [])),
    );
    const failed = previews.length - written.length;
    if (written.length === 0) {
      console.log(`  ${model}: nothing written, ${failed} failed`);
      continue;
    }
    const tokens = written.map((outcome) => tokensOf(outcome.usage));
    const costs = written.map((outcome, i) => costOf(tokens[i], isWriterModel(outcome.model) ? outcome.model : model));
    const avg = (values: readonly number[]) => values.reduce((a, b) => a + b, 0) / values.length;
    const pick = (key: keyof Tokens) => Math.round(avg(tokens.map((t) => t[key])));
    const direct = avg(costs);
    console.log(
      `  ${model}: ${written.length} written, ${failed} failed | input ${pick("input")}, cache write ${pick("cacheWrite")}, ` +
        `cache read ${pick("cacheRead")}, output ${pick("output")} | ${direct.toFixed(4)} USD direct, ` +
        `about ${(direct / 2).toFixed(4)} USD in the batch`,
    );
  }
}

// ---------------------------------------------------------------------------
// The page
// ---------------------------------------------------------------------------

function escapeHtml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function words(text: string): number {
  return text.split(/\s+/).filter((word) => word !== "").length;
}

function shuffled<T>(items: readonly T[]): T[] {
  return items
    .map((item) => ({ item, key: randomInt(1_000_000) }))
    .sort((a, b) => a.key - b.key)
    .map(({ item }) => item);
}

function versionHtml(label: string, version: Version, preview: Preview, blind: boolean): string {
  const { outcome } = version;
  if (!outcome.ok) {
    const reason = blind ? "" : ` (${escapeHtml(outcome.reason)})`;
    return `<article><h3>${escapeHtml(label)}</h3><p class="failed">הכתיבה נכשלה${reason}</p></article>`;
  }
  const firstName = firstNameOf(preview.name);
  const holds = replaceTextProblems(preview.built.holds, reportProblems(preview.built.sheet, outcome.output));
  const text = (title: string, value: string) =>
    `<h4>${title} <span class="count">${words(value)} מילים</span></h4><p class="text">${escapeHtml(fillName(value, firstName))}</p>`;
  const holdList =
    holds.length === 0
      ? `<p class="clear">ללא עיכובים</p>`
      : `<ul class="holds">${holds.map((hold) => `<li>${escapeHtml(hold.text)}</li>`).join("")}</ul>`;
  return `<article><h3>${escapeHtml(label)}</h3>${text("לשחקן", outcome.output.player_text)}${text("להורה", outcome.output.parent_text)}${holdList}</article>`;
}

interface KeyEntry {
  number: number;
  name: string;
  versions: Record<string, WriterModel>;
}

function traineeHtml(preview: Preview, number: number, blind: boolean): { html: string; key: KeyEntry } {
  const order = blind ? shuffled(preview.versions) : preview.versions;
  const labelOf = (index: number, version: Version) => (blind ? `נוסח ${BLIND_LETTERS[index]}` : version.model);
  const versions = order.map((version, index) => versionHtml(labelOf(index, version), version, preview, blind)).join("");
  const body = preview.built.body === null ? "" : `<h4>מוצג בקוד, לא נשלח למודל</h4><pre>${escapeHtml(JSON.stringify(preview.built.body, null, 2))}</pre>`;
  const html = `<section><h2>${number}. ${escapeHtml(preview.name)}</h2>
<details><summary>דף העובדות</summary><pre>${escapeHtml(JSON.stringify(preview.built.sheet, null, 2))}</pre>${body}</details>
<div class="versions">${versions}</div></section>`;
  const key = {
    number,
    name: preview.name,
    versions: Object.fromEntries(order.map((version, index) => [labelOf(index, version), version.model])),
  };
  return { html, key };
}

const STYLE = `
:root { color-scheme: light dark; --bg: #fafaf7; --fg: #1c1c1a; --muted: #6b6b66; --card: #ffffff; --line: #e2e2dc; --hold: #a3361f; --ok: #2f6b3a; }
@media (prefers-color-scheme: dark) { :root { --bg: #161615; --fg: #ecece8; --muted: #a0a09a; --card: #20201e; --line: #34342f; --hold: #f08a6e; --ok: #8fcf99; } }
body { margin: 0; padding-block: 24px; padding-inline: 16px; background: var(--bg); color: var(--fg); font: 16px/1.6 system-ui, sans-serif; }
main { max-inline-size: 1100px; margin-inline: auto; }
h1 { margin-block: 0 4px; font-size: 1.5rem; }
.meta, .count { color: var(--muted); font-size: 0.875rem; font-weight: normal; }
section { margin-block: 32px; padding-block-start: 16px; border-block-start: 1px solid var(--line); }
details { margin-block: 8px 16px; }
pre { overflow-x: auto; padding: 12px; background: var(--card); border: 1px solid var(--line); border-radius: 8px; font-size: 0.8rem; direction: ltr; text-align: start; }
.versions { display: grid; gap: 16px; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); }
article { padding: 16px; background: var(--card); border: 1px solid var(--line); border-radius: 12px; }
h3 { margin-block: 0 8px; font-size: 1.1rem; }
h4 { margin-block: 12px 4px; font-size: 0.95rem; }
.text { margin: 0; white-space: pre-line; }
.holds { margin-block: 12px 0; padding-inline-start: 20px; color: var(--hold); }
.clear { margin-block: 12px 0; color: var(--ok); }
.failed { color: var(--hold); }`;

function pageHtml(previews: readonly Preview[], options: Options, branch: string): { html: string; key: KeyEntry[] } {
  const parts = previews.map((preview, i) => traineeHtml(preview, i + 1, options.blind));
  const years = options.birthYears === null ? "כל השנתונים" : `שנתונים ${options.birthYears.join(", ")}`;
  const html = `<!doctype html>
<html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>דוחות שבועיים: תצוגה מקדימה</title><style>${STYLE}</style></head>
<body><main><h1>דוחות שבועיים: תצוגה מקדימה</h1>
<p class="meta">שבוע ${escapeHtml(reportWeekLabel(options.week))} · ${escapeHtml(branch)} · ${years} · ${previews.length} שחקנים · הנחיות ${PROMPT_VERSION}</p>
${parts.map((part) => part.html).join("\n")}
</main></body></html>`;
  return { html, key: parts.map((part) => part.key) };
}

function keyPath(out: string): string {
  return out.endsWith(".html") ? `${out.slice(0, -".html".length)}-key.json` : `${out}-key.json`;
}

// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const options = parseOptions();
  loadEnvLocal();
  if (STYLE_GUIDE_HAS_PLACEHOLDER_SAMPLES) {
    fail("the style guide still has the placeholder samples; put in the sample reports written with Eden first");
  }
  if ((process.env.ANTHROPIC_API_KEY ?? "").trim() === "") fail("ANTHROPIC_API_KEY is not set");
  if (reportWeekEnd(options.week) >= israelToday()) console.warn("The week has not ended yet: its data is partial.");

  const server = await loadServer();
  const db = server.createAdminClient();
  const branch = await branchName(db, options.branchId);
  const picked = await pickTrainees(server, db, options);
  if (picked.length === 0) fail("no Trainee to write for in that week and branch");

  const previews = await writeAll(server, picked, options.models);
  printCosts(previews, options.models);

  const { html, key } = pageHtml(previews, options, branch);
  writeFileSync(options.out, html, "utf8");
  console.log(`\nWrote ${options.out}`);
  if (options.blind) {
    writeFileSync(keyPath(options.out), `${JSON.stringify({ week: options.week, branch, trainees: key }, null, 2)}\n`, "utf8");
    console.log(`Key (keep it from the readers): ${keyPath(options.out)}`);
  }
  console.log("The page holds children's names: keep it out of git and delete it when done.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
