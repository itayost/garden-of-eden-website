# Age Group Benchmarks: Rating Architecture Redesign

## Problem

Five consumers (dashboard, trainee assessments page, admin assessment detail, player report, admin user detail) each independently run the same expensive pipeline to compute EA FC-style ratings:

1. Fetch ALL trainee profiles from `profiles` table
2. Filter to same age group by birthdate
3. Fetch ALL assessments for those users from `player_assessments`
4. Deduplicate to one assessment per user
5. Compute best/worst per metric (GroupStats)
6. Compute individual ratings against GroupStats

This is ~3 DB queries per consumer, all for data that only changes when an assessment is saved. The `player_stats` table exists but nothing writes to it -- it is dead weight.

## Goal

Pre-compute GroupStats (best/worst per metric per age group) in a single DB row per age group, updated automatically by Postgres triggers when assessments change. Consumers read 1 row instead of running the full pipeline.

## Key Design Decision: Personal Best

Benchmarks use each trainee's **personal best** per metric across ALL their assessments, not just their latest. A trainee who sprinted 1.05s once but 1.12s recently still contributes 1.05s to the group benchmarks. The FIFA card also shows peak ability (personal best ratings), not latest test results. All assessments are still saved and displayed in progress charts for historical tracking.

---

## Architecture

### 1. New Table: `age_group_benchmarks`

| Column | Type | Description |
|--------|------|-------------|
| `age_group` | TEXT PRIMARY KEY | 'u10', 'u12', 'u15', 'u18', 'senior' |
| `{metric}_best` | DECIMAL (matches source) | Best personal-best across all users |
| `{metric}_worst` | DECIMAL (matches source) | Worst personal-best across all users |
| `player_count` | INTEGER | Trainees with assessments in group |
| `updated_at` | TIMESTAMPTZ | Last recalculation timestamp |

12 numeric metrics (24 columns: 12 `_best` + 12 `_worst`): sprint_5m, sprint_10m, sprint_20m, jump_2leg_distance, jump_right_leg, jump_left_leg, jump_2leg_height, blaze_spot_time, flexibility_ankle, flexibility_knee, flexibility_hip, kick_power_kaiser.

Pre-seeded with 5 rows (one per age group). RLS allows authenticated SELECT only; triggers use SECURITY DEFINER for writes.

### 2. SQL Function: `compute_age_group(birthdate DATE) -> TEXT`

Replicates TypeScript `getAgeGroup()` in SQL using `EXTRACT(YEAR FROM AGE(CURRENT_DATE, birthdate))`. Returns 'u10'|'u12'|'u15'|'u18'|'senior' or NULL. Marked STABLE.

### 3. SQL Function: `recalculate_age_group_benchmarks(p_age_group TEXT)`

Two-level aggregation:

**Level 1 (personal bests):** For each user in the age group, compute their best value per metric across ALL non-deleted assessments. Sprints use MIN (lower is better), everything else uses MAX (higher is better).

**Level 2 (group benchmarks):** Across all users' personal bests, compute the group best and worst. Sprints: best = MIN, worst = MAX. Everything else: best = MAX, worst = MIN.

UPSERTs the result into `age_group_benchmarks` for the given age group.

### 4. Triggers

**On `player_assessments` (INSERT, UPDATE, DELETE):** Looks up the affected user's age group via `compute_age_group(profiles.birthdate)`, calls `recalculate_age_group_benchmarks()` for that group. Handles soft deletes (UPDATE of `deleted_at` triggers recalculation without the deleted row).

**On `profiles` (UPDATE OF birthdate, role):** If age group changes, recalculates BOTH old and new groups. If role changes to/from 'trainee', recalculates affected group.

### 5. TypeScript Utility Layer

Already created at:

**`src/lib/utils/fetch-benchmarks.ts`** -- `fetchGroupStats(supabase, ageGroupId): Promise<GroupStats | null>`
- Reads 1 row from `age_group_benchmarks`
- Returns null if `player_count < 2` (need 2+ for comparison)
- Maps NULL DB columns to `-1` sentinel (matching existing convention)

**`src/lib/utils/get-player-ratings.ts`** -- Two exports:

`computePersonalBests(assessments): PlayerAssessment` -- Pure function. Takes all of a player's assessments, returns a synthetic assessment with the best value per metric. Sprints get MIN, everything else gets MAX. Categorical fields (coordination, body_structure, leg_power_technique) use latest assessment values.

`getPlayerRatings(supabase, assessments, birthdate): Promise<CalculatedRatings>` -- Async. Computes personal bests, fetches GroupStats from benchmarks table, calls `calculateCardRatings()`. Falls back to `calculateNeutralRatings()` (all 50s) if no group data.

### 6. Consumer Changes

All consumers replace the inline pipeline with:
```
const ratings = await getPlayerRatings(supabase, assessments, birthdate);
```

Progress: some consumers have already been migrated, others remain.

**Already migrated:**
| Consumer | Status |
|----------|--------|
| Dashboard (`src/app/dashboard/page.tsx`) | Done -- uses `getPlayerRatings()` + `fetchGroupStats()` |
| MiniRatingChartWrapper (`src/app/dashboard/MiniRatingChartWrapper.tsx`) | Done -- receives `groupStats` prop directly |
| Admin assessment detail (`src/app/admin/assessments/[userId]/page.tsx`) | Done -- uses `getPlayerRatings()` |

**Still needs migration:**
| Consumer | Current state | Required change |
|----------|---------------|-----------------|
| Dashboard assessments page (`src/app/dashboard/assessments/page.tsx`) | Uses `calculateUserRatings()` + passes `groupAssessments` | Switch to `getPlayerRatings()` + `fetchGroupStats()`, pass `groupStats` prop |
| AssessmentChartsWrapper (`src/app/dashboard/assessments/AssessmentChartsWrapper.tsx`) | Receives `allAssessmentsInGroup` prop | Change to `groupStats: GroupStats \| null` prop |
| Player report (`src/features/player-report/lib/actions/get-report-data.ts`) | Fetches trainee profiles + group assessments + player_stats, computes ratings inline | Use `getPlayerRatings()` + `fetchGroupStats()`, return `groupStats` instead of `groupAssessments` |
| ReportChartsSection (`src/features/player-report/components/ReportChartsSection.tsx`) | Receives `groupAssessments` prop, passes to AssessmentProgressCharts | Change to `groupStats: GroupStats \| null` prop |
| ReportEditor (`src/features/player-report/components/ReportEditor.tsx`) | Passes `data.groupAssessments` to ReportChartsSection | Pass `data.groupStats` instead |
| AssessmentProgressCharts (`src/features/progress-charts/components/AssessmentProgressCharts.tsx`) | Receives `allAssessmentsInGroup`, computes GroupStats client-side | Change to `groupStats: GroupStats \| null` prop, remove client-side computation |
| Admin user detail (`src/app/admin/users/[userId]/page.tsx`) | Reads from dead `player_stats` table | Use `getPlayerRatings()` with user's assessments |

### 7. Dead Code Removal

- Delete `src/lib/utils/calculate-user-ratings.ts` (replaced by `getPlayerRatings()`) -- must first migrate dashboard assessments page which still imports it
- Remove `groupAssessments: PlayerAssessment[]` from `ReportData` type (`src/features/player-report/types/index.ts`), replace with `groupStats: GroupStats | null`
- Stop querying `player_stats` table (leave table in place for now)
- Remove percentile ranking cards from `AssessmentProgressCharts` -- `calculatePercentileRankings()` requires raw peer assessment data which is no longer fetched. The percentile cards are simply removed from the UI (no placeholder needed; the remaining metric charts still display).

### 8. Daily Cron for Birthday Transitions

When a trainee's birthday crosses an age group boundary, benchmarks for both old and new groups become stale. DB triggers handle birthdate edits, but actual birthdays are not DB events.

**`src/app/api/cron/recalculate-benchmarks/route.ts`** -- Daily at 3am UTC, 5 independent calls to `recalculate_age_group_benchmarks()` for each age group via admin client. Protected by `CRON_SECRET` (same pattern as arbox-sync cron). Registered in `vercel.json`.

### 9. Migration Backfill

The migration includes explicit backfill calls at the end:
```sql
SELECT recalculate_age_group_benchmarks('u10');
SELECT recalculate_age_group_benchmarks('u12');
SELECT recalculate_age_group_benchmarks('u15');
SELECT recalculate_age_group_benchmarks('u18');
SELECT recalculate_age_group_benchmarks('senior');
```

Triggers only fire on future DML events, so existing data requires these explicit backfill calls in the migration itself.

---

## Existing Code Reused (unchanged)

| Function | File |
|----------|------|
| `calculateCardRatings()` | `src/lib/assessment-to-rating.ts` |
| `calculateNeutralRatings()` | `src/lib/assessment-to-rating.ts` |
| `GroupStats` interface | `src/lib/assessment-to-rating.ts` |
| `getAgeGroup()` | `src/types/assessment.ts` |
| `isLowerBetter()` | `src/types/assessment.ts` |
| `transformToRatingChartData()` | `src/features/progress-charts/lib/transforms/index.ts` |
| CRON_SECRET pattern | `src/app/api/cron/arbox-sync/route.ts` |

---

## Edge Cases

- **Wizard partial saves:** Each step fires the trigger. Acceptable -- aggregation is fast (~5ms for ~225 rows) and final state is always correct.
- **Bulk imports:** Each INSERT fires trigger. For large imports, disable trigger first, re-enable and backfill after.
- **Empty groups:** All metric columns NULL, `player_count = 0`. `fetchGroupStats()` returns null, ratings fall back to neutral (50).
- **Single player:** `player_count = 1`. Returns null (need 2+ for comparison).
- **Soft deletes:** Trigger fires on `deleted_at` UPDATE, recalculates without the deleted row.

---

## Verification

1. Run `supabase db push`, verify `age_group_benchmarks` has 5 rows with correct data (backfill runs in migration)
2. Insert a test assessment via admin UI, verify benchmarks row updates
3. Open trainee dashboard -- PlayerCard shows correct ratings
4. Open admin assessment page -- PlayerCard ratings match
5. Generate PDF report -- FIFA card + radar chart + overall rating display
6. Open admin user page -- radar chart shows
7. `npx tsc --noEmit` + `npm run build` pass with no errors
