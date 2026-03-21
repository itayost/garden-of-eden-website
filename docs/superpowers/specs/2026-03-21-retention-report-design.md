# Retention Report — שימור לקוחות

## Overview

Automated monthly retention report that fetches expiring memberships and attendance data from the Arbox API, stores snapshots in Supabase, and presents them to trainers/admins in a tabbed table view.

**Goal:** Replace the manually-exported CSV ("שימור לקוחות חידושי מנוי") with an automated, browsable report that helps trainers proactively reach out to members whose subscriptions are about to end.

---

## Database

### Table: `retention_reports`

```sql
CREATE TABLE retention_reports (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_month  date NOT NULL UNIQUE,  -- first of month, e.g. '2026-03-01'
  data          jsonb NOT NULL,        -- full processed report snapshot
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_retention_reports_month ON retention_reports (report_month DESC);
```

### RLS Policies

- SELECT: admin and trainer roles only (no trainee access)
- INSERT/UPDATE/DELETE: service role only (cron job uses admin client)

### JSONB `data` Structure

```json
{
  "monthly": [
    {
      "user_id": 12345,
      "name": "נועם קופלביץ",
      "phone": "0501234567",
      "end_date": "2026-03-20",
      "membership_type_name": "מנוי חודשי",
      "attendance": [9, 3, null]
    }
  ],
  "pro": [ ... ],
  "training_card": [ ... ]
}
```

- `attendance` array: 3 elements representing the 3 most recent months before the report month (index 0 = most recent, index 2 = oldest). `null` means no attendance data.
- Categories (`monthly`, `pro`, `training_card`) are mapped from Arbox `membership_type_name` values. The mapping is configurable in `src/lib/arbox/retention.ts`.

---

## Cron Job

### Endpoint: `/api/cron/retention-report`

- **Schedule:** `0 3 1 * *` — 3 AM UTC on the 1st of every month (configured in `vercel.json`, offset from the nightly arbox-sync at 2 AM)
- **Auth:** `CRON_SECRET` header verification (same pattern as existing `/api/cron/arbox-sync`)
- **maxDuration:** 60 seconds (multiple paginated Arbox API calls)

### Logic

1. **Determine date ranges:**
   - Expiring memberships: current month (e.g., March 1–31)
   - Attendance: previous 3 months (e.g., December 1 – February 28)

2. **Fetch from Arbox API:**
   - `expiringMemberships` report for current month → list of members with `name`, `phone`, `membership_type_name`, `end_date`
   - `entrance` report for previous 3 months → per-visit entries with `user_id`, `name`, `date`

3. **Process:**
   - Group expiring memberships by `membership_type_name` into 3 categories (monthly/PRO/training card) using a configurable mapping
   - For each expiring member, count their entrance entries per month from the attendance data. Matching priority: (1) `user_id` if both sides have non-null values, (2) normalized phone number, (3) normalized name match (trimmed, case-insensitive)
   - Sort each category by `end_date` descending

4. **Save:**
   - Upsert into `retention_reports` with `report_month` = first of current month
   - Uses `createAdminClient()` (service role) to bypass RLS

### Arbox API Calls

Uses existing patterns from `src/lib/arbox/reports.ts`:

- URL pattern: `/reports/{reportName}?from=...&to=...&page=...&limit=500`
- Paginated fetching (500 per page, stop when `entries.length < 500`, max 20 pages)
- `ARBOX_API_KEY` from env
- `cache: "no-store"`

New report type to add: `expiringMemberships` (schema: `ExpiringMembershipsReportResource`).

**Pre-implementation step:** Make a test API call to `GET /v3/reports/expiringMemberships?from=2026-04-01&to=2026-04-30` to confirm the actual response fields. Expected fields based on similar reports: `user_id`, `name`, `phone`, `membership_type_name`, `end_date`. The field names and membership type mapping must be verified before coding.

The existing `fetchEntranceReport()` from `src/lib/arbox/reports.ts` is reused as-is for attendance data.

---

## UI

### Page: `/admin/retention`

Server component. Accessible to admin and trainer roles.

**Header:**
- Title: "שימור לקוחות"
- Month selector dropdown — lists all available `report_month` values from `retention_reports`, formatted as Hebrew month + year (e.g., "מרץ 2026")
- Default selection: most recent report

**Body:**
- 3 tabs: "מנוי חודשי" | "מנוי PRO" | "כרטיסת אימונים"
- Each tab renders a `RetentionTable`

### RetentionTable

| שם לקוח | תאריך סיום | {month1 name} | {month2 name} | {month3 name} |
|---------|-----------|---------------|---------------|---------------|
| נועם קופלביץ | 20/03/2026 | 9 | 3 | — |

- Column headers show Hebrew month names derived from the report month (e.g., for March 2026 report: "פברואר", "ינואר", "דצמבר")
- Empty/null attendance displays "—"
- Sorted by end date descending
- Search filter via `TableToolbar` (filter by name)
- No pagination needed (each category expected <100 entries per month)

### Components

- `src/app/admin/retention/page.tsx` — server component, fetches available months + selected report
- `src/components/admin/retention/RetentionTabs.tsx` — client component, tab switching
- `src/components/admin/retention/RetentionTable.tsx` — table rendering

### Navigation

Add "שימור לקוחות" link to the admin sidebar/nav.

---

## Files

### New Files

| File | Purpose |
|------|---------|
| `supabase/migrations/20260321120000_retention_reports.sql` | Table + RLS policies |
| `src/lib/arbox/retention.ts` | Arbox fetching (expiringMemberships) + processing logic + membership type mapping + TypeScript types (`RetentionReportData`, `RetentionEntry`) |
| `src/app/api/cron/retention-report/route.ts` | Cron endpoint |
| `src/lib/actions/admin-retention.ts` | Server actions: `getRetentionReportMonths()`, `getRetentionReport(month)` — both call `verifyAdminOrTrainer()` |
| `src/app/admin/retention/page.tsx` | Admin page |
| `src/components/admin/retention/RetentionTabs.tsx` | Tabs component |
| `src/components/admin/retention/RetentionTable.tsx` | Table component |

### Modified Files

| File | Change |
|------|--------|
| `vercel.json` | Add cron schedule for retention report |
| `src/components/admin/AdminNav.tsx` | Add "שימור לקוחות" link (desktop nav) |
| `src/components/admin/AdminBottomNav.tsx` | Add "שימור לקוחות" link (mobile nav) |
| `src/lib/env.ts` | No change needed — `ARBOX_API_KEY` already validated |

---

## Edge Cases

- **No data for a category:** Tab shows empty state message ("אין נתונים לחודש זה")
- **No reports yet:** Page shows message ("אין דוחות זמינים") with no month selector
- **Membership type not matching any category:** Logged as warning, skipped (not displayed in UI)
- **Arbox API failure during cron:** Error logged, no partial data saved, previous month's report remains intact
- **Duplicate member entries:** Same person can appear multiple times if they have multiple expiring memberships of the same type — this matches the CSV behavior

---

## Out of Scope

- CSV export from the UI (can be added later)
- Filtering by specific membership sub-types within a category
- Sending notifications/reminders to trainers
- Manual report generation (admin trigger outside cron schedule)
