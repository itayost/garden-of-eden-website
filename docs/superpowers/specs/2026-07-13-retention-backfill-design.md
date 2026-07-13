# Retention snapshot backfill (שימור לקוחות)

Date: 2026-07-13
Status: Approved, ready for planning

## Problem

The `retention_reports` snapshots for past months are missing members who expired
early in their month. The loss is systematic, not random.

Arbox's `expiringMembershipsReport` only returns memberships whose `end_date` is
still in the future. Verified empirically on 2026-07-13: querying it for May and
for June returns **0 rows**, and querying it for July returns rows whose earliest
`end_date` is exactly today.

From 2026-05-04 (commit `2671dc7`) a Vercel cron ran daily at 04:00 and
*replaced* the current month's snapshot with a fresh Arbox pull. Because Arbox
had already stopped returning anyone whose `end_date` had passed, each nightly
run silently deleted the members who had expired since the 1st. The snapshot was
eaten from the front, one day at a time.

Commit `8f3f9bf` (2026-06-18) fixed the write path by merging the fresh pull into
the stored snapshot instead of replacing it. It stopped the bleeding but did not
recover what was already gone.

### Measured damage

`report_month` row counts and the earliest `end_date` present in each:

| Month | Entries | Earliest end_date | Verdict |
| ----- | ------- | ----------------- | ------- |
| 2026-03 | 53 | 2026-03-22 | Missing 2026-03-01 .. 2026-03-21. Never complete. |
| 2026-04 | 77 | 2026-04-01 | Healthy. Built once on the 1st by the old monthly cron. |
| 2026-05 | 43 | 2026-05-11 | Missing 2026-05-01 .. 2026-05-10. |
| 2026-06 | 58 | 2026-06-18 | Missing 2026-06-01 .. 2026-06-17. |
| 2026-07 | 92 | (healthy) | Current month, merge fix active. |

None of these earliest dates are coincidences.

- 2026-06-18 is the day the merge fix landed.
- 2026-05-11 is the timestamp of the backup that `restore-may-retention.ts`
  recovered from, so the May restore itself carried the gap forward.
- 2026-03-22 is the day the feature launched. March was never complete: on launch
  day Arbox could only report memberships whose `end_date` was still in the future,
  so the first three weeks of March were never captured. This is a different cause
  from the cron overwrite, but it produces the same gap and the same fix repairs it.

## Source of truth

`expiredMembershipsReport` and `expiredSessionsReport` are the backward-looking
twins of the `expiring*` reports the code already uses. Verified on 2026-07-13:

- `expiredMembershipsReport` for 2026-05-01..2026-05-10 returns **9 rows**,
  `end_date` 2026-05-01 through 2026-05-09.
- `expiredMembershipsReport` for 2026-06-01..2026-06-17 returns **24 rows**,
  `end_date` 2026-06-01 through 2026-06-17.

Every field a `RetentionEntry` needs is present: `user_id`, `full_name`, `phone`,
`membership_type_name`, `end_date`.

### Why not `inactiveMembersReport`

It was the obvious candidate and it is the wrong one, for two independent reasons.

1. **It would bias the report toward churn.** A member who expired in June and
   then renewed is active today, so they would not appear on an inactive list.
   But they belong in June's report, and they are precisely the retention *wins*.
   Backfilling from inactive members only would repopulate June with churners,
   producing a complete-looking report that is wrong.
2. **The fields do not exist.** It returns `inactive_from`, not `end_date`, and
   carries no `membership_type_name`. Without those you cannot place a member in
   a month or route them to a tab.

`expiredMembershipsReport` avoids the bias because it is membership-scoped, not
client-scoped. The June 1..17 window returns 15 rows with `client_status:
inactive` and **9 with `client_status: active`**. The active ones are the
renewers. They are retained.

## Constraints found during investigation

**`expiredSessionsReport` does not filter on `end_date`.** The 2026-06-01..17
window returned 38 rows, of which only 23 have an `end_date` inside it (the rest
run to August). The backfill must filter by `end_date` itself rather than trust
the requested range.

This implies a **live bug**: `expiringSessionsReport` behaves the same way, so
the כרטיסת אימונים tab is currently pulling session packages whose `end_date`
falls outside the report month, in the current month too. Out of scope here. It
needs its own fix.

**Unmapped membership types are silently dropped.** `getCategoryForMembershipType()`
recognises only `פרו`, `כרטיסייה`, and `מתקדמים`. In the June gap alone,
`מנוי עממי 3 פעמים בשבוע` and `מחנה קיץ - הכנה לעונה` match none of them. This
already happens on live reports. Out of scope here, but the backfill must log
every dropped row so the true scope becomes visible.

**Past months are frozen.** `persistRetentionReport()` throws on a past month by
design (`isPastReportMonth`). The backfill cannot go through it and must write the
table directly with the admin client, as `restore-may-retention.ts` does.

**Notes are keyed on raw phone.** `retention_notes` joins on
`(report_month, trainee_phone)` where `trainee_phone` is the *raw* Arbox phone, or
the synthetic `no-phone:<name>` string. Backfilled entries must carry the phone in
that same raw format so notes added to them later key correctly.

## Design

A one-off script, `scripts/backfill-retention-expired.ts`, modelled on
`restore-may-retention.ts`.

**Scope.** March, April, May, June 2026. July is the current month, is healthy,
and the cron merges correctly, so the script leaves it alone.

**Additive only.** For each month the script merges the `expired*` pull into the
stored snapshot. It can only ever *add* members that are missing. For a healthy
month like April this is a no-op, because `entryIdentity` dedupes against what is
already stored. For a damaged month it fills the hole. This is why running it
across every month is safe, and why it self-heals months that were never
individually diagnosed.

A wholesale rebuild was rejected: it would discard snapshots that are currently
correct and orphan existing notes.

**Per month:**

1. Pull `expiredMembershipsReport` and `expiredSessionsReport` for the month range.
2. Filter both by `end_date` inside the month.
3. Keep `ending_reason` of both `expired` and `canceled`. Cancelled members were
   paying members who left in that month, so they are retention-relevant.
4. Map rows to `RetentionEntry` via the existing `arboxName()` helper. Keep the
   phone raw.
5. Route via `getCategoryForMembershipType()`. Log and drop anything it refuses.
6. Recompute attendance from `bookingsReport` over the report month plus the three
   prior months, reusing `buildBookingIndex()` and `lookupAttendance()` unchanged.
7. Back up the current row to `scripts/backups/`.
8. `mergeRetentionReports(stored, backfilled)` and upsert with the admin client,
   preserving the original `created_at` so the row still reads as that month's
   snapshot.

**Safety.** Dry-run by default, printing a per-month diff of the members that
would be added. Nothing writes without `--apply`.

## Reuse

The load-bearing logic already exists and is unit-tested
(`src/lib/arbox/__tests__/merge-retention.test.ts`):

- `mergeRetentionReports()` and `entryIdentity()` (`src/lib/arbox/retention.ts:339-388`)
- `buildBookingIndex()` and `lookupAttendance()` (`src/lib/arbox/retention.ts:214-271`)
- `getCategoryForMembershipType()` (`src/lib/arbox/retention.ts:41-49`)
- `arboxName()` (`src/lib/arbox/retention.ts:146-154`)

New code is limited to a fetch layer for the two `expired*` reports plus an
orchestrator. The `expired*` fetchers belong next to the existing ones in
`src/lib/arbox/retention.ts`, or in a sibling module if that file approaches its
size budget.

## Verification

- Dry-run reports a per-month added-member count and lists every dropped
  membership type.
- After apply, re-run `scripts/inspect-retention-reports.ts`. The earliest
  `end_date` for May must move to on or near 2026-05-01, and for June to on or
  near 2026-06-01.
- April's count must be unchanged, proving the merge is genuinely additive.
- Existing `retention_notes` rows must still resolve against their members.

## Out of scope

- The `expiringSessionsReport` range bug affecting the live כרטיסייה tab.
- Extending `getCategoryForMembershipType()` to cover unmapped types. The backfill
  log will quantify this first, then Eden decides which tab each type belongs in.
