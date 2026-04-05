# Retention Notes & Current Month Attendance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-report notes column and current month attendance (4th column, daily cron) to the retention page.

**Architecture:** New `retention_notes` table stores free-text notes keyed by (report_month, trainee_phone). Attendance expands from 3 to 4 months by including the current month. A daily cron updates current month attendance in the existing `retention_reports` JSONB. UI adds a notes column with inline editing and a 4th attendance column.

**Tech Stack:** Supabase (Postgres + RLS), Next.js Server Actions, React (client components), Zod validation, Vercel Cron

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `supabase/migrations/20260405120000_retention_notes.sql` | Create `retention_notes` table + RLS policies |
| `src/app/api/cron/retention-attendance/route.ts` | Daily cron: update current month attendance in existing report |
| `src/components/admin/retention/RetentionNoteCell.tsx` | Inline note editing cell component |

### Modified Files
| File | Changes |
|------|---------|
| `src/lib/arbox/retention.ts` | Expand attendance from 3 to 4 months (include current month) |
| `src/lib/actions/admin-retention.ts` | Add `upsertRetentionNote` and `getRetentionNotes` server actions |
| `src/components/admin/retention/RetentionTable.tsx` | Add notes column + 4th attendance column + current-month styling |
| `src/components/admin/retention/RetentionPageClient.tsx` | Load notes per report, pass to table, handle note save |
| `src/app/admin/retention/page.tsx` | Pass initial notes to client |
| `vercel.json` | Add daily cron schedule |

---

## Task 1: Database Migration — `retention_notes` Table

**Files:**
- Create: `supabase/migrations/20260405120000_retention_notes.sql`

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/20260405120000_retention_notes.sql`:

```sql
-- Retention notes: per-report, per-trainee free-text notes
CREATE TABLE retention_notes (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_month   date NOT NULL,
  trainee_phone  text NOT NULL,
  trainee_name   text NOT NULL,
  note           text NOT NULL,
  author_id      uuid NOT NULL REFERENCES auth.users(id),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE(report_month, trainee_phone)
);

CREATE INDEX idx_retention_notes_month ON retention_notes(report_month);

-- RLS
ALTER TABLE retention_notes ENABLE ROW LEVEL SECURITY;

-- SELECT: admin and trainer
CREATE POLICY "Admin and trainers can read retention notes"
  ON retention_notes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'trainer')
        AND profiles.deleted_at IS NULL
    )
  );

-- INSERT: admin and trainer
CREATE POLICY "Admin and trainers can create retention notes"
  ON retention_notes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'trainer')
        AND profiles.deleted_at IS NULL
    )
    AND author_id = auth.uid()
  );

-- UPDATE: author can edit own, admin can edit any
CREATE POLICY "Authors and admins can update retention notes"
  ON retention_notes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'trainer')
        AND profiles.deleted_at IS NULL
    )
    AND (
      author_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
          AND profiles.deleted_at IS NULL
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'trainer')
        AND profiles.deleted_at IS NULL
    )
  );

-- DELETE: author can delete own, admin can delete any (for empty-note cleanup)
CREATE POLICY "Authors and admins can delete retention notes"
  ON retention_notes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('admin', 'trainer')
        AND profiles.deleted_at IS NULL
    )
    AND (
      author_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
          AND profiles.deleted_at IS NULL
      )
    )
  );
```

- [ ] **Step 2: Push migration to Supabase**

Run: `supabase db push`

Expected: Migration applies successfully, `retention_notes` table created.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260405120000_retention_notes.sql
git commit -m "feat(retention): add retention_notes table with RLS"
```

---

## Task 2: Server Actions — Notes CRUD

**Files:**
- Modify: `src/lib/actions/admin-retention.ts`

- [ ] **Step 1: Add Zod schema and types for notes**

Add at the top of `src/lib/actions/admin-retention.ts`, after existing imports:

```typescript
import { z } from "zod";

export interface RetentionNote {
  readonly note: string;
  readonly author_id: string;
  readonly updated_at: string;
}
```

- [ ] **Step 2: Add `getRetentionNotes` server action**

Add to `src/lib/actions/admin-retention.ts`:

```typescript
export async function getRetentionNotes(
  reportMonth: string,
): Promise<ReadonlyMap<string, RetentionNote>> {
  const { error } = await verifyAdminOrTrainer();
  if (error) return new Map();

  const supabase = await createClient();
  const { data } = await typedFrom(supabase, "retention_notes")
    .select("trainee_phone, note, author_id, updated_at")
    .eq("report_month", reportMonth);

  const map = new Map<string, RetentionNote>();
  for (const row of data ?? []) {
    map.set(row.trainee_phone as string, {
      note: row.note as string,
      author_id: row.author_id as string,
      updated_at: row.updated_at as string,
    });
  }
  return map;
}
```

- [ ] **Step 3: Add `upsertRetentionNote` server action**

Add to `src/lib/actions/admin-retention.ts`:

```typescript
const upsertNoteSchema = z.object({
  reportMonth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  traineePhone: z.string().min(1),
  traineeName: z.string().min(1),
  note: z.string(),
});

export async function upsertRetentionNote(
  reportMonth: string,
  traineePhone: string,
  traineeName: string,
  note: string,
): Promise<{ error: string | null }> {
  const { error: authError, user } = await verifyAdminOrTrainer();
  if (authError) return { error: authError };

  const parsed = upsertNoteSchema.safeParse({
    reportMonth,
    traineePhone,
    traineeName,
    note,
  });
  if (!parsed.success) return { error: "קלט לא תקין" };

  const supabase = await createClient();

  // If note is empty, delete the row
  if (!note.trim()) {
    await typedFrom(supabase, "retention_notes")
      .delete()
      .eq("report_month", reportMonth)
      .eq("trainee_phone", traineePhone);
    return { error: null };
  }

  const { error: dbError } = await typedFrom(supabase, "retention_notes").upsert(
    {
      report_month: reportMonth,
      trainee_phone: traineePhone,
      trainee_name: traineeName,
      note: note.trim(),
      author_id: user!.id,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "report_month,trainee_phone" },
  );

  if (dbError) {
    console.error("[RetentionNotes] Upsert error:", dbError);
    return { error: "שגיאה בשמירת ההערה" };
  }

  return { error: null };
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/actions/admin-retention.ts
git commit -m "feat(retention): add upsertRetentionNote and getRetentionNotes server actions"
```

---

## Task 3: Expand Attendance to 4 Months

**Files:**
- Modify: `src/lib/arbox/retention.ts`

- [ ] **Step 1: Update `getAttendanceMonthKeys` to include current month**

In `src/lib/arbox/retention.ts`, replace the `getAttendanceMonthKeys` function:

```typescript
/**
 * Get 4 month keys (YYYY-MM): current month + 3 previous months.
 * Index 0 = current month (report month), 1-3 = previous months.
 * e.g. for "2026-04-01" returns ["2026-04", "2026-03", "2026-02", "2026-01"]
 */
export function getAttendanceMonthKeys(
  reportMonth: string,
): readonly string[] {
  const d = new Date(reportMonth + "T00:00:00");
  const keys: string[] = [];
  // Index 0: current month (the report month itself)
  keys.push(
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
  );
  // Indexes 1-3: previous 3 months
  for (let i = 1; i <= 3; i++) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    keys.push(
      `${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`,
    );
  }
  return keys;
}
```

- [ ] **Step 2: Update `getAttendanceMonthRanges` to include current month**

Replace the `getAttendanceMonthRanges` function:

```typescript
/**
 * Get 4 individual month ranges: current month + 3 previous months
 * (respects Arbox 31-day API limit per request).
 */
function getAttendanceMonthRanges(
  reportMonth: string,
): readonly { from: string; to: string }[] {
  const d = new Date(reportMonth + "T00:00:00");
  const ranges: { from: string; to: string }[] = [];
  // Index 0: current month (partial — up to today or end of month)
  const currentFirst = new Date(d.getFullYear(), d.getMonth(), 1);
  const currentLast = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  ranges.push({ from: formatDateYMD(currentFirst), to: formatDateYMD(currentLast) });
  // Indexes 1-3: previous 3 months
  for (let i = 1; i <= 3; i++) {
    const firstDay = new Date(d.getFullYear(), d.getMonth() - i, 1);
    const lastDay = new Date(d.getFullYear(), d.getMonth() - i + 1, 0);
    ranges.push({ from: formatDateYMD(firstDay), to: formatDateYMD(lastDay) });
  }
  return ranges;
}
```

- [ ] **Step 3: Update `buildRetentionReport` comment**

In `buildRetentionReport`, update the comment on line 264 from:

```typescript
  // Fetch bookings for previous 3 months (one call per month, 31-day API limit)
```

to:

```typescript
  // Fetch bookings for current + previous 3 months (one call per month, 31-day API limit)
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/arbox/retention.ts
git commit -m "feat(retention): expand attendance to 4 months (include current month)"
```

---

## Task 4: Daily Attendance Cron Job

**Files:**
- Create: `src/app/api/cron/retention-attendance/route.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Create the daily attendance cron route**

Create `src/app/api/cron/retention-attendance/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { typedFrom } from "@/lib/supabase/helpers";
import type { RetentionReportData, RetentionEntry } from "@/lib/arbox/retention";
import { getAttendanceMonthKeys } from "@/lib/arbox/retention";
import { normalizePhone } from "@/lib/arbox/normalize-phone";

export const maxDuration = 60;

// Arbox constants (same as in retention.ts)
const ARBOX_BASE_URL = process.env.ARBOX_BASE_URL ?? "https://apiapp.arboxapp.com/api/v2";
const ARBOX_PAGE_LIMIT = 200;
const ARBOX_MAX_PAGES = 50;

interface BookingEntry {
  readonly user_id: number | null;
  readonly name: string;
  readonly phone: string | null;
  readonly date: string;
  readonly check_in: string;
}

interface ArboxReportResponse {
  readonly statusCode: number;
  readonly data: readonly BookingEntry[];
}

async function fetchBookingsPage(
  fromDate: string,
  toDate: string,
  page: number,
): Promise<readonly BookingEntry[]> {
  const apiKey = process.env.ARBOX_API_KEY;
  if (!apiKey) throw new Error("ARBOX_API_KEY is not set");

  const url = `${ARBOX_BASE_URL}/reports/bookingsReport?fromDate=${encodeURIComponent(fromDate)}&toDate=${encodeURIComponent(toDate)}&page=${page}&limit=${ARBOX_PAGE_LIMIT}`;
  const res = await fetch(url, {
    headers: { "api-key": apiKey, Accept: "application/json" },
    cache: "no-store",
  });

  if (!res.ok) throw new Error(`Arbox bookingsReport failed: ${res.status}`);

  const json: ArboxReportResponse = await res.json();
  return json.data ?? [];
}

async function fetchAllBookings(
  fromDate: string,
  toDate: string,
): Promise<readonly BookingEntry[]> {
  const all: BookingEntry[] = [];
  let page = 1;

  while (page <= ARBOX_MAX_PAGES) {
    const entries = await fetchBookingsPage(fromDate, toDate, page);
    all.push(...entries);
    if (entries.length < ARBOX_PAGE_LIMIT) break;
    page++;
  }

  return all;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function countAttendanceForMember(
  memberUserId: number | null,
  memberPhone: string | null,
  memberName: string,
  bookings: readonly BookingEntry[],
): number | null {
  const normalizedPhone = normalizePhone(memberPhone);
  const normalizedName = normalizeName(memberName);

  let count = 0;
  for (const b of bookings) {
    if (b.check_in !== "Yes") continue;

    const match =
      (memberUserId != null && b.user_id === memberUserId) ||
      (normalizedPhone != null && normalizePhone(b.phone) === normalizedPhone) ||
      normalizeName(b.name) === normalizedName;

    if (match) count++;
  }

  return count > 0 ? count : null;
}

function formatDateYMD(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function updateAttendanceInEntries(
  entries: readonly RetentionEntry[],
  bookings: readonly BookingEntry[],
): readonly RetentionEntry[] {
  return entries.map((entry) => {
    const currentMonthCount = countAttendanceForMember(
      entry.user_id,
      entry.phone,
      entry.name,
      bookings,
    );

    // Build new attendance array: index 0 = current month, rest stays the same
    const existingPrevious = entry.attendance.length > 1
      ? entry.attendance.slice(1)
      : entry.attendance;

    return {
      ...entry,
      attendance: [currentMonthCount, ...existingPrevious],
    };
  });
}

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET) {
    console.error("[Retention Attendance] CRON_SECRET env var is not set");
    return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 });
  }

  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.ARBOX_API_KEY) {
    console.error("[Retention Attendance] ARBOX_API_KEY env var is not set");
    return NextResponse.json({ error: "ARBOX_API_KEY not configured" }, { status: 500 });
  }

  try {
    // Current month report
    const now = new Date();
    const reportMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

    const supabase = createAdminClient();
    const { data: reportRow } = await typedFrom(supabase, "retention_reports")
      .select("data")
      .eq("report_month", reportMonth)
      .single();

    if (!reportRow) {
      console.log(`[Retention Attendance] No report found for ${reportMonth}, skipping`);
      return NextResponse.json({ success: true, skipped: true, reason: "no report" });
    }

    const reportData = reportRow.data as unknown as RetentionReportData;

    // Fetch current month bookings
    const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const bookings = await fetchAllBookings(
      formatDateYMD(firstDay),
      formatDateYMD(lastDay),
    );

    console.log(`[Retention Attendance] Fetched ${bookings.length} bookings for ${reportMonth}`);

    // Update attendance[0] for each category
    const updatedData: RetentionReportData = {
      monthly: updateAttendanceInEntries(reportData.monthly, bookings),
      pro: updateAttendanceInEntries(reportData.pro, bookings),
      training_card: updateAttendanceInEntries(reportData.training_card, bookings),
    };

    // Save back
    const { error } = await typedFrom(supabase, "retention_reports").update({
      data: updatedData as unknown as Record<string, unknown>,
    }).eq("report_month", reportMonth);

    if (error) {
      console.error("[Retention Attendance] Update error:", error);
      return NextResponse.json({ error: "Failed to update attendance" }, { status: 500 });
    }

    console.log(`[Retention Attendance] Updated current month attendance for ${reportMonth}`);

    return NextResponse.json({
      success: true,
      report_month: reportMonth,
      bookings_fetched: bookings.length,
    });
  } catch (error) {
    console.error("[Retention Attendance] Fatal error:", error);
    return NextResponse.json({ error: "Attendance update failed" }, { status: 500 });
  }
}
```

- [ ] **Step 2: Add daily cron to `vercel.json`**

In `vercel.json`, add to the `crons` array:

```json
{
  "path": "/api/cron/retention-attendance",
  "schedule": "0 4 * * *"
}
```

The full `crons` array becomes:

```json
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
    "schedule": "0 4 1 * *"
  },
  {
    "path": "/api/cron/retention-attendance",
    "schedule": "0 5 * * *"
  }
]
```

Note: schedule at 05:00 UTC (after the monthly report cron at 04:00) to avoid race conditions on the 1st of the month.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/cron/retention-attendance/route.ts vercel.json
git commit -m "feat(retention): add daily cron for current month attendance updates"
```

---

## Task 5: Notes Cell Component

**Files:**
- Create: `src/components/admin/retention/RetentionNoteCell.tsx`

- [ ] **Step 1: Create the inline note editor component**

Create `src/components/admin/retention/RetentionNoteCell.tsx`:

```tsx
"use client";

import { useState, useRef, useEffect } from "react";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

interface RetentionNoteCellProps {
  note: string;
  onSave: (note: string) => Promise<void>;
}

export function RetentionNoteCell({ note, onSave }: RetentionNoteCellProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState(note);
  const [isSaving, setIsSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setValue(note);
  }, [note]);

  useEffect(() => {
    if (isEditing && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isEditing]);

  const handleSave = async () => {
    if (value === note) {
      setIsEditing(false);
      return;
    }
    setIsSaving(true);
    try {
      await onSave(value);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      setValue(note);
      setIsEditing(false);
    }
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleSave();
    }
  };

  if (isEditing) {
    return (
      <div className="flex flex-col gap-1 min-w-[200px]">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={2}
          className="text-sm resize-none"
          disabled={isSaving}
        />
        <div className="flex gap-1 justify-end">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setValue(note);
              setIsEditing(false);
            }}
            disabled={isSaving}
            className="h-6 px-2 text-xs"
          >
            ביטול
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isSaving}
            className="h-6 px-2 text-xs"
          >
            {isSaving ? "שומר..." : "שמור"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setIsEditing(true)}
      className="flex items-center gap-1 text-sm text-right w-full cursor-pointer hover:bg-muted/50 rounded px-1 py-0.5 transition-colors"
    >
      {note ? (
        <span className="truncate max-w-[150px]">{note}</span>
      ) : (
        <Pencil className="h-3.5 w-3.5 text-muted-foreground/50" />
      )}
    </button>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/retention/RetentionNoteCell.tsx
git commit -m "feat(retention): add RetentionNoteCell inline editor component"
```

---

## Task 6: Update RetentionTable — Notes Column + 4th Attendance Column

**Files:**
- Modify: `src/components/admin/retention/RetentionTable.tsx`

- [ ] **Step 1: Update props interface and imports**

Replace the entire `RetentionTable.tsx` file content with:

```tsx
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
import { RetentionNoteCell } from "./RetentionNoteCell";
import type { RetentionEntry } from "@/lib/arbox/retention";
import type { RetentionNote } from "@/lib/actions/admin-retention";
import { HEBREW_MONTHS } from "@/lib/constants/hebrew-months";
import { Clock } from "lucide-react";

function getMonthName(monthKey: string): string {
  const [, monthStr] = monthKey.split("-");
  const monthIndex = parseInt(monthStr, 10) - 1;
  return HEBREW_MONTHS[monthIndex] ?? monthKey;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "\u2014";
  const [year, month, day] = dateStr.split("-");
  return `${parseInt(day, 10)}/${parseInt(month, 10)}/${year}`;
}

/** Get a stable key for notes lookup: phone or "no-phone:<name>" */
function getNoteKey(entry: RetentionEntry): string {
  return entry.phone ?? `no-phone:${entry.name.trim().toLowerCase()}`;
}

interface RetentionTableProps {
  entries: readonly RetentionEntry[];
  monthKeys: readonly string[];
  notes: ReadonlyMap<string, RetentionNote>;
  onSaveNote: (traineePhone: string, traineeName: string, note: string) => Promise<void>;
}

export function RetentionTable({
  entries,
  monthKeys,
  notes,
  onSaveNote,
}: RetentionTableProps) {
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
                {monthKeys.map((mk, i) => (
                  <TableHead key={mk} className="text-center">
                    <span className="inline-flex items-center gap-1">
                      {getMonthName(mk)}
                      {i === 0 && (
                        <Clock className="h-3 w-3 text-muted-foreground" />
                      )}
                    </span>
                  </TableHead>
                ))}
                <TableHead className="text-right">הערות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((entry, i) => {
                const noteKey = getNoteKey(entry);
                const existingNote = notes.get(noteKey)?.note ?? "";

                return (
                  <TableRow key={`${entry.user_id ?? entry.name}-${i}`}>
                    <TableCell className="font-medium">{entry.name}</TableCell>
                    <TableCell>{formatDate(entry.end_date)}</TableCell>
                    {monthKeys.map((mk, mi) => (
                      <TableCell
                        key={mk}
                        className={`text-center ${mi === 0 ? "bg-muted/30" : ""}`}
                      >
                        {mi < entry.attendance.length && entry.attendance[mi] != null
                          ? entry.attendance[mi]
                          : "\u2014"}
                      </TableCell>
                    ))}
                    <TableCell>
                      <RetentionNoteCell
                        note={existingNote}
                        onSave={(note) => onSaveNote(noteKey, entry.name, note)}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/retention/RetentionTable.tsx
git commit -m "feat(retention): add notes column and 4th attendance column to table"
```

---

## Task 7: Update RetentionPageClient — Load Notes + Pass to Table

**Files:**
- Modify: `src/components/admin/retention/RetentionPageClient.tsx`

- [ ] **Step 1: Replace entire `RetentionPageClient.tsx`**

```tsx
"use client";

import { useState, useTransition, useMemo, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RetentionTable } from "./RetentionTable";
import {
  getRetentionReport,
  getRetentionNotes,
  upsertRetentionNote,
} from "@/lib/actions/admin-retention";
import { getAttendanceMonthKeys } from "@/lib/arbox/retention";
import type { RetentionReportData } from "@/lib/arbox/retention";
import type {
  RetentionReportMonth,
  RetentionNote,
} from "@/lib/actions/admin-retention";
import { HEBREW_MONTHS } from "@/lib/constants/hebrew-months";
import { toast } from "sonner";

function formatReportMonth(reportMonth: string): string {
  const [year, monthStr] = reportMonth.split("-");
  const monthIndex = parseInt(monthStr, 10) - 1;
  return `${HEBREW_MONTHS[monthIndex]} ${year}`;
}

interface RetentionPageClientProps {
  months: readonly RetentionReportMonth[];
  initialMonth: string | null;
  initialData: RetentionReportData | null;
  initialNotes: ReadonlyMap<string, RetentionNote>;
}

export function RetentionPageClient({
  months,
  initialMonth,
  initialData,
  initialNotes,
}: RetentionPageClientProps) {
  const [selectedMonth, setSelectedMonth] = useState(initialMonth ?? "");
  const [data, setData] = useState<RetentionReportData | null>(initialData);
  const [notes, setNotes] = useState<ReadonlyMap<string, RetentionNote>>(initialNotes);
  const [isPending, startTransition] = useTransition();

  const handleMonthChange = (month: string) => {
    setSelectedMonth(month);
    if (month === initialMonth) {
      setData(initialData);
      setNotes(initialNotes);
      return;
    }
    startTransition(async () => {
      try {
        const [result, notesResult] = await Promise.all([
          getRetentionReport(month),
          getRetentionNotes(month),
        ]);
        setData(result);
        setNotes(notesResult);
      } catch (err) {
        console.error("[Retention] Failed to load report:", err);
        setData(null);
        setNotes(new Map());
      }
    });
  };

  const handleSaveNote = useCallback(
    async (traineePhone: string, traineeName: string, note: string) => {
      const { error } = await upsertRetentionNote(
        selectedMonth,
        traineePhone,
        traineeName,
        note,
      );
      if (error) {
        toast.error(error);
        return;
      }
      // Optimistic update
      setNotes((prev) => {
        const next = new Map(prev);
        if (!note.trim()) {
          next.delete(traineePhone);
        } else {
          next.set(traineePhone, {
            note: note.trim(),
            author_id: "",
            updated_at: new Date().toISOString(),
          });
        }
        return next;
      });
    },
    [selectedMonth],
  );

  const monthKeys = useMemo(
    () => (selectedMonth ? getAttendanceMonthKeys(selectedMonth) : []),
    [selectedMonth],
  );

  if (months.length === 0) {
    return (
      <p className="text-center text-muted-foreground py-12">
        אין דוחות זמינים
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {/* Month selector */}
      <Select value={selectedMonth} onValueChange={handleMonthChange}>
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

      {isPending ? (
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
            <RetentionTable
              entries={data.monthly}
              monthKeys={monthKeys}
              notes={notes}
              onSaveNote={handleSaveNote}
            />
          </TabsContent>

          <TabsContent value="pro" className="mt-4">
            <RetentionTable
              entries={data.pro}
              monthKeys={monthKeys}
              notes={notes}
              onSaveNote={handleSaveNote}
            />
          </TabsContent>

          <TabsContent value="training_card" className="mt-4">
            <RetentionTable
              entries={data.training_card}
              monthKeys={monthKeys}
              notes={notes}
              onSaveNote={handleSaveNote}
            />
          </TabsContent>
        </Tabs>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/retention/RetentionPageClient.tsx
git commit -m "feat(retention): wire notes loading and saving into RetentionPageClient"
```

---

## Task 8: Update Server Page — Pass Initial Notes

**Files:**
- Modify: `src/app/admin/retention/page.tsx`

- [ ] **Step 1: Update page to load and pass initial notes**

Replace `src/app/admin/retention/page.tsx`:

```tsx
import type { Metadata } from "next";
import {
  getRetentionReportMonths,
  getRetentionReport,
  getRetentionNotes,
} from "@/lib/actions/admin-retention";
import { RetentionPageClient } from "@/components/admin/retention/RetentionPageClient";

export const metadata: Metadata = {
  title: "שימור לקוחות | Garden of Eden",
};

export default async function RetentionPage() {
  const months = await getRetentionReportMonths();
  const latestMonth = months.length > 0 ? months[0].report_month : null;

  const [initialData, initialNotes] = latestMonth
    ? await Promise.all([
        getRetentionReport(latestMonth),
        getRetentionNotes(latestMonth),
      ])
    : [null, new Map()];

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      <h1 className="text-2xl font-bold">שימור לקוחות</h1>
      <RetentionPageClient
        months={months}
        initialMonth={latestMonth}
        initialData={initialData}
        initialNotes={initialNotes}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/retention/page.tsx
git commit -m "feat(retention): load initial notes in server page component"
```

---

## Task 9: Build Verification & Manual Testing

**Files:** None (verification only)

- [ ] **Step 1: Run full type check**

Run: `npx tsc --noEmit`

Expected: No TypeScript errors.

- [ ] **Step 2: Run ESLint**

Run: `npm run lint`

Expected: No lint errors.

- [ ] **Step 3: Run production build**

Run: `npm run build`

Expected: Build succeeds with no errors.

- [ ] **Step 4: Manual testing checklist**

Start dev server with `npm run dev` and test:

1. Navigate to `/admin/retention`
2. Verify 4 attendance columns show (current month with clock icon + 3 previous)
3. Verify old reports with 3-element attendance arrays render gracefully (dash for missing 4th column)
4. Click pencil icon on a row to add a note
5. Type a note and click "שמור" — verify it persists
6. Switch to a different month and back — verify note is still there
7. Switch to a different tab (PRO, כרטיסייה) — verify notes work across tabs
8. Edit an existing note — verify it updates
9. Clear a note (empty text) and save — verify it removes
10. Check current month column has subtle `bg-muted/30` background

- [ ] **Step 5: Final commit (if any fixes needed)**

```bash
git add -A
git commit -m "fix(retention): address build/lint issues from retention enhancements"
```
