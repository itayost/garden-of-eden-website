# Retention Snapshot Backfill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Backfill the members missing from the `retention_reports` snapshots for 2026-03 through 2026-06, using Arbox's `expiredMembershipsReport` and `expiredSessionsReport`.

**Architecture:** A new `src/lib/arbox/expired.ts` module adds a fetch layer for the two backward-looking Arbox reports plus a pure builder that turns their rows into `RetentionReportData`. A one-off script, `scripts/backfill-retention-expired.ts`, orchestrates per month: fetch, build, back up the stored row, merge additively, upsert. All of the load-bearing logic (identity, merge, booking index, attendance lookup, category routing) already exists in `src/lib/arbox/retention.ts` and is reused unchanged.

**Tech Stack:** TypeScript (strict), Supabase JS admin client, Vitest, `tsx` for script execution.

Spec: `docs/superpowers/specs/2026-07-13-retention-backfill-design.md`

## Global Constraints

- TypeScript strict mode. No `any`. Use `typedFrom(supabase, "table")` or the plain admin client from `scripts/import-utils.ts`.
- Immutability: never mutate objects or arrays in place.
- No emojis in code, comments, or commit messages.
- No mock-based tests. Tests cover **pure functions only**, per `CLAUDE.md`. Do not write a test that mocks `fetch` or Supabase.
- Files 200-400 lines typical, 800 max.
- Conventional commits, scoped: `feat(retention):`, `fix(retention):`, `refactor(retention):`.
- The script must be dry-run by default. It writes only when passed `--apply`.
- **Additive only.** The backfill must never remove or overwrite an entry already present in a stored snapshot.

---

### Task 1: Export the reusable internals from `retention.ts`

`retention.ts` keeps its pagination helper, its row mapper, and its attendance-range helper private. The backfill needs all three. This task is a pure refactor with no behaviour change.

**Files:**
- Modify: `src/lib/arbox/retention.ts` (lines 101, 131, 156, 305)
- Test: `src/lib/arbox/__tests__/merge-retention.test.ts` (existing, must still pass)

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `export type RawArboxRow = Record<string, unknown>`
  - `export async function fetchAllPages<T>(reportName: string, fromDate: string, toDate: string): Promise<readonly T[]>`
  - `export function toExpiringEntry(row: RawArboxRow): ExpiringMembershipEntry`
  - `export function getAttendanceMonthRanges(reportMonth: string): readonly { from: string; to: string }[]`

- [ ] **Step 1: Add the `export` keyword to four declarations**

In `src/lib/arbox/retention.ts`, change each of these lines. Change nothing else in the file.

Line 101:
```ts
export async function fetchAllPages<T>(
```

Line 131:
```ts
export type RawArboxRow = Record<string, unknown>;
```

Line 156:
```ts
export function toExpiringEntry(row: RawArboxRow): ExpiringMembershipEntry {
```

Line 305:
```ts
export function getAttendanceMonthRanges(
```

- [ ] **Step 2: Verify nothing broke**

Run: `npx tsc --noEmit && npm run test:run -- src/lib/arbox`
Expected: type check clean, existing `merge-retention.test.ts` suite PASSES.

- [ ] **Step 3: Commit**

```bash
git add src/lib/arbox/retention.ts
git commit -m "refactor(retention): export pagination, row mapper and month-range helpers

Needed by the expired-report backfill. No behaviour change."
```

---

### Task 2: Pure builder for expired-report rows

The heart of the backfill, and the only part worth testing. `expiredSessionsReport` does **not** honour the requested date range (a 2026-06-01..17 query returned 38 rows, only 23 with an `end_date` inside the window, the rest running to August). So the builder filters by `end_date` itself. It also records every row whose membership type `getCategoryForMembershipType()` refuses, rather than dropping it silently.

Both `ending_reason: "expired"` and `ending_reason: "canceled"` are kept. Do not filter on `ending_reason` at all.

**Files:**
- Create: `src/lib/arbox/expired.ts`
- Test: `src/lib/arbox/__tests__/expired.test.ts`

**Interfaces:**
- Consumes: `ExpiringMembershipEntry`, `RetentionEntry`, `RetentionReportData`, `BookingIndex`, `getCategoryForMembershipType`, `lookupAttendance` from `../retention`.
- Produces:
  - `export function isEndDateInMonth(endDate: string | null, reportMonth: string): boolean`
  - `export interface DroppedRow { readonly name: string; readonly membership_type_name: string | null; readonly end_date: string }`
  - `export interface BackfillBuildResult { readonly data: RetentionReportData; readonly dropped: readonly DroppedRow[] }`
  - `export function buildBackfillFromExpired(reportMonth: string, expired: readonly ExpiringMembershipEntry[], bookingIndex: BookingIndex, monthKeys: readonly string[]): BackfillBuildResult`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/arbox/__tests__/expired.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  isEndDateInMonth,
  buildBackfillFromExpired,
} from "../expired";
import { buildBookingIndex, type ExpiringMembershipEntry } from "../retention";

function expired(
  over: Partial<ExpiringMembershipEntry>,
): ExpiringMembershipEntry {
  return {
    user_id: null,
    name: "טסט",
    phone: null,
    membership_type_name: "מנוי מתקדמים חודש",
    end_date: "2026-06-10",
    ...over,
  };
}

const EMPTY_INDEX = buildBookingIndex([]);
const JUNE_KEYS = ["2026-06", "2026-05", "2026-04", "2026-03"];

describe("isEndDateInMonth", () => {
  it("accepts an end_date inside the report month", () => {
    expect(isEndDateInMonth("2026-06-17", "2026-06-01")).toBe(true);
  });

  it("rejects an end_date in a later month", () => {
    expect(isEndDateInMonth("2026-08-03", "2026-06-01")).toBe(false);
  });

  it("rejects an end_date in an earlier month", () => {
    expect(isEndDateInMonth("2026-05-31", "2026-06-01")).toBe(false);
  });

  it("rejects a null end_date", () => {
    expect(isEndDateInMonth(null, "2026-06-01")).toBe(false);
  });
});

describe("buildBackfillFromExpired", () => {
  it("drops rows whose end_date falls outside the report month", () => {
    const result = buildBackfillFromExpired(
      "2026-06-01",
      [
        expired({ name: "בפנים", end_date: "2026-06-05" }),
        expired({ name: "בחוץ", end_date: "2026-08-03" }),
      ],
      EMPTY_INDEX,
      JUNE_KEYS,
    );

    expect(result.data.monthly).toHaveLength(1);
    expect(result.data.monthly[0].name).toBe("בפנים");
  });

  it("routes each membership type to its category", () => {
    const result = buildBackfillFromExpired(
      "2026-06-01",
      [
        expired({ name: "א", membership_type_name: "מנוי מתקדמים חודש" }),
        expired({ name: "ב", membership_type_name: "מנוי פרו" }),
        expired({ name: "ג", membership_type_name: "כרטיסייה" }),
      ],
      EMPTY_INDEX,
      JUNE_KEYS,
    );

    expect(result.data.monthly.map((e) => e.name)).toEqual(["א"]);
    expect(result.data.pro.map((e) => e.name)).toEqual(["ב"]);
    expect(result.data.training_card.map((e) => e.name)).toEqual(["ג"]);
    expect(result.dropped).toHaveLength(0);
  });

  it("records unmapped membership types instead of silently dropping them", () => {
    const result = buildBackfillFromExpired(
      "2026-06-01",
      [
        expired({
          name: "עממי",
          membership_type_name: "מנוי עממי 3 פעמים בשבוע",
        }),
        expired({
          name: "מחנה",
          membership_type_name: "מחנה קיץ - הכנה לעונה",
        }),
      ],
      EMPTY_INDEX,
      JUNE_KEYS,
    );

    expect(result.data.monthly).toHaveLength(0);
    expect(result.data.pro).toHaveLength(0);
    expect(result.data.training_card).toHaveLength(0);
    expect(result.dropped).toHaveLength(2);
    expect(result.dropped.map((d) => d.membership_type_name)).toEqual([
      "מנוי עממי 3 פעמים בשבוע",
      "מחנה קיץ - הכנה לעונה",
    ]);
  });

  it("keeps cancelled memberships, which arrive as ordinary rows", () => {
    const result = buildBackfillFromExpired(
      "2026-06-01",
      [expired({ name: "מבוטל", end_date: "2026-06-02" })],
      EMPTY_INDEX,
      JUNE_KEYS,
    );

    expect(result.data.monthly).toHaveLength(1);
  });

  it("attaches attendance from the booking index, newest month first", () => {
    const index = buildBookingIndex([
      { user_id: 1, name: "רץ", phone: null, date: "2026-06-04", check_in: "Yes" },
      { user_id: 1, name: "רץ", phone: null, date: "2026-06-06", check_in: "Yes" },
      { user_id: 1, name: "רץ", phone: null, date: "2026-05-02", check_in: "Yes" },
    ]);

    const result = buildBackfillFromExpired(
      "2026-06-01",
      [expired({ user_id: 1, name: "רץ", end_date: "2026-06-10" })],
      index,
      JUNE_KEYS,
    );

    expect(result.data.monthly[0].attendance).toEqual([2, 1, null, null]);
  });

  it("returns an empty report when nothing falls in the month", () => {
    const result = buildBackfillFromExpired(
      "2026-06-01",
      [expired({ end_date: "2026-09-01" })],
      EMPTY_INDEX,
      JUNE_KEYS,
    );

    expect(result.data).toEqual({ monthly: [], pro: [], training_card: [] });
    expect(result.dropped).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test:run -- src/lib/arbox/__tests__/expired.test.ts`
Expected: FAIL. The suite cannot resolve `../expired` because the module does not exist yet.

- [ ] **Step 3: Write the module**

Create `src/lib/arbox/expired.ts`:

```ts
import {
  fetchAllPages,
  getCategoryForMembershipType,
  lookupAttendance,
  toExpiringEntry,
  type BookingIndex,
  type ExpiringMembershipEntry,
  type RawArboxRow,
  type RetentionEntry,
  type RetentionReportData,
} from "./retention";

// -------------------------------------------------------
// Arbox's expired* reports are the backward-looking twins of the expiring*
// reports. The expiring* ones only return memberships whose end_date is still
// in the future, which is why past months cannot be rebuilt from them.
// -------------------------------------------------------

export async function fetchExpiredMemberships(
  fromDate: string,
  toDate: string,
): Promise<readonly ExpiringMembershipEntry[]> {
  const rows = await fetchAllPages<RawArboxRow>(
    "expiredMembershipsReport",
    fromDate,
    toDate,
  );
  return rows.map(toExpiringEntry);
}

export async function fetchExpiredSessions(
  fromDate: string,
  toDate: string,
): Promise<readonly ExpiringMembershipEntry[]> {
  const rows = await fetchAllPages<RawArboxRow>(
    "expiredSessionsReport",
    fromDate,
    toDate,
  );
  return rows.map(toExpiringEntry);
}

// -------------------------------------------------------
// Pure builder
// -------------------------------------------------------

/**
 * expiredSessionsReport does not honour the requested range: a 2026-06-01..17
 * query returns rows with end_date running into August. Filter here rather than
 * trusting the API.
 */
export function isEndDateInMonth(
  endDate: string | null,
  reportMonth: string,
): boolean {
  if (!endDate) return false;
  return endDate.slice(0, 7) === reportMonth.slice(0, 7);
}

export interface DroppedRow {
  readonly name: string;
  readonly membership_type_name: string | null;
  readonly end_date: string;
}

export interface BackfillBuildResult {
  readonly data: RetentionReportData;
  readonly dropped: readonly DroppedRow[];
}

/**
 * Turn expired-report rows into a RetentionReportData for one month.
 *
 * Cancelled memberships arrive as ordinary rows and are kept: they were paying
 * members who left in that month, so they are retention-relevant. ending_reason
 * is deliberately not consulted.
 *
 * Rows whose membership type the category mapper does not recognise are
 * collected in `dropped` rather than silently discarded, so the true scope of
 * the unmapped-type problem becomes visible.
 */
export function buildBackfillFromExpired(
  reportMonth: string,
  expired: readonly ExpiringMembershipEntry[],
  bookingIndex: BookingIndex,
  monthKeys: readonly string[],
): BackfillBuildResult {
  const monthly: RetentionEntry[] = [];
  const pro: RetentionEntry[] = [];
  const trainingCard: RetentionEntry[] = [];
  const dropped: DroppedRow[] = [];

  const bucket: Record<keyof RetentionReportData, RetentionEntry[]> = {
    monthly,
    pro,
    training_card: trainingCard,
  };

  for (const member of expired) {
    if (!isEndDateInMonth(member.end_date, reportMonth)) continue;

    const category = getCategoryForMembershipType(member.membership_type_name);
    if (!category) {
      dropped.push({
        name: member.name,
        membership_type_name: member.membership_type_name,
        end_date: member.end_date ?? "",
      });
      continue;
    }

    bucket[category].push({
      user_id: member.user_id,
      name: member.name,
      phone: member.phone,
      end_date: member.end_date ?? "",
      membership_type_name: member.membership_type_name,
      attendance: lookupAttendance(
        member.user_id,
        member.phone,
        member.name,
        bookingIndex,
        monthKeys,
      ),
    });
  }

  return {
    data: { monthly, pro, training_card: trainingCard },
    dropped,
  };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test:run -- src/lib/arbox/__tests__/expired.test.ts`
Expected: PASS, 10 tests.

Then: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/lib/arbox/expired.ts src/lib/arbox/__tests__/expired.test.ts
git commit -m "feat(retention): add expired-report fetchers and pure backfill builder

expiredMembershipsReport and expiredSessionsReport are the backward-looking
twins of the expiring* reports, and are the only source that can reconstruct a
past month. The sessions report ignores the requested date range, so the builder
filters on end_date itself. Unmapped membership types are recorded rather than
silently dropped."
```

---

### Task 3: The backfill script

Orchestrates per month. **The merge direction is the critical detail.** `mergeRetentionReports(stored, fresh)` lets `fresh` win on an identity collision. To stay strictly additive we pass the **backfill as `stored`** and the **existing snapshot as `fresh`**, so an entry already in the snapshot always wins and the backfill can only contribute members that are genuinely absent. Getting this backwards would overwrite live data.

**Files:**
- Create: `scripts/backfill-retention-expired.ts`
- Read for reference: `scripts/restore-may-retention.ts` (backup and upsert pattern), `scripts/import-utils.ts` (`loadEnvLocal`, `getAdminClient`)

**Interfaces:**
- Consumes: `buildBackfillFromExpired`, `fetchExpiredMemberships`, `fetchExpiredSessions` from `../src/lib/arbox/expired`; `mergeRetentionReports`, `buildBookingIndex`, `fetchBookingsReport`, `getAttendanceMonthKeys`, `getAttendanceMonthRanges` from `../src/lib/arbox/retention`; `loadEnvLocal`, `getAdminClient` from `./import-utils`.
- Produces: an executable script. Nothing imports it.

- [ ] **Step 1: Write the script**

Create `scripts/backfill-retention-expired.ts`:

```ts
/**
 * Backfill members missing from past retention_reports snapshots.
 *
 * Why they are missing: Arbox's expiring* reports only return memberships whose
 * end_date is still in the future. Until the merge fix (8f3f9bf, 2026-06-18) the
 * daily 04:00 cron REPLACED the current month's snapshot with a fresh pull, so
 * every night it deleted the members who had expired since the 1st. March was
 * never complete either: the feature launched 2026-03-22, so its first three
 * weeks were never captured.
 *
 * Source: expiredMembershipsReport + expiredSessionsReport, the backward-looking
 * twins. Verified to include members who expired and then RENEWED
 * (client_status: active), so the reconstruction is not biased toward churn.
 *
 * ADDITIVE ONLY. Existing entries always win. This script can only add members.
 * It cannot go through persistRetentionReport(), which throws on past months by
 * design, so it writes the table directly with the admin client.
 *
 * Usage:
 *   npx tsx scripts/backfill-retention-expired.ts            # dry run
 *   npx tsx scripts/backfill-retention-expired.ts --apply    # write
 *   npx tsx scripts/backfill-retention-expired.ts --month 2026-06-01 --apply
 */

import * as fs from "fs";
import * as path from "path";
import { loadEnvLocal, getAdminClient } from "./import-utils";
import {
  buildBackfillFromExpired,
  fetchExpiredMemberships,
  fetchExpiredSessions,
  type DroppedRow,
} from "../src/lib/arbox/expired";
import {
  buildBookingIndex,
  fetchBookingsReport,
  getAttendanceMonthKeys,
  getAttendanceMonthRanges,
  mergeRetentionReports,
  type BookingEntry,
  type RetentionReportData,
} from "../src/lib/arbox/retention";

const ALL_MONTHS = ["2026-03-01", "2026-04-01", "2026-05-01", "2026-06-01"];

const APPLY = process.argv.includes("--apply");
const monthArgIdx = process.argv.indexOf("--month");
const MONTHS =
  monthArgIdx !== -1 && process.argv[monthArgIdx + 1]
    ? [process.argv[monthArgIdx + 1]]
    : ALL_MONTHS;

const EMPTY: RetentionReportData = { monthly: [], pro: [], training_card: [] };

/** Arbox rate-limits per key. Space the calls out. */
const PAUSE_MS = 1500;
const pause = () => new Promise((r) => setTimeout(r, PAUSE_MS));

function lastDayOf(reportMonth: string): string {
  const d = new Date(reportMonth + "T00:00:00");
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return `${last.getFullYear()}-${String(last.getMonth() + 1).padStart(2, "0")}-${String(last.getDate()).padStart(2, "0")}`;
}

function total(data: RetentionReportData): number {
  return (
    data.monthly.length + data.pro.length + data.training_card.length
  );
}

function earliestEndDate(data: RetentionReportData): string {
  const ends = [...data.monthly, ...data.pro, ...data.training_card]
    .map((e) => e.end_date)
    .filter(Boolean)
    .sort();
  return ends[0] ?? "-";
}

async function backfillMonth(
  supabase: ReturnType<typeof getAdminClient>,
  reportMonth: string,
  backupDir: string,
  stamp: string,
): Promise<readonly DroppedRow[]> {
  console.log(`\n${"=".repeat(60)}\n${reportMonth}\n${"=".repeat(60)}`);

  // 1) Read the stored snapshot.
  const { data: row, error: readErr } = await supabase
    .from("retention_reports")
    .select("report_month, data, created_at")
    .eq("report_month", reportMonth)
    .maybeSingle();

  if (readErr) {
    throw new Error(`read ${reportMonth} failed: ${readErr.message}`);
  }

  const stored = ((row as { data?: RetentionReportData } | null)?.data ??
    EMPTY) as RetentionReportData;
  const createdAt = (row as { created_at?: string } | null)?.created_at ?? null;

  console.log(
    `stored: n=${total(stored)}  earliest_end=${earliestEndDate(stored)}`,
  );

  // 2) Back the row up before touching anything.
  const backupPath = path.join(
    backupDir,
    `retention-backfill-${reportMonth}-${stamp}.json`,
  );
  fs.writeFileSync(backupPath, JSON.stringify(row ?? null, null, 2));
  console.log(`backup: ${backupPath}`);

  // 3) Pull both expired reports for the month. Serialized: Arbox rate-limits.
  const to = lastDayOf(reportMonth);
  const memberships = await fetchExpiredMemberships(reportMonth, to);
  await pause();
  const sessions = await fetchExpiredSessions(reportMonth, to);
  await pause();

  const expired = [...memberships, ...sessions];
  console.log(
    `arbox: memberships=${memberships.length} sessions=${sessions.length} (before end_date filter)`,
  );

  // 4) Attendance for the report month plus the three before it.
  const bookings: BookingEntry[] = [];
  for (const { from, to: rangeTo } of getAttendanceMonthRanges(reportMonth)) {
    const chunk = await fetchBookingsReport(from, rangeTo);
    bookings.push(...chunk);
    await pause();
  }
  const bookingIndex = buildBookingIndex(bookings);

  // 5) Build.
  const { data: backfill, dropped } = buildBackfillFromExpired(
    reportMonth,
    expired,
    bookingIndex,
    getAttendanceMonthKeys(reportMonth),
  );
  console.log(`built:  n=${total(backfill)} (end_date inside ${reportMonth.slice(0, 7)})`);

  // 6) Merge, ADDITIVELY.
  //
  // mergeRetentionReports(stored, fresh) lets `fresh` win on an identity
  // collision. We want the EXISTING snapshot to win, so it goes in the `fresh`
  // slot and the backfill goes in the `stored` slot. The backfill can then only
  // contribute members that are genuinely absent. Do not swap these.
  const merged = mergeRetentionReports(backfill, stored);

  const added = total(merged) - total(stored);
  console.log(
    `merged: n=${total(merged)}  earliest_end=${earliestEndDate(merged)}  ADDED=${added}`,
  );

  if (added > 0) {
    const storedNames = new Set(
      [...stored.monthly, ...stored.pro, ...stored.training_card].map(
        (e) => `${e.name}|${e.end_date}`,
      ),
    );
    const newOnes = [
      ...merged.monthly,
      ...merged.pro,
      ...merged.training_card,
    ].filter((e) => !storedNames.has(`${e.name}|${e.end_date}`));
    console.log("added members:");
    for (const e of newOnes) {
      console.log(
        `  ${e.end_date}  ${e.name}  (${e.membership_type_name ?? "-"})`,
      );
    }
  }

  if (dropped.length > 0) {
    console.log(`unmapped membership types (NOT backfilled): ${dropped.length}`);
    for (const d of dropped) {
      console.log(`  ${d.end_date}  ${d.name}  "${d.membership_type_name}"`);
    }
  }

  // 7) Write.
  if (!APPLY) {
    console.log("dry run, no write");
    return dropped;
  }

  if (added === 0) {
    console.log("nothing to add, skipping write");
    return dropped;
  }

  const upsertRow: Record<string, unknown> = {
    report_month: reportMonth,
    data: merged as unknown as Record<string, unknown>,
  };
  // Preserve the original snapshot timestamp so the row still reads as that
  // month's snapshot rather than as something built today.
  if (createdAt) upsertRow.created_at = createdAt;

  const { error: upErr } = await supabase
    .from("retention_reports")
    .upsert(upsertRow, { onConflict: "report_month" });

  if (upErr) throw new Error(`upsert ${reportMonth} failed: ${upErr.message}`);

  console.log(`WROTE ${reportMonth}. Rollback: ${backupPath}`);
  return dropped;
}

async function main(): Promise<void> {
  loadEnvLocal();
  if (!process.env.ARBOX_API_KEY) {
    throw new Error("ARBOX_API_KEY is not set");
  }

  const supabase = getAdminClient();
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.join(process.cwd(), "scripts", "backups");
  fs.mkdirSync(backupDir, { recursive: true });

  console.log(APPLY ? "MODE: APPLY (will write)" : "MODE: DRY RUN");

  const allDropped: DroppedRow[] = [];
  for (const month of MONTHS) {
    const dropped = await backfillMonth(supabase, month, backupDir, stamp);
    allDropped.push(...dropped);
  }

  console.log(`\n${"=".repeat(60)}\nUNMAPPED MEMBERSHIP TYPES ACROSS ALL MONTHS\n${"=".repeat(60)}`);
  const byType = new Map<string, number>();
  for (const d of allDropped) {
    const key = d.membership_type_name ?? "(null)";
    byType.set(key, (byType.get(key) ?? 0) + 1);
  }
  if (byType.size === 0) {
    console.log("none");
  } else {
    for (const [type, count] of [...byType.entries()].sort((a, b) => b[1] - a[1])) {
      console.log(`  ${count}x  "${type}"`);
    }
    console.log(
      "\nThese members are missing from live reports too. Decide the tab mapping with Eden, then extend getCategoryForMembershipType().",
    );
  }

  if (!APPLY) {
    console.log("\nDry run complete. Re-run with --apply to write.");
  }
}

main().catch((err) => {
  console.error("backfill failed:", err.message);
  process.exit(1);
});
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add scripts/backfill-retention-expired.ts
git commit -m "feat(retention): add additive backfill script for past snapshots

Rebuilds the missing members in the 2026-03..2026-06 snapshots from Arbox's
expired* reports. Merge direction is deliberate: the existing snapshot wins on
collision, so the script can only add members, never overwrite them. Dry-run by
default, backs each row up before writing."
```

---

### Task 4: Dry run, review, apply, verify

The script is now written but has never touched prod. This task is the human gate.

**Files:**
- Create: `scripts/inspect-retention-gaps.ts`
- Run: `scripts/backfill-retention-expired.ts`
- Run: `scripts/inspect-retention-reports.ts` (existing, read-only)

- [ ] **Step 1: Write the gap inspector**

Row counts alone cannot tell you whether the gaps closed. The signal is the
**earliest `end_date`** present in each month. Create
`scripts/inspect-retention-gaps.ts`:

```ts
/**
 * READ-ONLY. Prints the earliest end_date present in each retention snapshot.
 * That date is the gap marker: a month whose earliest end_date is the 18th is
 * missing everyone who expired on the 1st through the 17th. Writes nothing.
 *
 * Usage: npx tsx scripts/inspect-retention-gaps.ts
 */
import { loadEnvLocal, getAdminClient } from "./import-utils";

interface Entry {
  end_date: string;
}

async function main(): Promise<void> {
  loadEnvLocal();
  const supabase = getAdminClient();

  const { data, error } = await supabase
    .from("retention_reports")
    .select("report_month, data")
    .order("report_month");

  if (error) {
    console.error("select error:", error.message);
    process.exit(1);
  }

  console.log("month       |   n | earliest_end | latest_end");
  console.log("------------|-----|--------------|-----------");

  for (const row of (data ?? []) as {
    report_month: string;
    data: Record<string, Entry[]> | null;
  }[]) {
    const d = row.data;
    const ends = [
      ...(d?.monthly ?? []),
      ...(d?.pro ?? []),
      ...(d?.training_card ?? []),
    ]
      .map((e) => e.end_date)
      .filter(Boolean)
      .sort();

    console.log(
      `${row.report_month} | ${String(ends.length).padStart(3)} | ${(ends[0] ?? "-").padEnd(12)} | ${ends[ends.length - 1] ?? "-"}`,
    );
  }
}

main().catch((err) => {
  console.error("failed:", err.message);
  process.exit(1);
});
```

- [ ] **Step 2: Capture the before state**

Run: `npx tsx scripts/inspect-retention-gaps.ts | tee /tmp/retention-before.txt`

Expected, as of 2026-07-13. These earliest dates are the damage:

```text
2026-03-01 |  53 | 2026-03-22   | 2026-06-01
2026-04-01 |  77 | 2026-04-01   | 2026-06-12
2026-05-01 |  43 | 2026-05-11   | 2026-07-05
2026-06-01 |  58 | 2026-06-18   | 2026-09-06
```

- [ ] **Step 3: Commit the inspector**

```bash
git add scripts/inspect-retention-gaps.ts
git commit -m "feat(retention): add read-only gap inspector

Prints the earliest end_date per snapshot, which is the marker for how much of
each month was lost."
```

- [ ] **Step 4: Dry run all four months**

Run: `npx tsx scripts/backfill-retention-expired.ts 2>&1 | tee /tmp/retention-dryrun.txt`

Expected: for each month, an `ADDED=N` line and a list of the members that would be added. Sanity checks before going further:

- 2026-04 must report `ADDED=0`. April is healthy. A non-zero number there means the merge direction is wrong or the end_date filter is broken. **Stop and investigate.**
- 2026-06 should add roughly 24 memberships plus about 23 session cards, minus any already present.
- 2026-05 should add roughly 9 memberships plus a handful of session cards.
- 2026-03 should add the members with `end_date` from 2026-03-01 to 2026-03-21.

**Do not proceed to `--apply` until a human has read the added-member list.**

- [ ] **Step 5: Apply**

Run: `npx tsx scripts/backfill-retention-expired.ts --apply 2>&1 | tee /tmp/retention-apply.txt`

Expected: a `WROTE <month>` line for each month that had `ADDED > 0`, and a `nothing to add, skipping write` for April.

- [ ] **Step 6: Verify the gaps closed**

Run: `npx tsx scripts/inspect-retention-gaps.ts | tee /tmp/retention-after.txt`

Then: `diff /tmp/retention-before.txt /tmp/retention-after.txt`

Expected, and each of these is a hard pass/fail:

- `2026-03-01` earliest_end moves from `2026-03-22` to on or near `2026-03-01`.
- `2026-05-01` earliest_end moves from `2026-05-11` to on or near `2026-05-01`.
- `2026-06-01` earliest_end moves from `2026-06-18` to on or near `2026-06-01`.
- `2026-04-01` is **completely unchanged**, n still 77. If April moved, the merge
  was not additive. Restore every month from the `scripts/backups/` files written
  in this run and investigate before doing anything else.

- [ ] **Step 7: Confirm the notes survived**

Open `/admin/retention` in the browser, select each backfilled month, and confirm that existing notes still render against their members and that the new members appear with empty note cells.

`retention_notes` joins on `(report_month, trainee_phone)` where the phone is the raw Arbox string. The backfill writes raw phones through `toExpiringEntry`, so existing notes should be untouched. This step is what proves it.

- [ ] **Step 8: Commit the backups**

```bash
git add -A scripts/backups/
git commit -m "chore(retention): capture pre-backfill snapshot backups"
```

---

## Follow-ups, deliberately out of scope

Both are recorded in the spec. Neither belongs in this change.

1. **`expiringSessionsReport` ignores its date range.** The live כרטיסת אימונים tab is pulling session packages whose `end_date` falls outside the report month, in the current month too. `isEndDateInMonth()` from Task 2 is the fix; it needs to be applied in `buildRetentionReport()`.
2. **Unmapped membership types.** The Task 4 dry run prints the full census. Take it to Eden, decide which tab `מנוי עממי 3 פעמים בשבוע` and `מחנה קיץ - הכנה לעונה` belong in, then extend `getCategoryForMembershipType()`.
