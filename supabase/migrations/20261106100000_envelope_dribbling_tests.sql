-- Two timed envelope tests join the dribbling tests (seconds, lower is better).
-- With the three tests added on 2026-09-29 they are the numeric inputs to the
-- Dribbling card stat (CARD_STAT_CONFIG, application code).
--   envelope        מבדק מעטפה
--   envelope_ball   מעטפה עם כדור
-- Additive only: existing rows, rating snapshots and goals are untouched, and
-- no saved rating is recomputed.
--
-- Expand only, and it must be applied BEFORE the code deploys: the new code
-- inserts and selects the new columns. The code running today never names
-- them. Safe to run twice.

SET LOCAL lock_timeout = '3s';

-- =====================================================
-- 1. New columns on player_assessments
-- =====================================================
ALTER TABLE public.player_assessments
  ADD COLUMN IF NOT EXISTS envelope      DECIMAL(5,3),
  ADD COLUMN IF NOT EXISTS envelope_ball DECIMAL(5,3);

-- An envelope run takes longer than the 10 m tests, so the cap is 60 seconds.
ALTER TABLE public.player_assessments
  DROP CONSTRAINT IF EXISTS player_assessments_envelope_check,
  DROP CONSTRAINT IF EXISTS player_assessments_envelope_ball_check;
ALTER TABLE public.player_assessments
  ADD CONSTRAINT player_assessments_envelope_check
    CHECK (envelope IS NULL OR (envelope > 0 AND envelope <= 60)),
  ADD CONSTRAINT player_assessments_envelope_ball_check
    CHECK (envelope_ball IS NULL OR (envelope_ball > 0 AND envelope_ball <= 60));

COMMENT ON COLUMN public.player_assessments.envelope IS 'מבדק מעטפה, seconds, lower is better';
COMMENT ON COLUMN public.player_assessments.envelope_ball IS 'מעטפה עם כדור, seconds, lower is better';

-- =====================================================
-- 2. Benchmark columns and recompute function
-- =====================================================
-- *_players counts the trainees in the age group with a result. The card
-- leaves an envelope test out until 5 have one (NEW_TEST_MIN_PLAYERS in
-- src/lib/assessment-to-rating.ts): the first results would otherwise be the
-- group's best and worst and rate 99 or 30 on noise.
ALTER TABLE public.age_group_benchmarks
  ADD COLUMN IF NOT EXISTS envelope_best         DECIMAL(5,3),
  ADD COLUMN IF NOT EXISTS envelope_worst        DECIMAL(5,3),
  ADD COLUMN IF NOT EXISTS envelope_players      INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS envelope_ball_best    DECIMAL(5,3),
  ADD COLUMN IF NOT EXISTS envelope_ball_worst   DECIMAL(5,3),
  ADD COLUMN IF NOT EXISTS envelope_ball_players INTEGER NOT NULL DEFAULT 0;

-- Same function as 20260930170000_age_group_override, plus the two tests.
CREATE OR REPLACE FUNCTION public.recalculate_age_group_benchmarks(p_age_group text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    MIN(pb.kick_power_left_foot) as kick_power_left_foot_worst,
    MIN(pb.shuffle_10m) as shuffle_10m_best,
    MAX(pb.shuffle_10m) as shuffle_10m_worst,
    MIN(pb.sprint_10m_h) as sprint_10m_h_best,
    MAX(pb.sprint_10m_h) as sprint_10m_h_worst,
    MIN(pb.sprint_10m_h_ball) as sprint_10m_h_ball_best,
    MAX(pb.sprint_10m_h_ball) as sprint_10m_h_ball_worst,
    MIN(pb.envelope) as envelope_best,
    MAX(pb.envelope) as envelope_worst,
    COUNT(pb.envelope)::INTEGER as envelope_players,
    MIN(pb.envelope_ball) as envelope_ball_best,
    MAX(pb.envelope_ball) as envelope_ball_worst,
    COUNT(pb.envelope_ball)::INTEGER as envelope_ball_players
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
      MAX(pa.kick_power_left_foot) as kick_power_left_foot,
      MIN(pa.shuffle_10m) as shuffle_10m,
      MIN(pa.sprint_10m_h) as sprint_10m_h,
      MIN(pa.sprint_10m_h_ball) as sprint_10m_h_ball,
      MIN(pa.envelope) as envelope,
      MIN(pa.envelope_ball) as envelope_ball
    FROM player_assessments pa
    JOIN profiles p ON pa.user_id = p.id
    WHERE pa.deleted_at IS NULL
      AND p.role = 'trainee'
      AND effective_age_group(p.birthdate, p.age_group_override, p.age_group_override_until) = p_age_group
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
    shuffle_10m_best = v_result.shuffle_10m_best,
    shuffle_10m_worst = v_result.shuffle_10m_worst,
    sprint_10m_h_best = v_result.sprint_10m_h_best,
    sprint_10m_h_worst = v_result.sprint_10m_h_worst,
    sprint_10m_h_ball_best = v_result.sprint_10m_h_ball_best,
    sprint_10m_h_ball_worst = v_result.sprint_10m_h_ball_worst,
    envelope_best = v_result.envelope_best,
    envelope_worst = v_result.envelope_worst,
    envelope_players = COALESCE(v_result.envelope_players, 0),
    envelope_ball_best = v_result.envelope_ball_best,
    envelope_ball_worst = v_result.envelope_ball_worst,
    envelope_ball_players = COALESCE(v_result.envelope_ball_players, 0),
    player_count = COALESCE(v_result.player_count, 0),
    updated_at = NOW()
  WHERE age_group = p_age_group;
END;
$function$;

-- Keep the access set by 20260930190000_benchmark_function_access.
REVOKE EXECUTE ON FUNCTION public.recalculate_age_group_benchmarks(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.recalculate_age_group_benchmarks(text) TO service_role;

SELECT public.recalculate_age_group_benchmarks('u10');
SELECT public.recalculate_age_group_benchmarks('u12');
SELECT public.recalculate_age_group_benchmarks('u15');
SELECT public.recalculate_age_group_benchmarks('u18');
SELECT public.recalculate_age_group_benchmarks('senior');

-- =====================================================
-- 3. Goals: allow the new metric keys and resolve them in the trigger
-- =====================================================
ALTER TABLE public.player_goals DROP CONSTRAINT IF EXISTS player_goals_metric_key_check;
ALTER TABLE public.player_goals
  ADD CONSTRAINT player_goals_metric_key_check CHECK (
    metric_key IN (
      'sprint_5m', 'sprint_10m', 'sprint_20m',
      'jump_2leg_distance', 'jump_2leg_height', 'jump_right_leg', 'jump_left_leg',
      'blaze_spot_time',
      'flexibility_ankle', 'flexibility_knee', 'flexibility_hip',
      'kick_power_kaiser',
      'kick_power_right_foot', 'kick_power_left_foot',
      'shuffle_10m', 'sprint_10m_h', 'sprint_10m_h_ball',
      'envelope', 'envelope_ball'
    )
  );

-- Same function as 20260929120000_dribbling_tests, plus the two tests.
CREATE OR REPLACE FUNCTION public.check_goal_achievements_after_assessment()
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
      WHEN 'shuffle_10m' THEN metric_value := NEW.shuffle_10m;
      WHEN 'sprint_10m_h' THEN metric_value := NEW.sprint_10m_h;
      WHEN 'sprint_10m_h_ball' THEN metric_value := NEW.sprint_10m_h_ball;
      WHEN 'envelope' THEN metric_value := NEW.envelope;
      WHEN 'envelope_ball' THEN metric_value := NEW.envelope_ball;
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
