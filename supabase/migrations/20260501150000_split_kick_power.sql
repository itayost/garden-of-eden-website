-- Split kick power into right-foot, left-foot, and machine % per assessment.
-- Legacy column kick_power_kaiser is retained for one release; a sync trigger
-- mirrors values in both directions so existing import scripts keep working.

-- =====================================================
-- 1. New columns on player_assessments
-- =====================================================
ALTER TABLE player_assessments
  ADD COLUMN IF NOT EXISTS kick_power_right_foot   DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS kick_power_left_foot    DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS kick_power_machine_pct  DECIMAL(5,2);

-- Backfill: legacy single value is treated as right foot.
UPDATE player_assessments
SET kick_power_right_foot = kick_power_kaiser
WHERE kick_power_kaiser IS NOT NULL
  AND kick_power_right_foot IS NULL;

-- =====================================================
-- 2. Sync trigger: keep legacy column and right_foot in lockstep so
--    imports that still write kick_power_kaiser continue to populate the
--    new column, and the legacy benchmarks/snapshots stay valid.
-- =====================================================
CREATE OR REPLACE FUNCTION sync_legacy_kick_power_kaiser()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.kick_power_kaiser IS NOT NULL AND NEW.kick_power_right_foot IS NULL THEN
    NEW.kick_power_right_foot := NEW.kick_power_kaiser;
  ELSIF NEW.kick_power_right_foot IS NOT NULL AND NEW.kick_power_kaiser IS NULL THEN
    NEW.kick_power_kaiser := NEW.kick_power_right_foot;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_legacy_kick_power_kaiser_trg ON player_assessments;
CREATE TRIGGER sync_legacy_kick_power_kaiser_trg
  BEFORE INSERT OR UPDATE ON player_assessments
  FOR EACH ROW
  EXECUTE FUNCTION sync_legacy_kick_power_kaiser();

-- =====================================================
-- 3. New benchmark columns and recompute function update
-- =====================================================
ALTER TABLE age_group_benchmarks
  ADD COLUMN IF NOT EXISTS kick_power_right_foot_best  DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS kick_power_right_foot_worst DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS kick_power_left_foot_best   DECIMAL(5,2),
  ADD COLUMN IF NOT EXISTS kick_power_left_foot_worst  DECIMAL(5,2);

CREATE OR REPLACE FUNCTION recalculate_age_group_benchmarks(p_age_group TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result RECORD;
BEGIN
  SELECT
    COUNT(*)::INTEGER as player_count,
    MIN(pb.sprint_5m) as sprint_5m_best,
    MAX(pb.sprint_5m) as sprint_5m_worst,
    MIN(pb.sprint_10m) as sprint_10m_best,
    MAX(pb.sprint_10m) as sprint_10m_worst,
    MIN(pb.sprint_20m) as sprint_20m_best,
    MAX(pb.sprint_20m) as sprint_20m_worst,
    MAX(pb.jump_2leg_distance) as jump_2leg_distance_best,
    MIN(pb.jump_2leg_distance) as jump_2leg_distance_worst,
    MAX(pb.jump_right_leg) as jump_right_leg_best,
    MIN(pb.jump_right_leg) as jump_right_leg_worst,
    MAX(pb.jump_left_leg) as jump_left_leg_best,
    MIN(pb.jump_left_leg) as jump_left_leg_worst,
    MAX(pb.jump_2leg_height) as jump_2leg_height_best,
    MIN(pb.jump_2leg_height) as jump_2leg_height_worst,
    MAX(pb.blaze_spot_time) as blaze_spot_time_best,
    MIN(pb.blaze_spot_time) as blaze_spot_time_worst,
    MAX(pb.flexibility_ankle) as flexibility_ankle_best,
    MIN(pb.flexibility_ankle) as flexibility_ankle_worst,
    MAX(pb.flexibility_knee) as flexibility_knee_best,
    MIN(pb.flexibility_knee) as flexibility_knee_worst,
    MAX(pb.flexibility_hip) as flexibility_hip_best,
    MIN(pb.flexibility_hip) as flexibility_hip_worst,
    MAX(pb.kick_power_kaiser) as kick_power_kaiser_best,
    MIN(pb.kick_power_kaiser) as kick_power_kaiser_worst,
    MAX(pb.kick_power_right_foot) as kick_power_right_foot_best,
    MIN(pb.kick_power_right_foot) as kick_power_right_foot_worst,
    MAX(pb.kick_power_left_foot) as kick_power_left_foot_best,
    MIN(pb.kick_power_left_foot) as kick_power_left_foot_worst
  INTO v_result
  FROM (
    SELECT
      pa.user_id,
      MIN(pa.sprint_5m) as sprint_5m,
      MIN(pa.sprint_10m) as sprint_10m,
      MIN(pa.sprint_20m) as sprint_20m,
      MAX(pa.jump_2leg_distance) as jump_2leg_distance,
      MAX(pa.jump_right_leg) as jump_right_leg,
      MAX(pa.jump_left_leg) as jump_left_leg,
      MAX(pa.jump_2leg_height) as jump_2leg_height,
      MAX(pa.blaze_spot_time) as blaze_spot_time,
      MAX(pa.flexibility_ankle) as flexibility_ankle,
      MAX(pa.flexibility_knee) as flexibility_knee,
      MAX(pa.flexibility_hip) as flexibility_hip,
      MAX(pa.kick_power_kaiser) as kick_power_kaiser,
      MAX(pa.kick_power_right_foot) as kick_power_right_foot,
      MAX(pa.kick_power_left_foot) as kick_power_left_foot
    FROM player_assessments pa
    JOIN profiles p ON pa.user_id = p.id
    WHERE pa.deleted_at IS NULL
      AND p.role = 'trainee'
      AND compute_age_group(p.birthdate) = p_age_group
    GROUP BY pa.user_id
  ) pb;

  UPDATE age_group_benchmarks SET
    sprint_5m_best = v_result.sprint_5m_best,
    sprint_5m_worst = v_result.sprint_5m_worst,
    sprint_10m_best = v_result.sprint_10m_best,
    sprint_10m_worst = v_result.sprint_10m_worst,
    sprint_20m_best = v_result.sprint_20m_best,
    sprint_20m_worst = v_result.sprint_20m_worst,
    jump_2leg_distance_best = v_result.jump_2leg_distance_best,
    jump_2leg_distance_worst = v_result.jump_2leg_distance_worst,
    jump_right_leg_best = v_result.jump_right_leg_best,
    jump_right_leg_worst = v_result.jump_right_leg_worst,
    jump_left_leg_best = v_result.jump_left_leg_best,
    jump_left_leg_worst = v_result.jump_left_leg_worst,
    jump_2leg_height_best = v_result.jump_2leg_height_best,
    jump_2leg_height_worst = v_result.jump_2leg_height_worst,
    blaze_spot_time_best = v_result.blaze_spot_time_best,
    blaze_spot_time_worst = v_result.blaze_spot_time_worst,
    flexibility_ankle_best = v_result.flexibility_ankle_best,
    flexibility_ankle_worst = v_result.flexibility_ankle_worst,
    flexibility_knee_best = v_result.flexibility_knee_best,
    flexibility_knee_worst = v_result.flexibility_knee_worst,
    flexibility_hip_best = v_result.flexibility_hip_best,
    flexibility_hip_worst = v_result.flexibility_hip_worst,
    kick_power_kaiser_best = v_result.kick_power_kaiser_best,
    kick_power_kaiser_worst = v_result.kick_power_kaiser_worst,
    kick_power_right_foot_best = v_result.kick_power_right_foot_best,
    kick_power_right_foot_worst = v_result.kick_power_right_foot_worst,
    kick_power_left_foot_best = v_result.kick_power_left_foot_best,
    kick_power_left_foot_worst = v_result.kick_power_left_foot_worst,
    player_count = COALESCE(v_result.player_count, 0),
    updated_at = NOW()
  WHERE age_group = p_age_group;
END;
$$;

-- Recompute all groups so the new benchmark columns are populated immediately.
SELECT recalculate_age_group_benchmarks('u10');
SELECT recalculate_age_group_benchmarks('u12');
SELECT recalculate_age_group_benchmarks('u15');
SELECT recalculate_age_group_benchmarks('u18');
SELECT recalculate_age_group_benchmarks('senior');

-- =====================================================
-- 4. Goals: extend metric_key CHECK and trigger CASE
-- =====================================================

-- Drop the auto-named CHECK and recreate with the two new metric keys.
DO $$
DECLARE
  v_constraint_name TEXT;
BEGIN
  SELECT conname INTO v_constraint_name
  FROM pg_constraint
  WHERE conrelid = 'player_goals'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%metric_key%';
  IF v_constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE player_goals DROP CONSTRAINT %I', v_constraint_name);
  END IF;
END;
$$;

ALTER TABLE player_goals
  ADD CONSTRAINT player_goals_metric_key_check CHECK (
    metric_key IN (
      'sprint_5m', 'sprint_10m', 'sprint_20m',
      'jump_2leg_distance', 'jump_2leg_height', 'jump_right_leg', 'jump_left_leg',
      'blaze_spot_time',
      'flexibility_ankle', 'flexibility_knee', 'flexibility_hip',
      'kick_power_kaiser',
      'kick_power_right_foot', 'kick_power_left_foot'
    )
  );

-- Existing kick_power_kaiser goals → right foot (per migration backfill convention).
UPDATE player_goals
SET metric_key = 'kick_power_right_foot'
WHERE metric_key = 'kick_power_kaiser';

-- Replace the goals trigger function so the two new keys resolve.
CREATE OR REPLACE FUNCTION check_goal_achievements_after_assessment()
RETURNS TRIGGER AS $$
DECLARE
  goal_record RECORD;
  metric_value DECIMAL;
  goal_achieved BOOLEAN;
  is_improvement BOOLEAN;
BEGIN
  FOR goal_record IN
    SELECT * FROM player_goals
    WHERE user_id = NEW.user_id
    AND achieved_at IS NULL
    FOR UPDATE
  LOOP
    metric_value := NULL;
    CASE goal_record.metric_key
      WHEN 'sprint_5m' THEN metric_value := NEW.sprint_5m;
      WHEN 'sprint_10m' THEN metric_value := NEW.sprint_10m;
      WHEN 'sprint_20m' THEN metric_value := NEW.sprint_20m;
      WHEN 'jump_2leg_distance' THEN metric_value := NEW.jump_2leg_distance;
      WHEN 'jump_2leg_height' THEN metric_value := NEW.jump_2leg_height;
      WHEN 'jump_right_leg' THEN metric_value := NEW.jump_right_leg;
      WHEN 'jump_left_leg' THEN metric_value := NEW.jump_left_leg;
      WHEN 'blaze_spot_time' THEN metric_value := NEW.blaze_spot_time;
      WHEN 'flexibility_ankle' THEN metric_value := NEW.flexibility_ankle;
      WHEN 'flexibility_knee' THEN metric_value := NEW.flexibility_knee;
      WHEN 'flexibility_hip' THEN metric_value := NEW.flexibility_hip;
      WHEN 'kick_power_kaiser' THEN metric_value := NEW.kick_power_kaiser;
      WHEN 'kick_power_right_foot' THEN metric_value := NEW.kick_power_right_foot;
      WHEN 'kick_power_left_foot' THEN metric_value := NEW.kick_power_left_foot;
    END CASE;

    IF metric_value IS NULL THEN
      CONTINUE;
    END IF;

    is_improvement := FALSE;
    IF goal_record.current_value IS NULL THEN
      is_improvement := TRUE;
    ELSIF goal_record.is_lower_better AND metric_value < goal_record.current_value THEN
      is_improvement := TRUE;
    ELSIF NOT goal_record.is_lower_better AND metric_value > goal_record.current_value THEN
      is_improvement := TRUE;
    END IF;

    IF is_improvement THEN
      UPDATE player_goals
      SET current_value = metric_value, updated_at = NOW()
      WHERE id = goal_record.id;
    END IF;

    goal_achieved := is_goal_achieved(
      metric_value,
      goal_record.target_value,
      goal_record.is_lower_better
    );

    IF goal_achieved THEN
      UPDATE player_goals
      SET
        achieved_at = NOW(),
        achieved_value = metric_value,
        current_value = metric_value,
        updated_at = NOW()
      WHERE id = goal_record.id;
    END IF;

  END LOOP;

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'Goal achievement check failed for user %: %', NEW.user_id, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
