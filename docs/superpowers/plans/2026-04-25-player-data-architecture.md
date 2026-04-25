# Player Data Architecture Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Freeze EA-FC card stats into stable snapshots at assessment write time, restore the broken `user_achievements` table with TS-owned badge granting, and prune the dead `player_stats` cache.

**Architecture:** One TS server action (`recordAssessment`) becomes the only sanctioned way to insert/update a `player_assessments` row. After every successful write it computes ratings via the existing `calculateCardRatings()` against the just-recalculated `age_group_benchmarks` and UPSERTs into a new `player_rating_snapshots` table keyed on `assessment_id`. Charts and cards switch from compute-on-read to read-snapshot. Badges live in the same write path via a shared `grantBadge()` helper. Five sequential phases, each shipping independently.

**Tech Stack:** Next.js 16 (App Router) + React 19 + TypeScript (strict) + Supabase (Postgres + RLS) + Vitest + React Hook Form + Zod. Spec at [docs/superpowers/specs/2026-04-25-player-data-architecture-design.md](docs/superpowers/specs/2026-04-25-player-data-architecture-design.md).

---

## File map

**New files:**

| Path | Phase | Purpose |
|---|---|---|
| `supabase/migrations/20260425120000_create_player_rating_snapshots.sql` | 1 | New snapshot table + RLS |
| `supabase/migrations/20260425120100_recreate_user_achievements.sql` | 1 | Re-create badges table + ENUM (mig 008 was rolled back from prod) |
| `src/features/player-assessments/lib/snapshot.ts` | 2 | `writeRatingSnapshot()` Supabase wrapper + pure `composeSnapshot()` helper |
| `src/features/player-assessments/lib/__tests__/snapshot.test.ts` | 2 | Unit tests for `composeSnapshot` |
| `src/features/achievements/lib/utils/choose-assessment-badges.ts` | 2 | Pure function: which badges this assessment earns |
| `src/features/achievements/lib/utils/__tests__/choose-assessment-badges.test.ts` | 2 | Unit tests for the chooser |
| `src/features/achievements/lib/actions/grant-badge.ts` | 2 | Shared idempotent INSERT helper |
| `src/features/achievements/lib/actions/grant-assessment-badges.ts` | 2 | Wraps the chooser + grantBadge for an assessment |
| `scripts/backfill-rating-snapshots.ts` | 2 | One-shot: walk all assessments, write snapshots + retroactive badges |
| `src/features/player-assessments/lib/actions/record-assessment.ts` | 3 | The single write entry point |
| `src/app/api/cron/backfill-rating-snapshots/route.ts` | 3 | Daily orphan-snapshot catcher |
| `src/components/dashboard/RatingMigrationBanner.tsx` | 4 | One-week Hebrew banner explaining the change |
| `supabase/migrations/20260425120200_drop_dead_player_stats.sql` | 5 | Final cleanup |

**Modified files:**

| Path | Phase | Reason |
|---|---|---|
| `src/types/database.ts` | 1 | Regenerated via Supabase MCP after migrations |
| `src/components/admin/AssessmentForm.tsx` | 3 | Replace direct insert/update with `recordAssessment` action |
| `vercel.json` (or equivalent cron config) | 3 | Add daily cron schedule for the orphan catcher |
| `src/features/progress-charts/lib/transforms/index.ts` | 4 | `transformToRatingChartData` reads snapshots instead of recomputing |
| `src/lib/utils/get-player-ratings.ts` | 4 | Hollowed to read latest snapshot row |
| `src/app/dashboard/page.tsx` | 4 | Wire banner + read-from-snapshot path |
| `src/app/dashboard/assessments/page.tsx` | 4 | Read latest snapshot for PlayerCard |
| `src/app/admin/users/[userId]/page.tsx` | 4 | Read latest snapshot |
| `src/app/admin/assessments/[userId]/page.tsx` | 4 | Read latest snapshot |
| `src/lib/assessment-to-rating.ts` | 5 | Remove `calculateCardRatingsAbsolute` and `calculateNeutralRatings` if unused after Phase 4 |

**Reused unchanged:** `src/lib/assessment-to-rating.ts:calculateCardRatings` (math), `src/lib/utils/fetch-benchmarks.ts:fetchGroupStats`, `src/types/assessment.ts:getAgeGroup`, the existing Supabase trigger `recalc_benchmarks_on_assessment_change` and the cron `recalculate-benchmarks`, `src/features/achievements/lib/config/badge-config.ts`, all existing chart/card/PDF UI.

---

## Phase 1 — Schema additions (additive, no behavior change)

### Task 1.1: Snapshot table migration

**Files:**
- Create: `supabase/migrations/20260425120000_create_player_rating_snapshots.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260425120000_create_player_rating_snapshots.sql
-- Frozen card-stat history. One row per (non-deleted) assessment.

CREATE TABLE player_rating_snapshots (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  assessment_id   UUID NOT NULL REFERENCES player_assessments(id) ON DELETE CASCADE,
  assessment_date DATE NOT NULL,
  age_group       TEXT,

  pace            INTEGER,
  shooting        INTEGER,
  passing         INTEGER,
  dribbling       INTEGER,
  defending       INTEGER,
  physical        INTEGER,
  overall_rating  INTEGER,

  computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at      TIMESTAMPTZ,

  CONSTRAINT player_rating_snapshots_assessment_id_unique UNIQUE (assessment_id)
);

CREATE INDEX idx_player_rating_snapshots_user_date
  ON player_rating_snapshots (user_id, assessment_date DESC)
  WHERE deleted_at IS NULL;

ALTER TABLE player_rating_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own rating snapshots" ON player_rating_snapshots
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Staff read all rating snapshots" ON player_rating_snapshots
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer'))
  );

COMMENT ON TABLE player_rating_snapshots IS
  'Frozen card-stat ratings, computed at assessment write time. One row per assessment, keyed on assessment_id. Stable history: never recomputed on read.';
```

- [ ] **Step 2: Apply via Supabase MCP**

Use the `mcp__plugin_supabase_supabase__apply_migration` tool with:
- `project_id`: `sedqdnpdvwpivrocdlmh`
- `name`: `create_player_rating_snapshots`
- `query`: the SQL from Step 1.

- [ ] **Step 3: Verify schema in production**

Use `mcp__plugin_supabase_supabase__execute_sql`:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'player_rating_snapshots'
ORDER BY ordinal_position;
```

Expected: 12 columns (id, user_id, assessment_id, assessment_date, age_group, pace, shooting, passing, dribbling, defending, physical, overall_rating, computed_at, deleted_at) — matches Step 1.

- [ ] **Step 4: Verify the unique constraint and index exist**

```sql
SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'player_rating_snapshots';
```

Expected output includes `player_rating_snapshots_assessment_id_unique` and `idx_player_rating_snapshots_user_date`.

### Task 1.2: Re-create user_achievements migration

**Files:**
- Create: `supabase/migrations/20260425120100_recreate_user_achievements.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260425120100_recreate_user_achievements.sql
-- Re-applies the user_achievements table from migration 008 (which was
-- rolled back from production at some point). The accompanying SQL trigger
-- functions from 008 are NOT recreated here — TS owns badge granting.

CREATE TYPE achievement_badge_type AS ENUM (
  'nutrition_form_completed',
  'profile_completed',
  'first_pre_workout',
  'first_post_workout',
  'first_video_watched',
  'videos_day_complete',
  'all_videos_watched',
  'first_assessment',
  'five_assessments',
  'ten_assessments',
  'sprint_improved',
  'jump_improved',
  'overall_improved_5pts',
  'overall_improved_10pts',
  'streak_7_days',
  'streak_30_days',
  'streak_100_days',
  'first_goal_achieved',
  'five_goals_achieved'
);

CREATE TABLE user_achievements (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  badge_type   achievement_badge_type NOT NULL,
  unlocked_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata     JSONB,
  celebrated   BOOLEAN NOT NULL DEFAULT FALSE,
  CONSTRAINT user_achievements_user_badge_unique UNIQUE (user_id, badge_type)
);

CREATE INDEX idx_user_achievements_user ON user_achievements (user_id);
CREATE INDEX idx_user_achievements_user_uncelebrated
  ON user_achievements (user_id) WHERE celebrated = FALSE;

ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own achievements" ON user_achievements
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Staff read all achievements" ON user_achievements
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer'))
  );

CREATE POLICY "Users can earn own achievements" ON user_achievements
  FOR INSERT TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "Users update own achievement celebrated flag" ON user_achievements
  FOR UPDATE USING (auth.uid() = user_id);

COMMENT ON TABLE user_achievements IS
  'Earned badges per user. Granted by TS server actions (not SQL triggers). Single source of truth for badge list is src/features/achievements/lib/config/badge-config.ts.';
```

- [ ] **Step 2: Apply via Supabase MCP**

Use `mcp__plugin_supabase_supabase__apply_migration`:
- `name`: `recreate_user_achievements`
- `query`: the SQL above.

- [ ] **Step 3: Verify in production**

```sql
SELECT COUNT(*) AS row_count FROM user_achievements;
SELECT enumlabel FROM pg_enum WHERE enumtypid = 'achievement_badge_type'::regtype ORDER BY enumsortorder;
```

Expected: `row_count = 0`. Enum lists exactly the 19 values from the migration.

### Task 1.3: Regenerate types and commit

- [ ] **Step 1: Regenerate TS types from the live schema**

Use `mcp__plugin_supabase_supabase__generate_typescript_types` with `project_id: sedqdnpdvwpivrocdlmh`. Save the output to `src/types/database.ts` (overwriting).

- [ ] **Step 2: Verify TypeScript still compiles**

Run: `npx tsc --noEmit`

Expected: zero errors.

- [ ] **Step 3: Run all tests to confirm no regression**

Run: `npm run test:run`

Expected: 561 / 561 passing (the count from yesterday's commit).

- [ ] **Step 4: Commit Phase 1**

```bash
git add supabase/migrations/20260425120000_create_player_rating_snapshots.sql \
        supabase/migrations/20260425120100_recreate_user_achievements.sql \
        src/types/database.ts
git commit -m "$(cat <<'EOF'
feat(player-data): create rating snapshots + restore user_achievements (phase 1)

Schema-only addition. No reader or writer changes yet, so behavior is
unchanged. Sets up the storage for the wide-scope player-data refactor
described in docs/superpowers/specs/2026-04-25-player-data-architecture-design.md.

- Add player_rating_snapshots: one row per assessment, frozen card stats
  with RLS (trainee reads own; staff reads all; writes via service role).
- Recreate user_achievements + achievement_badge_type ENUM (mig 008's
  table + ENUM were rolled back from prod). Includes the scoped INSERT
  policy from migration 20260215120000_fix_achievements_rls_insert.
- Regenerate src/types/database.ts so application code compiles cleanly.
EOF
)"
```

---

## Phase 2 — Backfill (idempotent, safe to re-run)

### Task 2.1: Pure helper `composeSnapshot` — write the failing test

**Files:**
- Test: `src/features/player-assessments/lib/__tests__/snapshot.test.ts`

- [ ] **Step 1: Create the test file**

```typescript
// src/features/player-assessments/lib/__tests__/snapshot.test.ts
import { describe, it, expect } from "vitest";
import { composeSnapshot } from "../snapshot";
import type { PlayerAssessment } from "@/types/assessment";
import type { CalculatedRatings } from "@/lib/assessment-to-rating";

const baseAssessment: PlayerAssessment = {
  id: "asmt-1",
  user_id: "user-1",
  assessment_date: "2026-04-24",
  sprint_5m: null, sprint_10m: null, sprint_20m: null,
  jump_2leg_distance: null, jump_right_leg: null, jump_left_leg: null,
  jump_2leg_height: null, blaze_spot_time: null,
  flexibility_ankle: null, flexibility_knee: null, flexibility_hip: null,
  coordination: null, leg_power_technique: null, body_structure: null,
  kick_power_kaiser: null,
  concentration_notes: null, decision_making_notes: null,
  work_ethic_notes: null, recovery_notes: null, nutrition_notes: null,
  assessed_by: null, notes: null,
  created_at: "2026-04-24T00:00:00Z",
};

const sampleRatings: CalculatedRatings = {
  pace: 78, shooting: null, passing: 55, dribbling: 59,
  defending: null, physical: 59, overall_rating: 63,
};

describe("composeSnapshot", () => {
  it("builds a row keyed on assessment_id with the rating values", () => {
    const row = composeSnapshot({
      assessment: baseAssessment,
      ageGroupId: "u12",
      ratings: sampleRatings,
    });
    expect(row.assessment_id).toBe("asmt-1");
    expect(row.user_id).toBe("user-1");
    expect(row.assessment_date).toBe("2026-04-24");
    expect(row.age_group).toBe("u12");
    expect(row.pace).toBe(78);
    expect(row.shooting).toBeNull();
    expect(row.overall_rating).toBe(63);
  });

  it("handles a null age group (no birthdate / unknown cohort)", () => {
    const row = composeSnapshot({
      assessment: baseAssessment,
      ageGroupId: null,
      ratings: sampleRatings,
    });
    expect(row.age_group).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npm run test:run -- src/features/player-assessments/lib/__tests__/snapshot.test.ts`

Expected: FAIL — `Cannot find module '../snapshot'`.

### Task 2.2: Implement `composeSnapshot` and `writeRatingSnapshot`

**Files:**
- Create: `src/features/player-assessments/lib/snapshot.ts`

- [ ] **Step 1: Write the helper module**

```typescript
// src/features/player-assessments/lib/snapshot.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlayerAssessment } from "@/types/assessment";
import { getAgeGroup } from "@/types/assessment";
import { calculateCardRatings, type CalculatedRatings } from "@/lib/assessment-to-rating";
import { fetchGroupStats } from "@/lib/utils/fetch-benchmarks";

export interface RatingSnapshotRow {
  user_id: string;
  assessment_id: string;
  assessment_date: string;
  age_group: string | null;
  pace: number | null;
  shooting: number | null;
  passing: number | null;
  dribbling: number | null;
  defending: number | null;
  physical: number | null;
  overall_rating: number | null;
}

/** Pure: build a snapshot row from an assessment + ratings. */
export function composeSnapshot(input: {
  assessment: PlayerAssessment;
  ageGroupId: string | null;
  ratings: CalculatedRatings;
}): RatingSnapshotRow {
  const { assessment, ageGroupId, ratings } = input;
  return {
    user_id: assessment.user_id,
    assessment_id: assessment.id,
    assessment_date: assessment.assessment_date,
    age_group: ageGroupId,
    pace: ratings.pace,
    shooting: ratings.shooting,
    passing: ratings.passing,
    dribbling: ratings.dribbling,
    defending: ratings.defending,
    physical: ratings.physical,
    overall_rating: ratings.overall_rating,
  };
}

/**
 * Compute and UPSERT a rating snapshot for a single assessment.
 * Best-effort: errors are logged and swallowed — never fails the parent action.
 */
export async function writeRatingSnapshot(
  supabase: SupabaseClient,
  assessment: PlayerAssessment,
  birthdate: string | null
): Promise<{ ok: boolean; reason?: string }> {
  try {
    const ageGroup = getAgeGroup(birthdate);
    if (!ageGroup) {
      return { ok: false, reason: "no_age_group" };
    }
    const benchmarks = await fetchGroupStats(supabase, ageGroup.id);
    if (!benchmarks) {
      return { ok: false, reason: "no_benchmarks" };
    }
    const ratings = calculateCardRatings(assessment, benchmarks);
    const row = composeSnapshot({ assessment, ageGroupId: ageGroup.id, ratings });
    const { error } = await supabase
      .from("player_rating_snapshots")
      .upsert(row, { onConflict: "assessment_id" });
    if (error) {
      console.error("writeRatingSnapshot upsert failed:", error.message);
      return { ok: false, reason: error.message };
    }
    return { ok: true };
  } catch (e) {
    console.error("writeRatingSnapshot threw:", e);
    return { ok: false, reason: String(e) };
  }
}
```

- [ ] **Step 2: Run the test, verify it passes**

Run: `npm run test:run -- src/features/player-assessments/lib/__tests__/snapshot.test.ts`

Expected: 2 tests passing.

- [ ] **Step 3: Verify lint and typecheck**

Run: `npx tsc --noEmit && npx eslint src/features/player-assessments/`

Expected: clean output.

- [ ] **Step 4: Commit**

```bash
git add src/features/player-assessments/lib/snapshot.ts \
        src/features/player-assessments/lib/__tests__/snapshot.test.ts
git commit -m "feat(player-data): add composeSnapshot + writeRatingSnapshot helpers"
```

### Task 2.3: Pure helper `chooseAssessmentBadges` — write the failing tests

**Files:**
- Test: `src/features/achievements/lib/utils/__tests__/choose-assessment-badges.test.ts`

- [ ] **Step 1: Create the test file**

```typescript
// src/features/achievements/lib/utils/__tests__/choose-assessment-badges.test.ts
import { describe, it, expect } from "vitest";
import { chooseAssessmentBadges } from "../choose-assessment-badges";
import type { PlayerAssessment } from "@/types/assessment";

const empty = (over: Partial<PlayerAssessment>): PlayerAssessment => ({
  id: "x", user_id: "u", assessment_date: "2026-04-24",
  sprint_5m: null, sprint_10m: null, sprint_20m: null,
  jump_2leg_distance: null, jump_right_leg: null, jump_left_leg: null,
  jump_2leg_height: null, blaze_spot_time: null,
  flexibility_ankle: null, flexibility_knee: null, flexibility_hip: null,
  coordination: null, leg_power_technique: null, body_structure: null,
  kick_power_kaiser: null,
  concentration_notes: null, decision_making_notes: null,
  work_ethic_notes: null, recovery_notes: null, nutrition_notes: null,
  assessed_by: null, notes: null,
  created_at: "2026-04-24T00:00:00Z",
  ...over,
});

describe("chooseAssessmentBadges — count milestones", () => {
  it("first_assessment when this is the trainee's first", () => {
    expect(
      chooseAssessmentBadges({
        priorAssessmentCount: 0,
        prevAssessment: null,
        newAssessment: empty({ sprint_5m: 1.1 }),
        prevSnapshotOverall: null,
        newSnapshotOverall: 60,
      })
    ).toContain("first_assessment");
  });

  it("five_assessments when this is the 5th", () => {
    const badges = chooseAssessmentBadges({
      priorAssessmentCount: 4,
      prevAssessment: empty({}),
      newAssessment: empty({}),
      prevSnapshotOverall: 60,
      newSnapshotOverall: 60,
    });
    expect(badges).toContain("five_assessments");
    expect(badges).not.toContain("first_assessment");
  });

  it("ten_assessments when this is the 10th", () => {
    expect(
      chooseAssessmentBadges({
        priorAssessmentCount: 9,
        prevAssessment: empty({}),
        newAssessment: empty({}),
        prevSnapshotOverall: 60,
        newSnapshotOverall: 60,
      })
    ).toContain("ten_assessments");
  });
});

describe("chooseAssessmentBadges — sprint_improved", () => {
  it("granted when any sprint metric got faster (lower)", () => {
    const badges = chooseAssessmentBadges({
      priorAssessmentCount: 1,
      prevAssessment: empty({ sprint_5m: 1.2 }),
      newAssessment: empty({ sprint_5m: 1.1 }),
      prevSnapshotOverall: null,
      newSnapshotOverall: null,
    });
    expect(badges).toContain("sprint_improved");
  });

  it("not granted when sprint got slower (higher)", () => {
    const badges = chooseAssessmentBadges({
      priorAssessmentCount: 1,
      prevAssessment: empty({ sprint_5m: 1.1 }),
      newAssessment: empty({ sprint_5m: 1.2 }),
      prevSnapshotOverall: null,
      newSnapshotOverall: null,
    });
    expect(badges).not.toContain("sprint_improved");
  });

  it("not granted on first assessment (no prev to compare)", () => {
    const badges = chooseAssessmentBadges({
      priorAssessmentCount: 0,
      prevAssessment: null,
      newAssessment: empty({ sprint_5m: 1.1 }),
      prevSnapshotOverall: null,
      newSnapshotOverall: null,
    });
    expect(badges).not.toContain("sprint_improved");
  });
});

describe("chooseAssessmentBadges — jump_improved", () => {
  it("granted when any jump metric improved (higher)", () => {
    const badges = chooseAssessmentBadges({
      priorAssessmentCount: 1,
      prevAssessment: empty({ jump_2leg_distance: 150 }),
      newAssessment: empty({ jump_2leg_distance: 160 }),
      prevSnapshotOverall: null,
      newSnapshotOverall: null,
    });
    expect(badges).toContain("jump_improved");
  });
});

describe("chooseAssessmentBadges — overall improvement", () => {
  it("overall_improved_5pts when overall went up by exactly 5", () => {
    const badges = chooseAssessmentBadges({
      priorAssessmentCount: 1,
      prevAssessment: empty({}), newAssessment: empty({}),
      prevSnapshotOverall: 55, newSnapshotOverall: 60,
    });
    expect(badges).toContain("overall_improved_5pts");
    expect(badges).not.toContain("overall_improved_10pts");
  });

  it("overall_improved_10pts when overall went up by 10 or more (and includes 5pts)", () => {
    const badges = chooseAssessmentBadges({
      priorAssessmentCount: 1,
      prevAssessment: empty({}), newAssessment: empty({}),
      prevSnapshotOverall: 50, newSnapshotOverall: 60,
    });
    expect(badges).toContain("overall_improved_10pts");
    expect(badges).toContain("overall_improved_5pts");
  });

  it("no overall badges when prev or new snapshot is null", () => {
    const badges = chooseAssessmentBadges({
      priorAssessmentCount: 1,
      prevAssessment: empty({}), newAssessment: empty({}),
      prevSnapshotOverall: null, newSnapshotOverall: 60,
    });
    expect(badges).not.toContain("overall_improved_5pts");
    expect(badges).not.toContain("overall_improved_10pts");
  });

  it("no overall badges when overall did not improve", () => {
    const badges = chooseAssessmentBadges({
      priorAssessmentCount: 1,
      prevAssessment: empty({}), newAssessment: empty({}),
      prevSnapshotOverall: 60, newSnapshotOverall: 58,
    });
    expect(badges).not.toContain("overall_improved_5pts");
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

Run: `npm run test:run -- src/features/achievements/lib/utils/__tests__/choose-assessment-badges.test.ts`

Expected: FAIL — `Cannot find module '../choose-assessment-badges'`.

### Task 2.4: Implement `chooseAssessmentBadges`

**Files:**
- Create: `src/features/achievements/lib/utils/choose-assessment-badges.ts`

- [ ] **Step 1: Write the implementation**

```typescript
// src/features/achievements/lib/utils/choose-assessment-badges.ts
import type { PlayerAssessment } from "@/types/assessment";
import type { AchievementBadgeType } from "../../types";

interface Input {
  /** Count of NON-DELETED assessments BEFORE this one. */
  priorAssessmentCount: number;
  /** The most recent prior assessment for the same user (chronologically), if any. */
  prevAssessment: PlayerAssessment | null;
  /** The just-recorded assessment. */
  newAssessment: PlayerAssessment;
  /** Overall rating from the previous snapshot (null if no prior snapshot or no data). */
  prevSnapshotOverall: number | null;
  /** Overall rating from the just-computed snapshot (null if not enough data). */
  newSnapshotOverall: number | null;
}

const SPRINT_KEYS = ["sprint_5m", "sprint_10m", "sprint_20m"] as const;
const JUMP_KEYS = [
  "jump_2leg_distance",
  "jump_right_leg",
  "jump_left_leg",
  "jump_2leg_height",
] as const;

function anyDecreased(
  prev: PlayerAssessment,
  next: PlayerAssessment,
  keys: readonly (keyof PlayerAssessment)[]
): boolean {
  return keys.some((k) => {
    const a = prev[k] as number | null;
    const b = next[k] as number | null;
    return a !== null && b !== null && b < a;
  });
}

function anyIncreased(
  prev: PlayerAssessment,
  next: PlayerAssessment,
  keys: readonly (keyof PlayerAssessment)[]
): boolean {
  return keys.some((k) => {
    const a = prev[k] as number | null;
    const b = next[k] as number | null;
    return a !== null && b !== null && b > a;
  });
}

/**
 * Pure: decide which assessment-derived badges this write earns.
 * Idempotency is guarded by the UNIQUE (user_id, badge_type) constraint at the DB layer.
 */
export function chooseAssessmentBadges(input: Input): AchievementBadgeType[] {
  const out: AchievementBadgeType[] = [];
  const total = input.priorAssessmentCount + 1;

  if (total === 1) out.push("first_assessment");
  if (total === 5) out.push("five_assessments");
  if (total === 10) out.push("ten_assessments");

  if (input.prevAssessment) {
    if (anyDecreased(input.prevAssessment, input.newAssessment, SPRINT_KEYS)) {
      out.push("sprint_improved");
    }
    if (anyIncreased(input.prevAssessment, input.newAssessment, JUMP_KEYS)) {
      out.push("jump_improved");
    }
  }

  if (input.prevSnapshotOverall !== null && input.newSnapshotOverall !== null) {
    const delta = input.newSnapshotOverall - input.prevSnapshotOverall;
    if (delta >= 5) out.push("overall_improved_5pts");
    if (delta >= 10) out.push("overall_improved_10pts");
  }

  return out;
}
```

- [ ] **Step 2: Run the test, verify it passes**

Run: `npm run test:run -- src/features/achievements/lib/utils/__tests__/choose-assessment-badges.test.ts`

Expected: All 10 tests passing.

- [ ] **Step 3: Verify typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src/features/achievements/lib/utils/`

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/features/achievements/lib/utils/choose-assessment-badges.ts \
        src/features/achievements/lib/utils/__tests__/choose-assessment-badges.test.ts
git commit -m "feat(achievements): add chooseAssessmentBadges pure function + tests"
```

### Task 2.5: `grantBadge` shared helper

**Files:**
- Create: `src/features/achievements/lib/actions/grant-badge.ts`

- [ ] **Step 1: Write the helper**

```typescript
// src/features/achievements/lib/actions/grant-badge.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AchievementBadgeType } from "../../types";

interface GrantOptions {
  /** When true, the badge is silently inserted as already-celebrated (used by backfill). */
  preCelebrated?: boolean;
  metadata?: Record<string, unknown>;
}

/**
 * Idempotent badge grant. UNIQUE (user_id, badge_type) at the DB layer
 * means re-grants are no-ops.
 *
 * Best-effort: errors are logged but swallowed.
 */
export async function grantBadge(
  supabase: SupabaseClient,
  userId: string,
  badgeType: AchievementBadgeType,
  options: GrantOptions = {}
): Promise<{ ok: boolean; reason?: string }> {
  try {
    const { error } = await supabase
      .from("user_achievements")
      .insert({
        user_id: userId,
        badge_type: badgeType,
        celebrated: options.preCelebrated ?? false,
        metadata: options.metadata ?? null,
      });
    if (error) {
      // 23505 = unique_violation — expected and benign.
      if (error.code === "23505") return { ok: true };
      console.error(`grantBadge ${badgeType} failed for user ${userId}:`, error.message);
      return { ok: false, reason: error.message };
    }
    return { ok: true };
  } catch (e) {
    console.error("grantBadge threw:", e);
    return { ok: false, reason: String(e) };
  }
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`

Expected: clean.

### Task 2.6: `grantAssessmentBadges` Supabase wrapper

**Files:**
- Create: `src/features/achievements/lib/actions/grant-assessment-badges.ts`

- [ ] **Step 1: Write the wrapper**

```typescript
// src/features/achievements/lib/actions/grant-assessment-badges.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlayerAssessment } from "@/types/assessment";
import { chooseAssessmentBadges } from "../utils/choose-assessment-badges";
import { grantBadge } from "./grant-badge";

interface Args {
  /** Set to true when running the one-time backfill (mark all granted badges as already celebrated). */
  preCelebrated?: boolean;
}

export async function grantAssessmentBadges(
  supabase: SupabaseClient,
  newAssessment: PlayerAssessment,
  args: Args = {}
): Promise<void> {
  const userId = newAssessment.user_id;

  // Count of prior NON-DELETED assessments for this user.
  const { count: priorCount } = await supabase
    .from("player_assessments")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("deleted_at", null)
    .lt("assessment_date", newAssessment.assessment_date);

  // Most-recent prior assessment (chronologically before this one).
  const { data: prevAssessmentRows } = await supabase
    .from("player_assessments")
    .select("*")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .lt("assessment_date", newAssessment.assessment_date)
    .order("assessment_date", { ascending: false })
    .limit(1);
  const prevAssessment = (prevAssessmentRows?.[0] ?? null) as PlayerAssessment | null;

  // Snapshot deltas (compare current row to the row before it).
  const { data: snapshotRows } = await supabase
    .from("player_rating_snapshots")
    .select("overall_rating, assessment_id")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("assessment_date", { ascending: false })
    .limit(2);
  const newSnapshotOverall =
    snapshotRows?.find((r) => r.assessment_id === newAssessment.id)?.overall_rating ?? null;
  const prevSnapshotOverall =
    snapshotRows?.find((r) => r.assessment_id !== newAssessment.id)?.overall_rating ?? null;

  const badges = chooseAssessmentBadges({
    priorAssessmentCount: priorCount ?? 0,
    prevAssessment,
    newAssessment,
    prevSnapshotOverall,
    newSnapshotOverall,
  });

  for (const badge of badges) {
    await grantBadge(supabase, userId, badge, { preCelebrated: args.preCelebrated });
  }
}
```

- [ ] **Step 2: Verify typecheck**

Run: `npx tsc --noEmit`

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/features/achievements/lib/actions/grant-badge.ts \
        src/features/achievements/lib/actions/grant-assessment-badges.ts
git commit -m "feat(achievements): add grantBadge + grantAssessmentBadges Supabase wrappers"
```

### Task 2.7: Backfill script

**Files:**
- Create: `scripts/backfill-rating-snapshots.ts`

- [ ] **Step 1: Write the script**

```typescript
// scripts/backfill-rating-snapshots.ts
//
// One-time backfill: for every non-deleted player_assessments row, write a
// player_rating_snapshots row and grant any retroactive badges (silently —
// preCelebrated = true).
//
// Idempotent: UPSERTs the snapshot keyed on assessment_id; UNIQUE constraint
// on user_achievements absorbs duplicate grants.
//
// Usage: npx tsx scripts/backfill-rating-snapshots.ts [--dry-run]
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import { writeRatingSnapshot } from "../src/features/player-assessments/lib/snapshot";
import { grantAssessmentBadges } from "../src/features/achievements/lib/actions/grant-assessment-badges";
import type { PlayerAssessment } from "../src/types/assessment";

const dryRun = process.argv.includes("--dry-run");

const env: Record<string, string> = {};
for (const line of fs.readFileSync(".env.local", "utf-8").split("\n")) {
  const t = line.trim();
  if (!t || t.startsWith("#")) continue;
  const i = t.indexOf("=");
  if (i === -1) continue;
  let v = t.slice(i + 1).trim();
  if (v.startsWith('"') && v.endsWith('"')) v = v.slice(1, -1);
  v = v.replace(/\\n$/g, "");
  env[t.slice(0, i).trim()] = v;
}

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL!, env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log(dryRun ? "[DRY RUN] " : "[LIVE] ", "starting backfill");

  // Process per user, in date order, so badge deltas are computed correctly.
  const { data: profiles, error: pErr } = await supabase
    .from("profiles")
    .select("id, birthdate")
    .eq("role", "trainee");
  if (pErr) throw pErr;

  let snapshotCount = 0;
  let badgeUserCount = 0;
  let userCount = 0;

  for (const p of profiles ?? []) {
    const { data: rows, error: aErr } = await supabase
      .from("player_assessments")
      .select("*")
      .eq("user_id", p.id)
      .is("deleted_at", null)
      .order("assessment_date", { ascending: true });
    if (aErr) {
      console.error(`fetch assessments failed for ${p.id}:`, aErr);
      continue;
    }
    const assessments = (rows ?? []) as PlayerAssessment[];
    if (assessments.length === 0) continue;
    userCount++;

    for (const a of assessments) {
      if (dryRun) {
        snapshotCount++;
        continue;
      }
      const result = await writeRatingSnapshot(supabase, a, p.birthdate);
      if (result.ok) snapshotCount++;
      else if (result.reason !== "no_age_group" && result.reason !== "no_benchmarks") {
        console.error(`snapshot failed for assessment ${a.id}:`, result.reason);
      }
      // Grant badges using the snapshots we just wrote.
      await grantAssessmentBadges(supabase, a, { preCelebrated: true });
    }
    badgeUserCount++;
    if (userCount % 25 === 0) console.log(`processed ${userCount} users`);
  }

  console.log(`Done. ${snapshotCount} snapshots ${dryRun ? "would be written" : "written"}, ${badgeUserCount} users processed for badges.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 2: Dry-run the script (no writes)**

Run: `npx tsx scripts/backfill-rating-snapshots.ts --dry-run`

Expected output (approximately): `[DRY RUN] starting backfill ... Done. ~396 snapshots would be written, ~225 users processed for badges.`

(Numbers should match the live counts: 396 non-deleted assessments, 225 trainees with profiles.)

- [ ] **Step 3: Run for real**

Run: `npx tsx scripts/backfill-rating-snapshots.ts`

Expected: same counts as dry-run, no errors.

- [ ] **Step 4: Validate via Supabase MCP**

```sql
SELECT
  (SELECT COUNT(*) FROM player_assessments WHERE deleted_at IS NULL) AS assessments,
  (SELECT COUNT(*) FROM player_rating_snapshots WHERE deleted_at IS NULL) AS snapshots,
  (SELECT COUNT(DISTINCT user_id) FROM player_rating_snapshots) AS unique_users;
```

Expected: `assessments` and `snapshots` are equal. `unique_users` close to 225 (some users may not have produced snapshots if their cohort had < 2 players).

```sql
SELECT badge_type, COUNT(*) FROM user_achievements GROUP BY badge_type ORDER BY 2 DESC;
```

Expected: `first_assessment` matches the unique-user count of users who had at least one assessment; `sprint_improved`, `jump_improved` are the next-largest categories; `overall_improved_5pts` / `overall_improved_10pts` exist where snapshot deltas crossed the threshold.

- [ ] **Step 5: Commit Phase 2**

```bash
git add scripts/backfill-rating-snapshots.ts
git commit -m "$(cat <<'EOF'
feat(player-data): backfill rating snapshots + retroactive badges (phase 2)

One-time script that walks all non-deleted player_assessments rows in
date order per user and writes:
- A player_rating_snapshots row per assessment via writeRatingSnapshot.
- Any retroactively-earned achievement badges via grantAssessmentBadges
  with preCelebrated=true (no notification flood).

Idempotent: UPSERT on assessment_id; UNIQUE (user_id, badge_type) absorbs
duplicate grants. Safe to re-run.
EOF
)"
```

---

## Phase 3 — Add the write path

### Task 3.1: `recordAssessment` server action

**Files:**
- Create: `src/features/player-assessments/lib/actions/record-assessment.ts`

- [ ] **Step 1: Write the action**

```typescript
// src/features/player-assessments/lib/actions/record-assessment.ts
"use server";

import { createClient } from "@/lib/supabase/server";
import { verifyAdminOrTrainer } from "@/lib/actions/shared";
import { typedFrom } from "@/lib/supabase/helpers";
import type { PlayerAssessment } from "@/types/assessment";
import { writeRatingSnapshot } from "../snapshot";
import { grantAssessmentBadges } from "@/features/achievements/lib/actions/grant-assessment-badges";

interface AssessmentInsertInput {
  user_id: string;
  assessment_date: string;
  sprint_5m?: number | null;
  sprint_10m?: number | null;
  sprint_20m?: number | null;
  jump_2leg_distance?: number | null;
  jump_right_leg?: number | null;
  jump_left_leg?: number | null;
  jump_2leg_height?: number | null;
  blaze_spot_time?: number | null;
  flexibility_ankle?: number | null;
  flexibility_knee?: number | null;
  flexibility_hip?: number | null;
  coordination?: PlayerAssessment["coordination"];
  leg_power_technique?: PlayerAssessment["leg_power_technique"];
  body_structure?: PlayerAssessment["body_structure"];
  kick_power_kaiser?: number | null;
  concentration_notes?: string | null;
  decision_making_notes?: string | null;
  work_ethic_notes?: string | null;
  recovery_notes?: string | null;
  nutrition_notes?: string | null;
  notes?: string | null;
}

interface RecordResult {
  success: boolean;
  data?: PlayerAssessment;
  error?: string;
}

/**
 * The single sanctioned way to insert a new player_assessments row.
 * After insert: recomputes ratings and writes a snapshot, then grants any
 * earned badges. Both are best-effort — failures don't fail the assessment.
 */
export async function recordAssessment(
  input: AssessmentInsertInput
): Promise<RecordResult> {
  const { error: authError, user } = await verifyAdminOrTrainer();
  if (authError || !user) return { success: false, error: authError ?? "unauthorized" };

  const supabase = await createClient();
  const { data, error } = await typedFrom(supabase, "player_assessments")
    .insert({ ...input, assessed_by: user.id })
    .select("*")
    .single();
  if (error || !data) {
    return { success: false, error: error?.message ?? "insert failed" };
  }
  const assessment = data as PlayerAssessment;

  // Best-effort post-write: snapshot then badges.
  const { data: profile } = await supabase
    .from("profiles")
    .select("birthdate")
    .eq("id", assessment.user_id)
    .single();
  await writeRatingSnapshot(supabase, assessment, (profile as { birthdate: string | null } | null)?.birthdate ?? null);
  await grantAssessmentBadges(supabase, assessment);

  return { success: true, data: assessment };
}

/**
 * Update an existing assessment row (used by the multi-step admin form
 * which writes one step at a time). Re-snapshots after the update so the
 * cached rating reflects the latest values.
 */
export async function updateAssessment(
  assessmentId: string,
  patch: Partial<AssessmentInsertInput>
): Promise<RecordResult> {
  const { error: authError, user } = await verifyAdminOrTrainer();
  if (authError || !user) return { success: false, error: authError ?? "unauthorized" };

  const supabase = await createClient();
  const { data, error } = await typedFrom(supabase, "player_assessments")
    .update({ ...patch, assessed_by: user.id })
    .eq("id", assessmentId)
    .select("*")
    .single();
  if (error || !data) {
    return { success: false, error: error?.message ?? "update failed" };
  }
  const assessment = data as PlayerAssessment;

  const { data: profile } = await supabase
    .from("profiles")
    .select("birthdate")
    .eq("id", assessment.user_id)
    .single();
  await writeRatingSnapshot(supabase, assessment, (profile as { birthdate: string | null } | null)?.birthdate ?? null);
  // Note: badge grants only fire on assessment INSERT, not on subsequent
  // step UPDATEs, to avoid double-granting as the multi-step form fills out.
  return { success: true, data: assessment };
}
```

- [ ] **Step 2: Verify typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src/features/player-assessments/`

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/features/player-assessments/lib/actions/record-assessment.ts
git commit -m "feat(player-data): add recordAssessment + updateAssessment server actions"
```

### Task 3.2: Migrate `AssessmentForm` to use the new action

**Files:**
- Modify: `src/components/admin/AssessmentForm.tsx` (lines ~125-185)

- [ ] **Step 1: Read the current `saveStep` callback** (lines 125-185 of the file).

- [ ] **Step 2: Replace direct supabase calls with action calls**

Find this block (around line 152-167):

```typescript
        const { error } = await typedFrom(supabase, "player_assessments")
          .update(partialData)
          .eq("id", assessmentId);

        if (error) throw error;
      } else {
        // Create new assessment (first step)
        const { data: newAssessment, error } = await typedFrom(supabase, "player_assessments")
          .insert(assessmentData)
          .select("id")
          .single();

        if (error) throw error;
        if (newAssessment) {
          setAssessmentId(newAssessment.id);
        }
      }
```

Replace with:

```typescript
        const { recordAssessment, updateAssessment } = await import(
          "@/features/player-assessments/lib/actions/record-assessment"
        );
        if (assessmentId) {
          const stepFields = STEP_DB_FIELDS[currentStep];
          if (!stepFields) {
            throw new Error(`שלב ${currentStep} אינו ממופה — לא ניתן לשמור`);
          }
          type DbData = ReturnType<typeof formDataToDbFormat>;
          const partialData: Record<string, unknown> = {};
          for (const field of stepFields) {
            partialData[field] = assessmentData[field as keyof DbData];
          }
          const result = await updateAssessment(assessmentId, partialData);
          if (!result.success) throw new Error(result.error ?? "update failed");
        } else {
          const result = await recordAssessment(assessmentData);
          if (!result.success || !result.data) {
            throw new Error(result.error ?? "insert failed");
          }
          setAssessmentId(result.data.id);
        }
```

Also remove the now-unused `const supabase = createClient();` and `const { data: { user } } = await supabase.auth.getUser();` if they're not referenced elsewhere in `saveStep`.

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc --noEmit`

Expected: clean.

- [ ] **Step 4: Verify the form still renders without errors**

Run: `npm run dev`

Open `http://localhost:3000/admin/assessments/<some-trainee-id>/new` (with admin login). Check the page loads and the form displays. Don't submit yet.

- [ ] **Step 5: Test a full assessment flow end-to-end (manual)**

Sign in as admin. Navigate to a test trainee's "New assessment" page. Fill out all 6 steps with test values. Click Finish. Confirm:
- The assessment appears in the trainee's list.
- A row appears in `player_rating_snapshots` for the new assessment_id (verify via Supabase MCP `SELECT * FROM player_rating_snapshots WHERE assessment_id = '<new-id>'`).
- If the trainee had no prior assessments, a `first_assessment` row appears in `user_achievements`.

- [ ] **Step 6: Commit**

```bash
git add src/components/admin/AssessmentForm.tsx
git commit -m "refactor(admin): route AssessmentForm through recordAssessment server action"
```

### Task 3.3: Backfill cron route

**Files:**
- Create: `src/app/api/cron/backfill-rating-snapshots/route.ts`

- [ ] **Step 1: Write the route**

```typescript
// src/app/api/cron/backfill-rating-snapshots/route.ts
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { writeRatingSnapshot } from "@/features/player-assessments/lib/snapshot";
import { grantAssessmentBadges } from "@/features/achievements/lib/actions/grant-assessment-badges";
import type { PlayerAssessment } from "@/types/assessment";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Daily orphan-snapshot catcher.
 * Finds assessments without a corresponding snapshot row and computes one.
 * Also grants any retroactive badges (preCelebrated=true).
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();

  // Orphan = assessment with no snapshot row.
  const { data: orphans, error } = await supabase
    .rpc("get_assessments_without_snapshots") as { data: { id: string; user_id: string }[] | null; error: { message: string } | null };
  if (error) {
    // If the RPC isn't defined, fall back to a manual LEFT JOIN.
    const { data: rows, error: e2 } = await supabase
      .from("player_assessments")
      .select("id, user_id, assessment_date, sprint_5m, sprint_10m, sprint_20m, jump_2leg_distance, jump_right_leg, jump_left_leg, jump_2leg_height, blaze_spot_time, flexibility_ankle, flexibility_knee, flexibility_hip, coordination, leg_power_technique, body_structure, kick_power_kaiser, concentration_notes, decision_making_notes, work_ethic_notes, recovery_notes, nutrition_notes, assessed_by, notes, created_at")
      .is("deleted_at", null);
    if (e2) {
      return NextResponse.json({ error: e2.message }, { status: 500 });
    }

    const { data: snapshotIds } = await supabase
      .from("player_rating_snapshots")
      .select("assessment_id");
    const known = new Set((snapshotIds ?? []).map((r) => r.assessment_id));
    const missing = (rows ?? []).filter((r) => !known.has(r.id)) as PlayerAssessment[];

    let processed = 0;
    for (const a of missing) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("birthdate")
        .eq("id", a.user_id)
        .single();
      const birthdate = (profile as { birthdate: string | null } | null)?.birthdate ?? null;
      await writeRatingSnapshot(supabase, a, birthdate);
      await grantAssessmentBadges(supabase, a, { preCelebrated: true });
      processed++;
    }
    return NextResponse.json({ ok: true, processed, found: missing.length });
  }

  return NextResponse.json({ ok: true, processed: orphans?.length ?? 0 });
}
```

- [ ] **Step 2: Add cron schedule to `vercel.json`**

Read the existing `vercel.json` (project root). Find the `crons` array. Add:

```json
{
  "path": "/api/cron/backfill-rating-snapshots",
  "schedule": "30 3 * * *"
}
```

(30 minutes after the existing `recalculate-benchmarks` cron at 3:00 UTC, so benchmarks are fresh first.)

- [ ] **Step 3: Verify typecheck**

Run: `npx tsc --noEmit`

Expected: clean.

- [ ] **Step 4: Commit Phase 3**

```bash
git add src/app/api/cron/backfill-rating-snapshots/route.ts vercel.json
git commit -m "$(cat <<'EOF'
feat(player-data): write path + backfill cron (phase 3)

- recordAssessment / updateAssessment server actions are now the only
  sanctioned write path; AssessmentForm routes through them.
- Each successful write best-effort writes a rating snapshot + grants
  earned badges. Failures log but don't fail the assessment write.
- Daily cron at 03:30 UTC catches any orphan assessments (assessments
  without a corresponding snapshot row) and reprocesses them.
EOF
)"
```

- [ ] **Step 5: Deploy to production**

Run: `vercel --prod`

Wait for `Production: ... ready`.

- [ ] **Step 6: Production smoke test**

Open https://www.edengarden.co.il/admin/assessments/<trainee-id>/new as admin. Insert a test assessment (use a sandbox trainee or revert after). Verify in Supabase MCP that a snapshot row appeared for the new assessment_id.

---

## Phase 4 — Cutover reads

### Task 4.1: Add snapshot-based read helpers

**Files:**
- Modify: `src/lib/utils/get-player-ratings.ts`

- [ ] **Step 1: Replace the body with snapshot-reading logic**

Replace the current implementation with:

```typescript
// src/lib/utils/get-player-ratings.ts
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CalculatedRatings } from "@/lib/assessment-to-rating";
import { calculateNeutralRatings } from "@/lib/assessment-to-rating";

export interface PlayerRatingsResult {
  readonly ratings: CalculatedRatings;
}

/**
 * Returns the trainee's CURRENT ratings = the most recent rating snapshot.
 * If the trainee has no snapshot, returns neutral (all-null) ratings.
 *
 * Snapshots are computed at assessment write time by recordAssessment().
 * The orphan-catching cron at /api/cron/backfill-rating-snapshots ensures
 * any assessment with no snapshot is caught within 24 hours.
 */
export async function getPlayerRatings(
  supabase: SupabaseClient,
  userId: string
): Promise<PlayerRatingsResult> {
  const { data, error } = await supabase
    .from("player_rating_snapshots")
    .select("pace, shooting, passing, dribbling, defending, physical, overall_rating")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("assessment_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error || !data) {
    return { ratings: calculateNeutralRatings() };
  }
  return { ratings: data as CalculatedRatings };
}

export async function getPlayerRatingHistory(
  supabase: SupabaseClient,
  userId: string
): Promise<{
  date: string;
  pace: number | null;
  shooting: number | null;
  passing: number | null;
  dribbling: number | null;
  defending: number | null;
  physical: number | null;
  overall_rating: number | null;
}[]> {
  const { data } = await supabase
    .from("player_rating_snapshots")
    .select("assessment_date, pace, shooting, passing, dribbling, defending, physical, overall_rating")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("assessment_date", { ascending: true });
  return (data ?? []).map((r) => ({
    date: (r as { assessment_date: string }).assessment_date,
    pace: (r as { pace: number | null }).pace,
    shooting: (r as { shooting: number | null }).shooting,
    passing: (r as { passing: number | null }).passing,
    dribbling: (r as { dribbling: number | null }).dribbling,
    defending: (r as { defending: number | null }).defending,
    physical: (r as { physical: number | null }).physical,
    overall_rating: (r as { overall_rating: number | null }).overall_rating,
  }));
}
```

The old signatures (`getPlayerRatings(supabase, assessments, birthdate)`) are gone. We'll update callers in the next tasks.

- [ ] **Step 2: Verify typecheck (will show errors at call sites — that's expected)**

Run: `npx tsc --noEmit 2>&1 | head -30`

Expected: errors at call sites of the old `getPlayerRatings(supabase, assessments, birthdate)` signature. We'll fix them in 4.2-4.4.

### Task 4.2: Update transformToRatingChartData

**Files:**
- Modify: `src/features/progress-charts/lib/transforms/index.ts`

- [ ] **Step 1: Replace the rating-transform function**

Find `transformToRatingChartData` (around line 76). Replace its signature and body with:

```typescript
import { getPlayerRatingHistory } from "@/lib/utils/get-player-ratings";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function transformToRatingChartData(
  supabase: SupabaseClient,
  userId: string
): Promise<RatingDataPoint[]> {
  const history = await getPlayerRatingHistory(supabase, userId);
  return history.map((snapshot) => ({
    date: snapshot.date,
    dateDisplay: formatHebrewDate(snapshot.date),
    value: snapshot.overall_rating,
    pace: snapshot.pace,
    shooting: snapshot.shooting,
    passing: snapshot.passing,
    dribbling: snapshot.dribbling,
    defending: snapshot.defending,
    physical: snapshot.physical,
    overall_rating: snapshot.overall_rating,
  }));
}
```

The function is now async + takes `(supabase, userId)` instead of `(assessments, groupStats)`. Drop the unused imports of `calculateCardRatings`, `calculateNeutralRatings`, `GroupStats` from this file's import block.

- [ ] **Step 2: Update callers — `MiniRatingChartWrapper`**

File: `src/app/dashboard/MiniRatingChartWrapper.tsx`

The wrapper is currently a client component using a `useMemo` over `assessments` and `groupStats`. It now needs the data fetched server-side (because `transformToRatingChartData` became async with a Supabase call). Convert the wrapper to receive `data: RatingDataPoint[]` directly as a prop, and let the parent server component fetch.

```typescript
// src/app/dashboard/MiniRatingChartWrapper.tsx
"use client";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";
import type { RatingDataPoint } from "@/features/progress-charts";

const MiniRatingChart = dynamic(
  () => import("@/features/progress-charts").then((m) => ({ default: m.MiniRatingChart })),
  { ssr: false, loading: () => <Skeleton className="h-[100px]" /> }
);

export function MiniRatingChartWrapper({ data }: { data: RatingDataPoint[] }) {
  return <MiniRatingChart data={data} />;
}
```

- [ ] **Step 3: Update parent dashboard page**

File: `src/app/dashboard/page.tsx`

The dashboard already creates `supabase` + has `user.id`. After the existing `Promise.all` fetch block, add:

```typescript
import { transformToRatingChartData } from "@/features/progress-charts/lib/transforms";
// ... at the top of the file alongside other imports

// Inside DashboardPage(), after existing Promise.all but BEFORE rendering:
const ratingHistory = user
  ? await transformToRatingChartData(supabase, user.id)
  : [];
```

Then in the JSX, replace `<MiniRatingChartWrapper assessments={...} groupStats={...} />` with `<MiniRatingChartWrapper data={ratingHistory} />`.

Replace the existing `getPlayerRatings(supabase, assessments, profile?.birthdate || null)` call with the new signature: `getPlayerRatings(supabase, user.id)`. The result shape is `{ ratings }` — same as before — so the rest of the dashboard's `calculatedRatings` usage stays unchanged.

- [ ] **Step 4: Update `src/app/dashboard/assessments/page.tsx`**

Same pattern: replace `getPlayerRatings(supabase, assessments, ...)` with `getPlayerRatings(supabase, user.id)`. For the chart component, fetch via `transformToRatingChartData(supabase, user.id)` and pass as a prop. Drop `groupStats` from props chains where it was only used to feed `transformToRatingChartData`.

- [ ] **Step 5: Update `src/app/admin/users/[userId]/page.tsx`**

Same pattern: replace `getPlayerRatings(supabase, typedAssessments, userToEdit.birthdate)` → `getPlayerRatings(supabase, userToEdit.id)`. The radar chart still receives a `stats` object with the 6 main stats plus overall — that comes from `result.ratings`.

- [ ] **Step 6: Update `src/app/admin/assessments/[userId]/page.tsx`**

Same pattern: `getPlayerRatings(supabase, profile.id)`.

- [ ] **Step 7: Update `src/features/player-report/lib/actions/get-report-data.ts`**

Same pattern. The PDF report no longer needs `groupStats` for live rating computation — it reads from snapshots. Drop the `groupStats` field from `ReportData` if no other consumer needs it (`grep` for `groupStats` to confirm).

- [ ] **Step 8: Verify typecheck**

Run: `npx tsc --noEmit`

Expected: clean.

- [ ] **Step 9: Verify all tests pass**

Run: `npm run test:run`

Expected: 561 + new tests still passing. Some existing tests may reference the old `getPlayerRatings` signature; if so, adjust them (the function tests in `src/lib/__tests__/assessment-to-rating.test.ts` should still pass — they don't use `getPlayerRatings`).

### Task 4.3: Hebrew dashboard banner

**Files:**
- Create: `src/components/dashboard/RatingMigrationBanner.tsx`

- [ ] **Step 1: Write the component**

```typescript
// src/components/dashboard/RatingMigrationBanner.tsx
"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "rating-migration-banner-dismissed-2026-04-25";

export function RatingMigrationBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setVisible(!localStorage.getItem(STORAGE_KEY));
  }, []);

  if (!visible) return null;

  return (
    <div className="rounded-md border border-primary/20 bg-primary/5 p-3 flex items-start gap-3" dir="rtl">
      <div className="flex-1 text-sm">
        <p className="font-medium mb-1">עדכון לדירוגים שלך</p>
        <p className="text-muted-foreground">
          העדכנו את אופן חישוב הדירוג ההיסטורי. התוצאות עכשיו יציבות לאורך זמן —
          המספרים בגרף לא ישתנו רטרואקטיבית כשמתאמנים חדשים מצטרפים.
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon"
        aria-label="סגור"
        className="shrink-0"
        onClick={() => {
          localStorage.setItem(STORAGE_KEY, "1");
          setVisible(false);
        }}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
```

- [ ] **Step 2: Wire into the dashboard**

File: `src/app/dashboard/page.tsx`

Import and render at the top of the dashboard JSX, just after the welcome header and before the player card section:

```tsx
import { RatingMigrationBanner } from "@/components/dashboard/RatingMigrationBanner";
// ...
<div data-tour="welcome">
  ...
</div>
<RatingMigrationBanner />
{/* existing Player Card section follows */}
```

- [ ] **Step 3: Verify typecheck and lint**

Run: `npx tsc --noEmit && npx eslint src/components/dashboard/RatingMigrationBanner.tsx src/app/dashboard/page.tsx`

Expected: clean.

- [ ] **Step 4: Commit Phase 4**

```bash
git add src/lib/utils/get-player-ratings.ts \
        src/features/progress-charts/lib/transforms/index.ts \
        src/app/dashboard/page.tsx \
        src/app/dashboard/assessments/page.tsx \
        src/app/dashboard/MiniRatingChartWrapper.tsx \
        src/app/admin/users/[userId]/page.tsx \
        src/app/admin/assessments/[userId]/page.tsx \
        src/features/player-report/lib/actions/get-report-data.ts \
        src/components/dashboard/RatingMigrationBanner.tsx
git commit -m "$(cat <<'EOF'
feat(player-data): cutover reads to rating snapshots (phase 4)

Charts, player cards, and the PDF report now read from
player_rating_snapshots instead of recomputing on demand. Removes the
moving-baseline bug — historical chart points no longer shift when new
trainees join the cohort.

- getPlayerRatings now takes (supabase, userId) and reads the latest
  snapshot. Old (assessments, birthdate, groupStats) signature is gone.
- transformToRatingChartData reads the snapshot history.
- One-week Hebrew banner on the dashboard explains the change to trainees.
EOF
)"
```

- [ ] **Step 5: Deploy and visual smoke**

Run: `vercel --prod`

After deploy: open the dashboard as a known trainee with multiple assessments. Confirm:
- The chart renders.
- The numbers look reasonable (close to but not necessarily identical to pre-cutover, because the old path used today's benchmarks for ALL points).
- The Hebrew banner appears.
- Clicking X dismisses it; refreshing keeps it dismissed.

Open Yarin's chart specifically. Compare to `[Yarin's actual data print](#)` from the conversation: pace ~78, physical ~59, dribbling ~59, passing ~55, shooting null, defending null, overall ~63. Numbers should match.

---

## Phase 5 — Cleanup (only after Phase 4 stable for ~1 week)

### Task 5.1: Drop dead `player_stats` tables

**Files:**
- Create: `supabase/migrations/20260425120200_drop_dead_player_stats.sql`

- [ ] **Step 1: Write the migration**

```sql
-- supabase/migrations/20260425120200_drop_dead_player_stats.sql
-- Removes the empty player_stats / player_stats_history orphans from migration 002.
-- Both tables are 0 rows in production; nothing reads or writes them.
-- Their on-update trigger function also goes (no callers remain).

DROP TABLE IF EXISTS player_stats_history;
DROP TABLE IF EXISTS player_stats CASCADE;
DROP FUNCTION IF EXISTS update_player_stats_updated_at();

COMMENT ON SCHEMA public IS
  'Dead player_stats cache removed 2026-04-25. Card-stat ratings live in player_rating_snapshots.';
```

- [ ] **Step 2: Apply via Supabase MCP**

`mcp__plugin_supabase_supabase__apply_migration` with `name: drop_dead_player_stats` and the SQL above.

- [ ] **Step 3: Verify**

```sql
SELECT table_name FROM information_schema.tables
WHERE table_name IN ('player_stats', 'player_stats_history')
  AND table_schema = 'public';
```

Expected: zero rows.

### Task 5.2: Regenerate types and remove dead TS exports

**Files:**
- Modify: `src/types/database.ts` (regenerate)
- Modify: `src/lib/assessment-to-rating.ts` (remove unused exports)
- Delete or hollow: `src/components/dashboard/RatingMigrationBanner.tsx`
- Modify: `src/app/dashboard/page.tsx` (remove banner import + usage)

- [ ] **Step 1: Regenerate types**

`mcp__plugin_supabase_supabase__generate_typescript_types` → save to `src/types/database.ts`. The `player_stats` / `player_stats_history` entries should now be gone.

- [ ] **Step 2: Identify and remove unused exports**

Run: `grep -rn "calculateNeutralRatings\|calculateCardRatingsAbsolute" src --include="*.ts" --include="*.tsx" | grep -v "assessment-to-rating.ts"`

If there are zero results: remove the exports from `src/lib/assessment-to-rating.ts`.

If there are usages: keep them.

- [ ] **Step 3: Remove the banner**

Delete `src/components/dashboard/RatingMigrationBanner.tsx`. Remove its import and usage from `src/app/dashboard/page.tsx`.

- [ ] **Step 4: Verify typecheck and tests**

Run: `npx tsc --noEmit && npm run test:run && npm run build 2>&1 | tail -5`

Expected: clean typecheck, all tests passing, successful build.

- [ ] **Step 5: Commit Phase 5**

```bash
git add supabase/migrations/20260425120200_drop_dead_player_stats.sql \
        src/types/database.ts \
        src/lib/assessment-to-rating.ts \
        src/app/dashboard/page.tsx
git rm src/components/dashboard/RatingMigrationBanner.tsx
git commit -m "$(cat <<'EOF'
chore(player-data): cleanup orphan tables + retire migration banner (phase 5)

- Drop empty player_stats and player_stats_history tables and the
  update_player_stats_updated_at trigger function.
- Regenerate src/types/database.ts to drop the dead PlayerStats* types.
- Remove the one-week post-cutover Hebrew banner.
- Remove unused TS exports if no callers remain after Phase 4.
EOF
)"
```

- [ ] **Step 6: Deploy**

Run: `vercel --prod`

Final smoke: confirm the banner is gone from the dashboard, charts still render, no console errors.

---

## Self-review notes

I checked this plan against the spec sections:

- **Subsystems table** (spec §Subsystems) → Implemented across phases 1-4. The five-subsystem split is preserved: truth (untouched), cohort (untouched), derived (new snapshot table + write-time computation), engagement (re-created `user_achievements` + TS-owned grants), reads (cutover in Phase 4).
- **Snapshot table schema** (spec §The snapshot table) → Task 1.1 exact match.
- **Write path** (spec §Write path) → Tasks 3.1, 3.2 (single server action + form migration), 3.3 (cron orphan-catcher).
- **Engagement: badges architecture** (spec §Engagement: badges architecture) → Task 1.2 (table + ENUM + RLS), Tasks 2.5, 2.6 (helpers), Task 3.1 (called from `recordAssessment`).
- **Migration plan** (spec §Migration plan — five independent phases) → 5 phases with sequential commits, each with rollback by `git revert` plus `DROP TABLE` for schema.
- **Testing** (spec §Testing) → Tasks 2.1-2.4 cover the unit tests; manual smoke called out at Tasks 3.2.5, 3.3.6, 4.3.5.
- **Files affected** (spec §Files affected) → Mapped to the file-map at the top of this plan.
- **Out of scope** (spec §Out of scope) → Honored: no new test types, no multi-academy work, no goal-completion badges, no card_type derivation. Streak/goal/onboarding badges are NOT granted by `chooseAssessmentBadges` (it only handles assessment-derived badges).

No placeholders found on second pass. No "TODO" / "TBD" / "fill in later". Function and type names are consistent across tasks (`recordAssessment`, `updateAssessment`, `writeRatingSnapshot`, `composeSnapshot`, `chooseAssessmentBadges`, `grantBadge`, `grantAssessmentBadges`).
