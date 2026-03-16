-- Age Group Benchmarks: Pre-computed GroupStats for EA FC rating system
-- Replaces the expensive per-consumer pipeline of fetching all profiles + assessments

-- ===========================================
-- SQL FUNCTION: compute_age_group
-- ===========================================
-- Replicates TypeScript getAgeGroup() from src/types/assessment.ts
-- Age groups: u10 (0-10), u12 (10-12), u15 (12-15), u18 (15-18), senior (18-99)

CREATE OR REPLACE FUNCTION compute_age_group(p_birthdate DATE)
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN p_birthdate IS NULL THEN NULL
    WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, p_birthdate)) < 10 THEN 'u10'
    WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, p_birthdate)) < 12 THEN 'u12'
    WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, p_birthdate)) < 15 THEN 'u15'
    WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, p_birthdate)) < 18 THEN 'u18'
    ELSE 'senior'
  END
$$;

-- ===========================================
-- TABLE: age_group_benchmarks
-- ===========================================
-- Stores best/worst personal-best values per metric per age group.
-- Updated by trigger on player_assessments and profiles changes.

CREATE TABLE IF NOT EXISTS age_group_benchmarks (
  age_group TEXT PRIMARY KEY,

  -- Sprint metrics (DECIMAL(5,3) - lower is better)
  sprint_5m_best DECIMAL(5,3),
  sprint_5m_worst DECIMAL(5,3),
  sprint_10m_best DECIMAL(5,3),
  sprint_10m_worst DECIMAL(5,3),
  sprint_20m_best DECIMAL(5,3),
  sprint_20m_worst DECIMAL(5,3),

  -- Jump metrics (DECIMAL(5,1) - higher is better)
  jump_2leg_distance_best DECIMAL(5,1),
  jump_2leg_distance_worst DECIMAL(5,1),
  jump_right_leg_best DECIMAL(5,1),
  jump_right_leg_worst DECIMAL(5,1),
  jump_left_leg_best DECIMAL(5,1),
  jump_left_leg_worst DECIMAL(5,1),
  jump_2leg_height_best DECIMAL(5,1),
  jump_2leg_height_worst DECIMAL(5,1),

  -- Blaze spot (DECIMAL(5,2) - higher is better)
  blaze_spot_time_best DECIMAL(5,2),
  blaze_spot_time_worst DECIMAL(5,2),

  -- Flexibility (DECIMAL(4,1) - higher is better)
  flexibility_ankle_best DECIMAL(4,1),
  flexibility_ankle_worst DECIMAL(4,1),
  flexibility_knee_best DECIMAL(4,1),
  flexibility_knee_worst DECIMAL(4,1),
  flexibility_hip_best DECIMAL(4,1),
  flexibility_hip_worst DECIMAL(4,1),

  -- Kick power (DECIMAL(5,2) - higher is better)
  kick_power_kaiser_best DECIMAL(5,2),
  kick_power_kaiser_worst DECIMAL(5,2),

  -- Metadata
  player_count INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Pre-seed all 5 age group rows
INSERT INTO age_group_benchmarks (age_group) VALUES
  ('u10'), ('u12'), ('u15'), ('u18'), ('senior')
ON CONFLICT (age_group) DO NOTHING;

-- ===========================================
-- RLS: authenticated can SELECT, triggers handle writes
-- ===========================================
ALTER TABLE age_group_benchmarks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read benchmarks"
  ON age_group_benchmarks
  FOR SELECT
  TO authenticated
  USING (true);

-- ===========================================
-- FUNCTION: recalculate_age_group_benchmarks
-- ===========================================
-- Two-level aggregation using personal best per metric per user.
-- Level 1: For each user, find their personal best per metric across ALL assessments.
-- Level 2: Across all users' personal bests, find group best and worst.

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
    -- Sprints: lower is better
    -- Personal best = MIN per user (level 1), group best = MIN of those (level 2)
    MIN(pb.sprint_5m) as sprint_5m_best,
    MAX(pb.sprint_5m) as sprint_5m_worst,
    MIN(pb.sprint_10m) as sprint_10m_best,
    MAX(pb.sprint_10m) as sprint_10m_worst,
    MIN(pb.sprint_20m) as sprint_20m_best,
    MAX(pb.sprint_20m) as sprint_20m_worst,
    -- Jumps: higher is better
    -- Personal best = MAX per user (level 1), group best = MAX of those (level 2)
    MAX(pb.jump_2leg_distance) as jump_2leg_distance_best,
    MIN(pb.jump_2leg_distance) as jump_2leg_distance_worst,
    MAX(pb.jump_right_leg) as jump_right_leg_best,
    MIN(pb.jump_right_leg) as jump_right_leg_worst,
    MAX(pb.jump_left_leg) as jump_left_leg_best,
    MIN(pb.jump_left_leg) as jump_left_leg_worst,
    MAX(pb.jump_2leg_height) as jump_2leg_height_best,
    MIN(pb.jump_2leg_height) as jump_2leg_height_worst,
    -- Blaze spot: higher is better
    MAX(pb.blaze_spot_time) as blaze_spot_time_best,
    MIN(pb.blaze_spot_time) as blaze_spot_time_worst,
    -- Flexibility: higher is better
    MAX(pb.flexibility_ankle) as flexibility_ankle_best,
    MIN(pb.flexibility_ankle) as flexibility_ankle_worst,
    MAX(pb.flexibility_knee) as flexibility_knee_best,
    MIN(pb.flexibility_knee) as flexibility_knee_worst,
    MAX(pb.flexibility_hip) as flexibility_hip_best,
    MIN(pb.flexibility_hip) as flexibility_hip_worst,
    -- Kick power: higher is better
    MAX(pb.kick_power_kaiser) as kick_power_kaiser_best,
    MIN(pb.kick_power_kaiser) as kick_power_kaiser_worst
  INTO v_result
  FROM (
    -- Level 1: Personal best per metric per user
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
      MAX(pa.kick_power_kaiser) as kick_power_kaiser
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
    player_count = COALESCE(v_result.player_count, 0),
    updated_at = NOW()
  WHERE age_group = p_age_group;
END;
$$;

-- ===========================================
-- TRIGGER: on player_assessments changes
-- ===========================================

CREATE OR REPLACE FUNCTION trigger_recalculate_benchmarks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_age_group TEXT;
BEGIN
  -- Determine affected user_id
  IF TG_OP = 'DELETE' THEN
    v_user_id := OLD.user_id;
  ELSE
    v_user_id := NEW.user_id;
  END IF;

  -- Look up this user's age group
  SELECT compute_age_group(p.birthdate)
  INTO v_age_group
  FROM profiles p
  WHERE p.id = v_user_id;

  -- Recalculate benchmarks for the affected age group
  IF v_age_group IS NOT NULL THEN
    PERFORM recalculate_age_group_benchmarks(v_age_group);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER recalc_benchmarks_on_assessment_change
  AFTER INSERT OR UPDATE OR DELETE ON player_assessments
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalculate_benchmarks();

-- ===========================================
-- TRIGGER: on profiles birthdate/role changes
-- ===========================================

CREATE OR REPLACE FUNCTION trigger_recalculate_benchmarks_on_profile_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_age_group TEXT;
  v_new_age_group TEXT;
BEGIN
  v_old_age_group := compute_age_group(OLD.birthdate);
  v_new_age_group := compute_age_group(NEW.birthdate);

  -- If age group changed (birthdate edit) or role changed
  IF v_old_age_group IS DISTINCT FROM v_new_age_group
     OR OLD.role IS DISTINCT FROM NEW.role THEN
    -- Recalculate old group if it existed
    IF v_old_age_group IS NOT NULL THEN
      PERFORM recalculate_age_group_benchmarks(v_old_age_group);
    END IF;
    -- Recalculate new group if it exists and is different
    IF v_new_age_group IS NOT NULL AND v_new_age_group IS DISTINCT FROM v_old_age_group THEN
      PERFORM recalculate_age_group_benchmarks(v_new_age_group);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER recalc_benchmarks_on_profile_change
  AFTER UPDATE OF birthdate, role ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalculate_benchmarks_on_profile_change();

-- ===========================================
-- BACKFILL: Calculate benchmarks for all groups
-- ===========================================

SELECT recalculate_age_group_benchmarks('u10');
SELECT recalculate_age_group_benchmarks('u12');
SELECT recalculate_age_group_benchmarks('u15');
SELECT recalculate_age_group_benchmarks('u18');
SELECT recalculate_age_group_benchmarks('senior');
