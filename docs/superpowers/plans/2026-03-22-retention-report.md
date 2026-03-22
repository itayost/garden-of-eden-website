# Retention Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automated monthly retention report page at `/admin/retention` that shows expiring memberships grouped by type with attendance history, fetched from Arbox API and stored as monthly snapshots in Supabase.

**Architecture:** Cron job on the 1st of each month fetches `expiringMemberships` + `entrance` from Arbox, processes and stores a JSONB snapshot in `retention_reports` table. Server actions read snapshots. Admin page renders tabs (monthly/PRO/training card) with filterable tables.

**Tech Stack:** Next.js 16 App Router, Supabase (Postgres + RLS), Arbox REST API, Radix UI Tabs, TableToolbar, Vercel Cron Jobs.

**Spec:** `docs/superpowers/specs/2026-03-21-retention-report-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `supabase/migrations/20260322120000_retention_reports.sql` | Table + index + RLS policies |
| `src/lib/arbox/retention.ts` | TypeScript types (`RetentionEntry`, `RetentionReportData`, `ExpiringMembershipEntry`), Arbox fetching (`fetchExpiringMemberships`), processing logic (`buildRetentionReport`), membership type mapping, attendance matching |
| `src/app/api/cron/retention-report/route.ts` | Cron GET handler — auth, fetch, process, upsert |
| `src/lib/actions/admin-retention.ts` | Server actions: `getRetentionReportMonths()`, `getRetentionReport(month)` |
| `src/app/admin/retention/page.tsx` | Server component — fetch months + selected report, render shell |
| `src/components/admin/retention/RetentionPageClient.tsx` | Client component — month selector + tabs + table orchestration |
| `src/components/admin/retention/RetentionTable.tsx` | Client component — single table with name search |

### Modified Files

| File | Change |
|------|--------|
| `vercel.json` | Add cron entry for retention report |
| `src/components/admin/AdminNav.tsx` | Add nav item for שימור לקוחות |
| `src/components/admin/AdminBottomNav.tsx` | Add nav item in moreItems array |

---

## Task 0: Verify Arbox API Schema

**Files:**
- None (manual API test)

This MUST happen before any coding. The `expiringMemberships` report schema is undocumented.

- [ ] **Step 1: Make test API call to Arbox**

Run this to see the actual response fields:

```bash
curl --request GET \
  --url 'https://arboxserver.arboxapp.com/api/public/v3/reports/expiringMemberships?from=2026-04-01&to=2026-04-30&page=1&limit=5' \
  --header "api-key: $(grep ARBOX_API_KEY .env.local | cut -d'=' -f2 | tr -d '\"')" \
  --header 'Accept: application/json' | jq '.data[0]'
```

- [ ] **Step 2: Document the response fields**

Confirm or update the expected fields: `user_id`, `name`, `phone`, `membership_type_name`, `end_date`. Note the exact `membership_type_name` values returned (e.g., "מנוי חודשי", "מנוי PRO", "כרטיסית אימונים").

- [ ] **Step 3: Update types in plan if needed**

If field names differ from expected, update the `ExpiringMembershipEntry` type in Task 2 before proceeding.

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/20260322120000_retention_reports.sql`

- [ ] **Step 1: Create migration file**

```sql
-- Retention report monthly snapshots
CREATE TABLE retention_reports (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_month  date NOT NULL UNIQUE,
  data          jsonb NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_retention_reports_month ON retention_reports (report_month DESC);

-- RLS
ALTER TABLE retention_reports ENABLE ROW LEVEL SECURITY;

-- SELECT: admin and trainer only
CREATE POLICY "Admin and trainers can read retention reports"
  ON retention_reports FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'trainer')
        AND profiles.deleted_at IS NULL
    )
  );

-- INSERT/UPDATE/DELETE: service role only (no user policy = denied for anon/authenticated)
```

- [ ] **Step 2: Push migration**

Run: `supabase db push`

Expected: Migration applied successfully.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260322120000_retention_reports.sql
git commit -m "feat(retention): add retention_reports table with RLS"
```

---

## Task 2: Arbox Retention Fetching + Processing Logic

**Files:**
- Create: `src/lib/arbox/retention.ts`

- [ ] **Step 1: Create types and membership mapping**

```typescript
import { fetchEntranceReport, type EntranceReportEntry } from "./reports";

const BASE_URL = "https://arboxserver.arboxapp.com/api/public/v3";
const PAGE_LIMIT = 500;
const MAX_PAGES = 20;

// -------------------------------------------------------
// Types
// -------------------------------------------------------

export interface ExpiringMembershipEntry {
  readonly user_id: number | null;
  readonly name: string;
  readonly phone: string | null;
  readonly membership_type_name: string | null;
  readonly end_date: string | null;
}

export interface RetentionEntry {
  readonly user_id: number | null;
  readonly name: string;
  readonly phone: string | null;
  readonly end_date: string;
  readonly membership_type_name: string | null;
  readonly attendance: readonly (number | null)[];
}

export interface RetentionReportData {
  readonly monthly: readonly RetentionEntry[];
  readonly pro: readonly RetentionEntry[];
  readonly training_card: readonly RetentionEntry[];
}

type CategoryKey = keyof RetentionReportData;

// -------------------------------------------------------
// Membership type mapping
// Update these values after verifying Arbox API response (Task 0)
// -------------------------------------------------------

const MEMBERSHIP_TYPE_MAP: ReadonlyMap<string, CategoryKey> = new Map([
  // Monthly subscriptions
  ["מנוי חודשי", "monthly"],
  // PRO subscriptions
  ["מנוי PRO", "pro"],
  // Training cards / punch cards
  ["כרטיסית אימונים", "training_card"],
]);

export function getCategoryForMembershipType(
  typeName: string | null,
): CategoryKey | null {
  if (!typeName) return null;
  return MEMBERSHIP_TYPE_MAP.get(typeName) ?? null;
}
```

- [ ] **Step 2: Add Arbox fetching function**

Add below the types in the same file:

```typescript
// -------------------------------------------------------
// Arbox API fetching
// -------------------------------------------------------

interface ExpiringMembershipsResponse {
  readonly statusCode: number;
  readonly data: readonly ExpiringMembershipEntry[];
  readonly extra: readonly unknown[];
}

async function fetchExpiringMembershipsPage(
  from: string,
  to: string,
  page: number,
): Promise<readonly ExpiringMembershipEntry[]> {
  const apiKey = process.env.ARBOX_API_KEY;
  if (!apiKey) throw new Error("ARBOX_API_KEY is not set");

  const url = `${BASE_URL}/reports/expiringMemberships?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}&page=${page}&limit=${PAGE_LIMIT}`;
  const res = await fetch(url, {
    headers: { "api-key": apiKey, Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Arbox expiringMemberships report failed: ${res.status}`);
  }

  const json: ExpiringMembershipsResponse = await res.json();
  return json.data ?? [];
}

export async function fetchExpiringMemberships(
  from: string,
  to: string,
): Promise<readonly ExpiringMembershipEntry[]> {
  if (!from || !to || from > to) {
    throw new Error("Invalid date range for expiring memberships report");
  }

  let all: readonly ExpiringMembershipEntry[] = [];
  let page = 1;

  while (page <= MAX_PAGES) {
    const entries = await fetchExpiringMembershipsPage(from, to, page);
    all = [...all, ...entries];
    if (entries.length < PAGE_LIMIT) break;
    page++;
  }

  return all;
}
```

- [ ] **Step 3: Add attendance matching and report building**

Add below the fetching code in the same file:

```typescript
// -------------------------------------------------------
// Processing: match attendance to expiring members
// -------------------------------------------------------

function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;
  return phone.replace(/[\s\-()]/g, "").replace(/^0/, "972");
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function getMonthKey(dateStr: string): string {
  // Returns "YYYY-MM" from a "YYYY-MM-DD" date string (timezone-safe)
  return dateStr.slice(0, 7);
}

/**
 * Calculate per-month attendance counts for the 3 months before reportMonth.
 *
 * @param reportMonth - First of the report month, e.g. "2026-03-01"
 * @returns [month1Count, month2Count, month3Count] where month1 is the most recent
 */
function calculateAttendance(
  memberUserId: number | null,
  memberPhone: string | null,
  memberName: string,
  entrances: readonly EntranceReportEntry[],
  monthKeys: readonly string[],
): readonly (number | null)[] {
  const normalizedMemberPhone = normalizePhone(memberPhone);
  const normalizedMemberName = normalizeName(memberName);

  // Filter entrances that belong to this member
  const memberEntrances = entrances.filter((e) => {
    // Priority 1: user_id match
    if (memberUserId != null && e.user_id != null && memberUserId === e.user_id) {
      return true;
    }
    // Priority 2: phone match
    if (normalizedMemberPhone && normalizePhone(e.phone) === normalizedMemberPhone) {
      return true;
    }
    // Priority 3: name match
    if (normalizeName(e.name) === normalizedMemberName) {
      return true;
    }
    return false;
  });

  // Count per month
  return monthKeys.map((mk) => {
    const count = memberEntrances.filter((e) => getMonthKey(e.date) === mk).length;
    return count > 0 ? count : null;
  });
}

/**
 * Get the 3 month keys (YYYY-MM) before a given report month.
 * e.g. for "2026-03-01" returns ["2026-02", "2026-01", "2025-12"]
 */
export function getAttendanceMonthKeys(reportMonth: string): readonly string[] {
  const d = new Date(reportMonth);
  const keys: string[] = [];
  for (let i = 1; i <= 3; i++) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    keys.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

/**
 * Get the date range covering the 3 months before reportMonth.
 * e.g. for "2026-03-01" returns { from: "2025-12-01", to: "2026-02-28" }
 */
export function getAttendanceDateRange(reportMonth: string): {
  from: string;
  to: string;
} {
  const d = new Date(reportMonth);
  const to = new Date(d.getFullYear(), d.getMonth(), 0); // last day of previous month
  const from = new Date(d.getFullYear(), d.getMonth() - 3, 1); // first day 3 months back

  const fmt = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

  return { from: fmt(from), to: fmt(to) };
}

// -------------------------------------------------------
// Main report builder
// -------------------------------------------------------

export async function buildRetentionReport(
  reportMonth: string,
): Promise<RetentionReportData> {
  const d = new Date(reportMonth);
  const fromExpiring = reportMonth;
  const toExpiring = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()}`;

  // Fetch expiring memberships for current month
  const expiringMembers = await fetchExpiringMemberships(fromExpiring, toExpiring);

  // Fetch entrance data for previous 3 months
  const { from: attendanceFrom, to: attendanceTo } =
    getAttendanceDateRange(reportMonth);
  const entrances = await fetchEntranceReport(attendanceFrom, attendanceTo);

  const monthKeys = getAttendanceMonthKeys(reportMonth);

  // Group by category
  const grouped: Record<CategoryKey, RetentionEntry[]> = {
    monthly: [],
    pro: [],
    training_card: [],
  };

  for (const member of expiringMembers) {
    const category = getCategoryForMembershipType(member.membership_type_name);
    if (!category) {
      console.warn(
        `[Retention] Unknown membership type: "${member.membership_type_name}" for ${member.name}`,
      );
      continue;
    }

    const attendance = calculateAttendance(
      member.user_id,
      member.phone,
      member.name,
      entrances,
      monthKeys,
    );

    grouped[category] = [
      ...grouped[category],
      {
        user_id: member.user_id,
        name: member.name,
        phone: member.phone,
        end_date: member.end_date ?? "",
        membership_type_name: member.membership_type_name,
        attendance,
      },
    ];
  }

  // Sort each category by end_date descending
  const sortByEndDate = (a: RetentionEntry, b: RetentionEntry) =>
    b.end_date.localeCompare(a.end_date);

  return {
    monthly: [...grouped.monthly].sort(sortByEndDate),
    pro: [...grouped.pro].sort(sortByEndDate),
    training_card: [...grouped.training_card].sort(sortByEndDate),
  };
}
```

- [ ] **Step 4: Verify file compiles**

Run: `npx tsc --noEmit`

Expected: No errors in `src/lib/arbox/retention.ts`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/arbox/retention.ts
git commit -m "feat(retention): add Arbox retention report fetching and processing"
```

---

## Task 3: Cron Job Endpoint

**Files:**
- Create: `src/app/api/cron/retention-report/route.ts`

- [ ] **Step 1: Create the cron route**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import { buildRetentionReport } from "@/lib/arbox/retention";

export const maxDuration = 60;

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    console.error("[Retention Report] CRON_SECRET env var is not set");
    return NextResponse.json(
      { error: "Server misconfiguration" },
      { status: 500 },
    );
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.ARBOX_API_KEY) {
    console.error("[Retention Report] ARBOX_API_KEY env var is not set");
    return NextResponse.json(
      { error: "ARBOX_API_KEY not configured" },
      { status: 500 },
    );
  }

  try {
    // Determine report month (1st of current month)
    const now = new Date();
    const reportMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

    console.log(`[Retention Report] Building report for ${reportMonth}`);

    const data = await buildRetentionReport(reportMonth);

    const totalEntries =
      data.monthly.length + data.pro.length + data.training_card.length;
    console.log(
      `[Retention Report] Found ${totalEntries} expiring memberships (monthly: ${data.monthly.length}, pro: ${data.pro.length}, training_card: ${data.training_card.length})`,
    );

    // Upsert into Supabase
    const supabase = createAdminClient();
    const { error } = await typedFrom(supabase, "retention_reports")
      .upsert(
        { report_month: reportMonth, data: data as unknown as Record<string, unknown> },
        { onConflict: "report_month" },
      );

    if (error) {
      console.error("[Retention Report] Supabase upsert error:", error);
      return NextResponse.json(
        { error: "Failed to save report" },
        { status: 500 },
      );
    }

    console.log(`[Retention Report] Saved report for ${reportMonth}`);

    return NextResponse.json({
      success: true,
      report_month: reportMonth,
      counts: {
        monthly: data.monthly.length,
        pro: data.pro.length,
        training_card: data.training_card.length,
      },
    });
  } catch (error) {
    console.error("[Retention Report] Fatal error:", error);
    return NextResponse.json({ error: "Report generation failed" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Add cron schedule to vercel.json**

In `vercel.json`, add to the `crons` array:

```json
{
  "path": "/api/cron/retention-report",
  "schedule": "0 3 1 * *"
}
```

The full `vercel.json` should look like:

```json
{
  "crons": [
    {
      "path": "/api/cron/auto-clockout",
      "schedule": "*/10 * * * *"
    },
    {
      "path": "/api/cron/arbox-sync",
      "schedule": "0 2 * * *"
    },
    {
      "path": "/api/cron/recalculate-benchmarks",
      "schedule": "0 3 * * *"
    },
    {
      "path": "/api/cron/retention-report",
      "schedule": "0 3 1 * *"
    }
  ]
}
```

Note: `recalculate-benchmarks` also runs at `0 3 * * *` (daily), while retention only runs on the 1st. They could overlap on the 1st of each month but both are idempotent so this is fine.

- [ ] **Step 3: Verify file compiles**

Run: `npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/cron/retention-report/route.ts vercel.json
git commit -m "feat(retention): add cron job for monthly retention report generation"
```

---

## Task 4: Server Actions

**Files:**
- Create: `src/lib/actions/admin-retention.ts`

- [ ] **Step 1: Create server actions file**

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { typedFrom } from "@/lib/supabase/helpers";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import type { RetentionReportData } from "@/lib/arbox/retention";

export interface RetentionReportMonth {
  readonly report_month: string;
  readonly created_at: string;
}

export async function getRetentionReportMonths(): Promise<
  readonly RetentionReportMonth[]
> {
  const { error } = await verifyAdminOrTrainer();
  if (error) return [];

  const supabase = await createClient();
  const { data } = await typedFrom(supabase, "retention_reports")
    .select("report_month, created_at")
    .order("report_month", { ascending: false });

  return data ?? [];
}

export async function getRetentionReport(
  reportMonth: string,
): Promise<RetentionReportData | null> {
  const { error } = await verifyAdminOrTrainer();
  if (error) return null;

  const supabase = await createClient();
  const { data } = await typedFrom(supabase, "retention_reports")
    .select("data")
    .eq("report_month", reportMonth)
    .single();

  if (!data) return null;

  return data.data as unknown as RetentionReportData;
}
```

- [ ] **Step 2: Verify file compiles**

Run: `npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/actions/admin-retention.ts
git commit -m "feat(retention): add server actions for reading retention reports"
```

---

## Task 5: Retention Table Component

**Files:**
- Create: `src/components/admin/retention/RetentionTable.tsx`

- [ ] **Step 1: Create the table component**

```typescript
"use client";

import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TableToolbar } from "@/components/admin/TableToolbar";
import type { RetentionEntry } from "@/lib/arbox/retention";

const HEBREW_MONTHS = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
] as const;

function getMonthName(monthKey: string): string {
  const [, monthStr] = monthKey.split("-");
  const monthIndex = parseInt(monthStr, 10) - 1;
  return HEBREW_MONTHS[monthIndex] ?? monthKey;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  // Timezone-safe: split "YYYY-MM-DD" directly
  const [year, month, day] = dateStr.split("-");
  return `${parseInt(day, 10)}/${parseInt(month, 10)}/${year}`;
}

interface RetentionTableProps {
  entries: readonly RetentionEntry[];
  monthKeys: readonly string[];
}

export function RetentionTable({ entries, monthKeys }: RetentionTableProps) {
  const [search, setSearch] = useState("");

  const filtered = search
    ? entries.filter((e) =>
        e.name.toLowerCase().includes(search.toLowerCase()),
      )
    : entries;

  return (
    <div className="space-y-4">
      <TableToolbar
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="חיפוש לפי שם..."
      />

      {filtered.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">
          אין נתונים לחודש זה
        </p>
      ) : (
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">שם לקוח</TableHead>
                <TableHead className="text-right">תאריך סיום</TableHead>
                {monthKeys.map((mk) => (
                  <TableHead key={mk} className="text-center">
                    {getMonthName(mk)}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((entry, i) => (
                <TableRow key={`${entry.user_id ?? entry.name}-${i}`}>
                  <TableCell className="font-medium">{entry.name}</TableCell>
                  <TableCell>{formatDate(entry.end_date)}</TableCell>
                  {entry.attendance.map((count, mi) => (
                    <TableCell key={monthKeys[mi]} className="text-center">
                      {count != null ? count : "—"}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify file compiles**

Run: `npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/retention/RetentionTable.tsx
git commit -m "feat(retention): add RetentionTable component"
```

---

## Task 6: Retention Page Client Component (Tabs + Month Selector)

**Files:**
- Create: `src/components/admin/retention/RetentionPageClient.tsx`

- [ ] **Step 1: Create the client component**

```typescript
"use client";

import { useState, useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RetentionTable } from "./RetentionTable";
import { getRetentionReport } from "@/lib/actions/admin-retention";
import { getAttendanceMonthKeys } from "@/lib/arbox/retention";
import type { RetentionReportData } from "@/lib/arbox/retention";
import type { RetentionReportMonth } from "@/lib/actions/admin-retention";

const HEBREW_MONTHS = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
] as const;

function formatReportMonth(reportMonth: string): string {
  // Timezone-safe: split "YYYY-MM-DD" directly
  const [year, monthStr] = reportMonth.split("-");
  const monthIndex = parseInt(monthStr, 10) - 1;
  return `${HEBREW_MONTHS[monthIndex]} ${year}`;
}

interface RetentionPageClientProps {
  months: readonly RetentionReportMonth[];
  initialMonth: string | null;
  initialData: RetentionReportData | null;
}

export function RetentionPageClient({
  months,
  initialMonth,
  initialData,
}: RetentionPageClientProps) {
  const [selectedMonth, setSelectedMonth] = useState(initialMonth ?? "");
  const [data, setData] = useState<RetentionReportData | null>(initialData);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!selectedMonth || selectedMonth === initialMonth) return;

    let cancelled = false;
    setLoading(true);

    getRetentionReport(selectedMonth)
      .then((result) => {
        if (cancelled) return;
        setData(result);
      })
      .catch((err) => {
        if (cancelled) return;
        console.error("[Retention] Failed to load report:", err);
        setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedMonth, initialMonth]);

  if (months.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-12">
        אין דוחות זמינים
      </p>
    );
  }

  const monthKeys = selectedMonth
    ? getAttendanceMonthKeys(selectedMonth)
    : [];

  return (
    <div className="space-y-6">
      {/* Month selector */}
      <Select value={selectedMonth} onValueChange={setSelectedMonth}>
        <SelectTrigger className="w-full sm:w-48">
          <SelectValue placeholder="בחר חודש" />
        </SelectTrigger>
        <SelectContent>
          {months.map((m) => (
            <SelectItem key={m.report_month} value={m.report_month}>
              {formatReportMonth(m.report_month)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {loading ? (
        <p className="text-center text-muted-foreground py-8">טוען...</p>
      ) : data ? (
        <Tabs defaultValue="monthly" dir="rtl">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="monthly">
              מנוי חודשי ({data.monthly.length})
            </TabsTrigger>
            <TabsTrigger value="pro">
              מנוי PRO ({data.pro.length})
            </TabsTrigger>
            <TabsTrigger value="training_card">
              כרטיסת אימונים ({data.training_card.length})
            </TabsTrigger>
          </TabsList>

          <TabsContent value="monthly" className="mt-4">
            <RetentionTable entries={data.monthly} monthKeys={monthKeys} />
          </TabsContent>

          <TabsContent value="pro" className="mt-4">
            <RetentionTable entries={data.pro} monthKeys={monthKeys} />
          </TabsContent>

          <TabsContent value="training_card" className="mt-4">
            <RetentionTable entries={data.training_card} monthKeys={monthKeys} />
          </TabsContent>
        </Tabs>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Verify file compiles**

Run: `npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/retention/RetentionPageClient.tsx
git commit -m "feat(retention): add RetentionPageClient with month selector and tabs"
```

---

## Task 7: Admin Page (Server Component)

**Files:**
- Create: `src/app/admin/retention/page.tsx`

- [ ] **Step 1: Create the page**

```typescript
import type { Metadata } from "next";
import {
  getRetentionReportMonths,
  getRetentionReport,
} from "@/lib/actions/admin-retention";
import { RetentionPageClient } from "@/components/admin/retention/RetentionPageClient";

export const metadata: Metadata = {
  title: "שימור לקוחות | Garden of Eden",
};

export default async function RetentionPage() {
  const months = await getRetentionReportMonths();
  const latestMonth = months.length > 0 ? months[0].report_month : null;
  const initialData = latestMonth
    ? await getRetentionReport(latestMonth)
    : null;

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold">שימור לקוחות</h1>
      <RetentionPageClient
        months={months}
        initialMonth={latestMonth}
        initialData={initialData}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify file compiles**

Run: `npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/retention/page.tsx
git commit -m "feat(retention): add /admin/retention page"
```

---

## Task 8: Navigation Links

**Files:**
- Modify: `src/components/admin/AdminNav.tsx`
- Modify: `src/components/admin/AdminBottomNav.tsx`

- [ ] **Step 1: Add to desktop nav**

In `src/components/admin/AdminNav.tsx`, add the import for the `ShieldCheck` icon (or `RefreshCw` — pick a suitable Lucide icon for retention):

Add to imports:
```typescript
import { RefreshCw } from "lucide-react";
```

Note: `RefreshCw` is already available in lucide-react. Pick the most fitting icon.

Add to `navItems` array (before the `videos` entry which is `adminOnly: true`):

```typescript
{ href: "/admin/retention", label: "שימור לקוחות", icon: RefreshCw, adminOnly: false },
```

- [ ] **Step 2: Add to mobile nav**

In `src/components/admin/AdminBottomNav.tsx`, add the import:

```typescript
import { RefreshCw } from "lucide-react";
```

Add to `moreItems` array (before the `videos` entry):

```typescript
{ href: "/admin/retention", label: "שימור לקוחות", icon: RefreshCw, adminOnly: false },
```

- [ ] **Step 3: Verify file compiles**

Run: `npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/AdminNav.tsx src/components/admin/AdminBottomNav.tsx
git commit -m "feat(retention): add retention link to admin navigation"
```

---

## Task 9: Manual Test — Generate First Report

- [ ] **Step 1: Test the cron endpoint locally**

Start the dev server, then call the cron endpoint:

```bash
curl -X GET http://localhost:3000/api/cron/retention-report \
  -H "Authorization: Bearer $(grep CRON_SECRET .env.local | cut -d'=' -f2 | tr -d '\"')"
```

Expected: JSON response with `success: true` and counts for each category.

- [ ] **Step 2: Verify data in Supabase**

Check the `retention_reports` table in the Supabase dashboard. Confirm:
- One row exists with `report_month` = first of current month
- `data` JSONB has `monthly`, `pro`, `training_card` arrays
- Entries have `user_id`, `name`, `phone`, `end_date`, `attendance`

- [ ] **Step 3: Verify the admin page**

Navigate to `http://localhost:3000/admin/retention`.

Confirm:
- Page title "שימור לקוחות" is visible
- Month selector shows the current month
- Three tabs are rendered with correct counts
- Table shows Hebrew month names as column headers
- Search filter works (type a name, table filters)
- Empty categories show "אין נתונים לחודש זה"

- [ ] **Step 4: Check membership type mapping**

If any members appear in the console as `[Retention] Unknown membership type`, note the actual `membership_type_name` values and update the `MEMBERSHIP_TYPE_MAP` in `src/lib/arbox/retention.ts`.

- [ ] **Step 5: Final commit if mapping was updated**

```bash
git add src/lib/arbox/retention.ts
git commit -m "fix(retention): update membership type mapping from actual Arbox data"
```

---

## Task 10: Build Verification

- [ ] **Step 1: Run full type check**

Run: `npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 2: Run lint**

Run: `npm run lint`

Expected: No errors.

- [ ] **Step 3: Run production build**

Run: `npm run build`

Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit any fixes**

If build revealed issues, fix and commit:

```bash
git add -A
git commit -m "fix(retention): resolve build issues"
```
