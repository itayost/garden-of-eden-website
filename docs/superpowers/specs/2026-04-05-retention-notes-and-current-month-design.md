# Retention Feature Enhancements: Notes & Current Month Attendance

**Date:** 2026-04-05
**Status:** Approved
**Scope:** Admin retention page (`/admin/retention`)

## Overview

Two enhancements to the existing retention report feature:
1. Per-report notes column for tracking contact status with trainees
2. Current month attendance column (daily cron update)

---

## Feature 1: Retention Notes

### Requirements

- Admin and trainers can write free-text notes per trainee per report month
- Notes are tied to a specific report month, NOT global to the trainee
- When a new monthly report is generated, notes column starts blank
- Viewing a past report shows the notes written during that month
- One note per trainee per report (editable, not append-only)

### Database: `retention_notes` Table

```sql
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
```

**Why `trainee_phone` as identifier:** Trainees in the retention report come from Arbox and may not exist as users in the system. Phone number is the shared identifier between Arbox and the report data.

**RLS Policies:**
- SELECT: admin and trainer roles
- INSERT: admin and trainer roles
- UPDATE: admin and trainer roles (author can edit their own, admin can edit any)
- No DELETE policy (notes persist for historical record; content can be cleared via update)

### Server Actions

**File:** `src/lib/actions/admin-retention.ts` (extend existing)

- `upsertRetentionNote(reportMonth: string, traineePhone: string, traineeName: string, note: string)` - Creates or updates a note. Uses `verifyAdminOrTrainer()`. Validates inputs with Zod.
- `getRetentionNotes(reportMonth: string)` - Returns all notes for a report month as a `Map<string, { note: string; authorId: string; updatedAt: string }>` keyed by `trainee_phone`. Called once when loading a report.

### UI Changes

**File:** `src/components/admin/retention/RetentionTable.tsx`

- New "הערות" (Notes) column added as the last column (leftmost visually in RTL)
- Empty state: faded pencil icon (clickable)
- Has note: truncated text (~30 chars) + pencil icon for editing
- Click opens inline textarea in the cell with a save button
- Optimistic update on save
- Notes loaded once per report switch via `getRetentionNotes()`

---

## Feature 2: Current Month Attendance

### Requirements

- Attendance display expands from 3 to 4 columns
- Column 0 (leftmost attendance column) = current month (partial, updates daily)
- Columns 1-3 = previous 3 months (same as today)
- Current month column has subtle visual distinction (e.g., lighter background or asterisk) to indicate partial data

### Data Model Changes

- `RetentionEntry.attendance` array grows from 3 to 4 elements
- Index 0 = current month, Index 1-3 = previous months
- Existing reports in DB keep 3-element arrays; UI handles both gracefully (show "—" for missing index)

### Cron Job: Daily Attendance Update

**File:** New route `src/app/api/cron/retention-attendance/route.ts`

- Schedule: `0 4 * * *` (daily at 04:00 UTC)
- Logic:
  1. Fetch the current month's report from `retention_reports`
  2. Fetch current month's attendance from Arbox bookings API
  3. Update `attendance[0]` for each entry in the report's JSONB `data`
  4. Save updated report back to `retention_reports`
- Auth: `CRON_SECRET` header verification (same as existing cron)

**Existing monthly cron (`retention-report/route.ts`) changes:**
- `getAttendanceMonthKeys()` returns 4 months instead of 3 (current + 3 previous)
- `getAttendanceMonthRanges()` generates 4 date ranges
- When creating a new monthly report, attendance array has 4 elements from the start

### UI Changes

**File:** `src/components/admin/retention/RetentionTable.tsx`

- 4 attendance column headers instead of 3
- Current month column header shows Hebrew month name (same format as others)
- Current month column cells get a subtle visual indicator (e.g., `bg-muted/30` or small clock icon in header) to show data is partial/updating
- Column rendering logic handles both 3-element (old reports) and 4-element arrays

### Logic Changes

**File:** `src/lib/arbox/retention.ts`

- `getAttendanceMonthKeys()` - returns 4 month keys (current month + 3 previous)
- `getAttendanceMonthRanges()` - generates 4 date ranges
- `ATTENDANCE_MONTHS` constant changes from 3 to 4
- `buildBookingIndex()` and `lookupAttendance()` - no changes needed (already generic over array length)

**File:** `src/lib/constants/hebrew-months.ts` - no changes needed (already has all 12 months)

### Vercel Cron Configuration

Add to `vercel.json`:
```json
{
  "path": "/api/cron/retention-attendance",
  "schedule": "0 4 * * *"
}
```

---

## Files to Create/Modify

### New Files
- `supabase/migrations/YYYYMMDDHHMMSS_retention_notes.sql` - New table + RLS
- `src/app/api/cron/retention-attendance/route.ts` - Daily attendance cron

### Modified Files
- `src/lib/actions/admin-retention.ts` - Add note actions + update types
- `src/lib/arbox/retention.ts` - 4 months instead of 3
- `src/components/admin/retention/RetentionTable.tsx` - Notes column + 4th attendance column
- `src/components/admin/retention/RetentionPageClient.tsx` - Load and pass notes data
- `src/app/admin/retention/page.tsx` - May need to pass initial notes
- `vercel.json` - Add daily cron schedule

---

## Edge Cases

- **Trainee with no phone:** Use `"no-phone:<normalized_name>"` as the `trainee_phone` value to keep the column semantically clear while still providing a unique identifier (rare edge case from Arbox data).
- **Old reports with 3-element attendance:** UI renders "—" for missing 4th element. No backfill needed.
- **Daily cron runs before monthly report exists:** Skip gracefully (no report to update on day 1 if monthly cron hasn't run yet). Monthly cron already includes current month data when it runs.
- **Concurrent note edits:** Last write wins (UPSERT). Acceptable for this use case.
- **Empty note save:** Treat as delete - remove the row or prevent saving empty text.
