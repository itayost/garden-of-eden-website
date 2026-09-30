-- Staff-set age group.
--
-- A trainee who trains with a younger or older group is ranked and rated with
-- it until his next birthday (age_group_override_until, set by the server
-- action), then goes back to the group of his age. effective_age_group() is
-- the database side of resolveAgeGroup() in src/lib/age-group-override.ts.
-- The benchmarks and both of their triggers now use it; the nightly
-- benchmarks cron moves a trainee back on the end date.

ALTER TABLE public.profiles
  ADD COLUMN age_group_override text,
  ADD COLUMN age_group_override_until date,
  ADD CONSTRAINT profiles_age_group_override_check
    CHECK (age_group_override IS NULL OR age_group_override IN ('u10', 'u12', 'u15', 'u18', 'senior')),
  ADD CONSTRAINT profiles_age_group_override_pair_check
    CHECK ((age_group_override IS NULL) = (age_group_override_until IS NULL));

CREATE OR REPLACE FUNCTION public.effective_age_group(
  p_birthdate date,
  p_override text,
  p_until date
)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN p_override IS NOT NULL AND p_until IS NOT NULL AND CURRENT_DATE < p_until THEN p_override
    ELSE compute_age_group(p_birthdate)
  END
$$;

-- ===========================================
-- Trainees cannot set their own group
-- ===========================================
CREATE OR REPLACE FUNCTION public.enforce_profile_column_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  IF get_user_role(auth.uid()) = 'admin' THEN
    RETURN NEW;
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'role cannot be changed by its owner';
  END IF;
  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    RAISE EXCEPTION 'is_active cannot be changed by its owner';
  END IF;
  IF NEW.nutrition_appointment_status IS DISTINCT FROM OLD.nutrition_appointment_status THEN
    RAISE EXCEPTION 'nutrition_appointment_status cannot be changed by its owner';
  END IF;
  IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN
    RAISE EXCEPTION 'deleted_at cannot be changed by its owner';
  END IF;
  IF NEW.arbox_user_id IS DISTINCT FROM OLD.arbox_user_id THEN
    RAISE EXCEPTION 'arbox_user_id cannot be changed by its owner';
  END IF;
  IF NEW.arbox_paid_training IS DISTINCT FROM OLD.arbox_paid_training THEN
    RAISE EXCEPTION 'arbox_paid_training cannot be changed by its owner';
  END IF;
  IF NEW.arbox_bought_course IS DISTINCT FROM OLD.arbox_bought_course THEN
    RAISE EXCEPTION 'arbox_bought_course cannot be changed by its owner';
  END IF;
  IF NEW.access_override IS DISTINCT FROM OLD.access_override THEN
    RAISE EXCEPTION 'access_override cannot be changed by its owner';
  END IF;
  IF NEW.branches_set_by_admin_at IS DISTINCT FROM OLD.branches_set_by_admin_at THEN
    RAISE EXCEPTION 'branches_set_by_admin_at cannot be changed by its owner';
  END IF;
  -- Who gets billed and what the parent consented to are the parent's
  -- decisions, recorded on the signed agreement; the child cannot move them.
  IF NEW.guardian_name IS DISTINCT FROM OLD.guardian_name THEN
    RAISE EXCEPTION 'guardian_name cannot be changed by its owner';
  END IF;
  IF NEW.guardian_phone IS DISTINCT FROM OLD.guardian_phone THEN
    RAISE EXCEPTION 'guardian_phone cannot be changed by its owner';
  END IF;
  IF NEW.medical_notes IS DISTINCT FROM OLD.medical_notes THEN
    RAISE EXCEPTION 'medical_notes cannot be changed by its owner';
  END IF;
  IF NEW.emergency_contact_name IS DISTINCT FROM OLD.emergency_contact_name THEN
    RAISE EXCEPTION 'emergency_contact_name cannot be changed by its owner';
  END IF;
  IF NEW.emergency_contact_phone IS DISTINCT FROM OLD.emergency_contact_phone THEN
    RAISE EXCEPTION 'emergency_contact_phone cannot be changed by its owner';
  END IF;
  IF NEW.photo_consent IS DISTINCT FROM OLD.photo_consent THEN
    RAISE EXCEPTION 'photo_consent cannot be changed by its owner';
  END IF;

  -- Which group a trainee is ranked and rated in is a staff decision.
  IF NEW.age_group_override IS DISTINCT FROM OLD.age_group_override THEN
    RAISE EXCEPTION 'age_group_override cannot be changed by its owner';
  END IF;
  IF NEW.age_group_override_until IS DISTINCT FROM OLD.age_group_override_until THEN
    RAISE EXCEPTION 'age_group_override_until cannot be changed by its owner';
  END IF;

  RETURN NEW;
END;
$function$;

-- ===========================================
-- Benchmarks group trainees by their effective group
-- ===========================================
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
    MAX(pb.sprint_10m_h_ball) as sprint_10m_h_ball_worst
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
      MIN(pa.sprint_10m_h_ball) as sprint_10m_h_ball
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
    player_count = COALESCE(v_result.player_count, 0),
    updated_at = NOW()
  WHERE age_group = p_age_group;
END;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_recalculate_benchmarks()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_age_group text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_user_id := OLD.user_id;
  ELSE
    v_user_id := NEW.user_id;
  END IF;

  SELECT effective_age_group(p.birthdate, p.age_group_override, p.age_group_override_until)
  INTO v_age_group
  FROM profiles p
  WHERE p.id = v_user_id;

  IF v_age_group IS NOT NULL THEN
    PERFORM recalculate_age_group_benchmarks(v_age_group);
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_recalculate_benchmarks_on_profile_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_age_group text;
  v_new_age_group text;
BEGIN
  v_old_age_group := effective_age_group(OLD.birthdate, OLD.age_group_override, OLD.age_group_override_until);
  v_new_age_group := effective_age_group(NEW.birthdate, NEW.age_group_override, NEW.age_group_override_until);

  IF v_old_age_group IS DISTINCT FROM v_new_age_group
     OR OLD.role IS DISTINCT FROM NEW.role THEN
    IF v_old_age_group IS NOT NULL THEN
      PERFORM recalculate_age_group_benchmarks(v_old_age_group);
    END IF;
    IF v_new_age_group IS NOT NULL AND v_new_age_group IS DISTINCT FROM v_old_age_group THEN
      PERFORM recalculate_age_group_benchmarks(v_new_age_group);
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- The override columns now move a trainee between groups too.
DROP TRIGGER recalc_benchmarks_on_profile_change ON public.profiles;
CREATE TRIGGER recalc_benchmarks_on_profile_change
  AFTER UPDATE OF birthdate, role, age_group_override, age_group_override_until ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION trigger_recalculate_benchmarks_on_profile_change();
