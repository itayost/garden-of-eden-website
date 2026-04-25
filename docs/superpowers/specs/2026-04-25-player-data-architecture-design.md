# Player Data Architecture Design

**Status:** Draft for review
**Date:** 2026-04-25
**Scope:** Wide (whole player-data domain)
**Optimizing for:** trainee-facing insights + tech debt cleanup

## Context

The trainee-side rating system has accumulated structural debt over multiple iterations:

- **Stale architecture from migration 002:** `player_stats` and `player_stats_history` tables were created as a card-stat cache. They were never written to — the entire production runtime computes ratings on demand from raw assessments. Both tables are 0 rows.
- **Partially-applied migration 008 (achievements):** the `user_achievements` table, `achievement_badge_type` ENUM, and SQL trigger functions for badge granting all exist in the migrations folder and the application code, but were rolled back from production at some point. The dashboard's `<AchievementsCard>` queries a non-existent table on every load and silently shows "0 הישגים, 0 נקודות" for every trainee.
- **Moving-baseline bug:** ratings are recomputed on every read against *today's* `age_group_benchmarks`. When new trainees join the cohort, historical chart points shift retroactively. "You improved by 5 points" can be a benchmark drift, not a real gain.
- **Recent fixes shipped:** null-safe ratings, config-driven `calculateCardRatings()`, distinct primary tests per card slot. These are foundations this design builds on.
- **What's working and stays untouched:** `player_assessments` (truth, 397 rows over 225 trainees), `age_group_benchmarks` + its recalc trigger/cron, `user_streaks` (62 rows), `player_goals`, and `trainer_shift_reports.achievements_per_trainee` (41/90 reports).

This design defines the boundaries between the player-data subsystems, freezes ratings into snapshots so improvement insights are stable, and re-establishes the badge system on a TS-owned control flow.

## Goals

1. Each card-stat rating becomes a stable snapshot at assessment write time. "+5 points" means a real improvement.
2. Card-stat history loads come from a single indexed table, not 397 on-the-fly recomputations.
3. Badge granting is restored, owned by TypeScript, colocated with the action that earns each badge.
4. Subsystem boundaries are crisp; each table has one writer.
5. Dead/orphan schema is removed.

## Non-goals

- Adding new test types (dribbling drill, passing drill, defending drill). Card stats keep their current proxy mappings shipped on 2026-04-25.
- Multi-academy / SaaS partitioning of benchmarks.
- Touching `user_streaks`, `player_goals`, `trainer_shift_reports.achievements_per_trainee`. These are working sub-systems with no architectural problem.
- Storing per-stat sub-ratings (acceleration, finishing, vision, etc.). The 30-column structure of `player_stats` was aspirational and is dropped.

## Subsystems

Five sub-systems with single responsibilities and one writer each.

| # | Subsystem | Owns | Writer | Reader |
|---|---|---|---|---|
| 1 | **Truth** | Raw test history, soft-deletable | Server action `recordAssessment()` (and bulk-import variant) | All other sub-systems read this directly |
| 2 | **Cohort context** | Per-age-group min/max per metric | Existing trigger `recalc_benchmarks_on_assessment_change` + daily cron | Subsystem 3 (rating math) |
| 3 | **Derived ratings** | Frozen card stats per assessment | Server action via `writeRatingSnapshot()` | All read surfaces |
| 4 | **Engagement** | Streaks, goals, badges, per-trainee shift achievements. Each independent, no coupling to ratings. | Each subsystem's own server action; badge granting via shared `grantBadge()` helper | Dashboard, trainer pages |
| 5 | **Read surfaces** | Pages and components | n/a (read-only) | Subsystems 1, 3, 4 |

The pivotal architectural change: **ratings stop being computed on read**. They are computed once at write time, frozen, stored.

## The snapshot table

```sql
CREATE TABLE player_rating_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assessment_id   UUID NOT NULL REFERENCES player_assessments(id) ON DELETE CASCADE,
  assessment_date DATE NOT NULL,
  age_group       TEXT,                          -- u10/u12/u15/u18/senior at compute time

  pace            INTEGER,                       -- nullable: '—' when no source data
  shooting        INTEGER,
  passing         INTEGER,
  dribbling       INTEGER,
  defending       INTEGER,
  physical        INTEGER,
  overall_rating  INTEGER,

  computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,                    -- soft-delete parity with player_assessments

  UNIQUE (assessment_id)
);

CREATE INDEX idx_player_rating_snapshots_user_date
  ON player_rating_snapshots (user_id, assessment_date DESC)
  WHERE deleted_at IS NULL;

ALTER TABLE player_rating_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own snapshots" ON player_rating_snapshots
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Trainers and admins read all snapshots" ON player_rating_snapshots
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer'))
  );
-- No INSERT/UPDATE/DELETE policies → only service-role writes (server actions)
```

Design choices:

- `UNIQUE (assessment_id)` — exactly one snapshot per assessment, ever. Re-computation upserts.
- All stat columns nullable — preserves the "untested category shows —" semantics shipped 2026-04-25.
- `age_group` denormalized — small, useful for insights without a join.
- `computed_at` distinct from `assessment_date` — auditable when a snapshot was last (re)written without losing the assessment's actual date.
- `deleted_at` for soft-delete parity with `player_assessments`. Hard delete via CASCADE if the parent is hard-deleted.
- No `card_type` / `position` columns — UI hardcodes "gold" today; add only when genuinely used.
- No frozen-benchmarks JSON. Once a rating is snapshotted, we don't re-derive it.

## Write path

```ts
// src/features/player-assessments/lib/actions/record-assessment.ts
"use server";

export async function recordAssessment(input: AssessmentInput) {
  const { authorized, supabase, user } = await verifyAdminOrTrainer();
  if (!authorized) return { success: false, error: "..." };

  const { data: assessment, error } = await supabase
    .from("player_assessments")
    .insert({ ...input, assessed_by: user.id })
    .select()
    .single();
  if (error) return { success: false, error: error.message };

  // Existing trigger recalc_benchmarks_on_assessment_change has fired by now.
  // Snapshot uses the freshly-recalculated cohort context.
  await writeRatingSnapshot(supabase, assessment as PlayerAssessment);
  await grantAssessmentBadges(supabase, assessment as PlayerAssessment);

  return { success: true, data: assessment };
}
```

`writeRatingSnapshot()` lives in `src/features/player-assessments/lib/snapshot.ts`:

1. Fetch trainee birthdate, derive age group via existing `getAgeGroup()`.
2. Fetch fresh benchmarks via existing `fetchGroupStats()`.
3. Compute via existing `calculateCardRatings(assessment, benchmarks)` — single source of math, unchanged.
4. UPSERT into `player_rating_snapshots` keyed on `assessment_id`.
5. On any failure: log, return — does not fail the assessment write.

`grantAssessmentBadges()` lives in `src/features/achievements/lib/actions/grant-assessment-badges.ts`:

- Compares the new snapshot to the previous snapshot for the same user (overall improved by 5 / 10 → grant `overall_improved_5pts` / `overall_improved_10pts`).
- Compares the raw assessment to the previous assessment (sprint improved → `sprint_improved`; jump improved → `jump_improved`; first → `first_assessment`).
- Each grant via shared helper `grantBadge(supabase, userId, badgeType, metadata?)` which `INSERT ... ON CONFLICT (user_id, badge_type) DO NOTHING`.

**Three defenses against drift between assessments and snapshots:**

1. Best-effort within the action — failures don't fail the assessment.
2. Daily backfill cron at `/api/cron/backfill-rating-snapshots` — `LEFT JOIN` finds orphan assessments, computes via the same helper.
3. The Phase-2 one-time backfill processes all 397 historical assessments via the same code path before snapshot reads go live.

## Engagement: badges architecture

Restore the `user_achievements` table; do *not* restore the SQL trigger functions from migration 008.

```sql
CREATE TYPE achievement_badge_type AS ENUM (
  -- Onboarding
  'nutrition_form_completed', 'profile_completed',
  'first_pre_workout', 'first_post_workout',
  -- Videos
  'first_video_watched', 'videos_day_complete', 'all_videos_watched',
  -- Assessments
  'first_assessment', 'five_assessments', 'ten_assessments',
  -- Improvements (assessment-based)
  'sprint_improved', 'jump_improved',
  'overall_improved_5pts', 'overall_improved_10pts',
  -- Streaks
  'streak_7_days', 'streak_30_days', 'streak_100_days',
  -- Goals
  'first_goal_achieved', 'five_goals_achieved'
);

CREATE TABLE user_achievements (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  badge_type   achievement_badge_type NOT NULL,
  unlocked_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata     JSONB,
  celebrated   BOOLEAN NOT NULL DEFAULT FALSE,
  UNIQUE (user_id, badge_type)
);

CREATE INDEX idx_user_achievements_user ON user_achievements (user_id);

ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

-- SELECT: own rows
CREATE POLICY "Users read own achievements" ON user_achievements
  FOR SELECT USING (auth.uid() = user_id);

-- SELECT: trainers and admins read all
CREATE POLICY "Staff read all achievements" ON user_achievements
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer'))
  );

-- INSERT: scoped to self (the fix from 20260215120000_fix_achievements_rls_insert.sql)
CREATE POLICY "Users can earn own achievements" ON user_achievements
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

-- UPDATE: own rows only (used by markAchievementCelebrated)
CREATE POLICY "Users update own achievement celebrated flag" ON user_achievements
  FOR UPDATE USING (auth.uid() = user_id);
```

Single source for the badge list is `src/features/achievements/lib/config/badge-config.ts`. The ENUM above must match that file's keys; if a badge is added or removed in code, the ENUM is updated in the same migration.

Badges are granted by TS, colocated with the action that earns them:

```text
recordAssessment()         → first_assessment, five_assessments, ten_assessments,
                             sprint_improved, jump_improved,
                             overall_improved_5pts, overall_improved_10pts
updateStreak()             → streak_7_days, streak_30_days, streak_100_days
completeGoal()             → first_goal_achieved, five_goals_achieved
```

Single shared helper `grantBadge(supabase, userId, badgeType, metadata?)` in `src/features/achievements/lib/actions/grant-badge.ts`. Idempotent via `ON CONFLICT (user_id, badge_type) DO NOTHING`.

Backfilled badges (Phase 2) are inserted with `celebrated = true`, so they appear in the badge list but do not fire the celebration toast.

## Migration plan — five independent phases

Each phase ships and stabilizes before the next. The system stays correct (with the old behavior) until Phase 4.

### Phase 1 — Schema additions (additive, no behavior change)

- Migration `<ts>_create_player_rating_snapshots.sql` — table + index + RLS.
- Migration `<ts>_recreate_user_achievements.sql` — ENUM + table + RLS (re-applying mig 008 minus the trigger functions, plus the RLS fix).

Rollback: `DROP TABLE`, `DROP TYPE`. Zero impact since nothing reads from these yet.

### Phase 2 — Backfill (idempotent, safe to re-run)

- One-time script `scripts/backfill-rating-snapshots.ts`:
  - Walks all assessments in date order per user.
  - For each: computes snapshot via `writeRatingSnapshot()`, grants any retroactive badges via `grantAssessmentBadges()`.
  - All inserts UPSERT / `ON CONFLICT DO NOTHING` — re-running is safe.
- Validation queries:
  - `SELECT COUNT(*) FROM player_rating_snapshots` should equal `(SELECT COUNT(*) FROM player_assessments WHERE deleted_at IS NULL)`.
  - Badge type distribution makes sense (no zero counts for assessment-derived types if any user has 2+ assessments).

Rollback: `TRUNCATE` the two new tables. No effect on `player_assessments`.

### Phase 3 — Add the write path (TS code only, no read changes)

- Add `recordAssessment()` server action + `writeRatingSnapshot()` helper.
- Add `grantBadge()` shared helper + `grantAssessmentBadges()`.
- Add `/api/cron/backfill-rating-snapshots` for ongoing orphan-catch.
- Migrate existing call sites that insert into `player_assessments` directly to use `recordAssessment()`. Audit shows 2-3 sites: admin assessment form + bulk-import scripts.
- Add tests: `writeRatingSnapshot` against fixture (Yarin's case + full data + missing data + sentinel benchmarks); `grantBadge` idempotency; `grantAssessmentBadges` delta detection.

Rollback: revert the commit. The old read path still computes ratings on demand and works.

### Phase 4 — Cutover reads (the risky moment)

- Switch `RatingTrendChart`, `MiniRatingChart`, `PlayerCard` data sources, and the PDF export to read from `player_rating_snapshots`.
- Hollow `getPlayerRatings()` to a thin reader of the snapshot table; or delete it if no callers remain. Same for `transformToRatingChartData()`.
- Add small Hebrew dashboard banner for one week: "העדכנו את אופן חישוב הדירוג ההיסטורי, התוצאות עכשיו יציבות לאורך זמן." Dismissible, stored in localStorage.
- Trainees see corrected, stable historical numbers. Some numbers will look slightly different from yesterday — intentional.

Rollback: revert the commit. The compute-on-demand path still exists in the code (un-deleted until Phase 5).

### Phase 5 — Cleanup (only after Phase 4 is stable for ~1 week)

- `DROP TABLE player_stats CASCADE` (cascades `player_stats_history`).
- `DROP FUNCTION update_player_stats_updated_at()`.
- Remove unused TS exports (`calculateNeutralRatings()` if no caller; `getPlayerRatings()` if hollowed).
- Remove the dashboard banner from Phase 4.

Rollback: trivial — these are unused.

## Testing

- Existing 561 tests stay green throughout.
- New unit tests:
  - `writeRatingSnapshot()` — Yarin's exact data, full data, all-null, sentinel benchmarks.
  - `grantBadge()` — idempotency (`ON CONFLICT DO NOTHING`), authorized callers only.
  - `grantAssessmentBadges()` — delta detection (overall went 60 → 66 grants `overall_improved_5pts` not `overall_improved_10pts`; sprint improved triggers `sprint_improved`).
- Integration test on a temporary branch: insert assessment via action, verify snapshot row exists, verify expected badges granted.
- Manual smoke after Phase 4: open dashboard as a known trainee, compare chart shape to pre-cutover screenshot. Numbers will differ (intentional) but should look continuous.

## Files affected

**New:**

- `supabase/migrations/<ts>_create_player_rating_snapshots.sql`
- `supabase/migrations/<ts>_recreate_user_achievements.sql`
- `supabase/migrations/<ts>_drop_dead_player_stats.sql` (Phase 5)
- `scripts/backfill-rating-snapshots.ts`
- `src/features/player-assessments/lib/actions/record-assessment.ts`
- `src/features/player-assessments/lib/snapshot.ts`
- `src/features/achievements/lib/actions/grant-badge.ts`
- `src/features/achievements/lib/actions/grant-assessment-badges.ts`
- `src/app/api/cron/backfill-rating-snapshots/route.ts`
- Tests for each.

**Modified:**

- `src/lib/utils/get-player-ratings.ts` — hollowed to read from snapshots (Phase 4).
- `src/features/progress-charts/lib/transforms/index.ts` — `transformToRatingChartData()` reads from snapshots.
- `src/app/dashboard/page.tsx`, `src/app/dashboard/assessments/page.tsx`, `src/app/admin/users/[userId]/page.tsx`, `src/app/admin/assessments/[userId]/page.tsx` — fetch from snapshots instead of running `getPlayerRatings()`.
- `src/types/database.ts` — regenerate from new schema.
- Bulk import scripts that currently insert assessments directly.

**Reused unchanged:**

- `src/lib/assessment-to-rating.ts` (math).
- `src/lib/utils/fetch-benchmarks.ts` (cohort context fetch).
- `src/features/achievements/lib/config/badge-config.ts` (badge UI metadata).
- `src/features/achievements/components/*` (badge UI components).

## Out of scope (capture for future tickets)

- Adding dedicated dribbling/passing/defending drill tests so card stats become direct rather than proxy measurements. Once those exist, `CARD_STAT_CONFIG` becomes a one-row-per-stat edit.
- Multi-academy / SaaS-style partitioning of `age_group_benchmarks`.
- Trainee-vs-trainee peer comparisons on the dashboard.
- Goal-completion badges (the `completeGoal()` path is mentioned for completeness but the actual goal-completion code path is not modified here).
- Card-type derivation from `overall_rating` (gold/silver/bronze) — currently hardcoded "gold".
