-- Assessment unit cleanup.
--
-- 1. Jumps typed in meters (0 < value < 10) become centimeters (x100), one
--    column at a time, since some rows mix meters and centimeters.
-- 2. Kick power 0 means "test not done" and becomes NULL.
-- 3. Jump goals that were set in meters (target < 10) are converted the same
--    way, so the goal check does not read 170 cm as beating a target of 2.0.
-- 4. compute_age_group() gives a birthdate in the future no group, matching
--    getAgeGroup() in src/types/assessment.ts.
--
-- Left alone on purpose, waiting for Eden: jumps of 10-80, jump height over
-- 100 (an older protocol), kick values of 3/5/7, and the slow sprints.
--
-- Every changed cell is copied to assessment_cleanup_backup first.
-- The goal and benchmark triggers are off while the rows change: the goal
-- check would compare old assessments against goals, and the benchmarks are
-- rebuilt once at the end instead of once per row. The file runs in one
-- transaction, so a failed check at the bottom undoes all of it.
-- Rating snapshots are frozen and are rescored afterwards with
-- scripts/rescore-rating-snapshots.ts.

-- ===========================================
-- Backup of every changed cell
-- ===========================================
CREATE TABLE public.assessment_cleanup_backup (
  source_table text NOT NULL,
  row_id uuid NOT NULL,
  column_name text NOT NULL,
  old_value numeric,
  new_value numeric,
  backed_up_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (source_table, row_id, column_name)
);
ALTER TABLE public.assessment_cleanup_backup ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.assessment_cleanup_backup FROM anon, authenticated;

-- Goals achieved before the cleanup; the check at the end compares against it.
CREATE TEMP TABLE cleanup_achieved_goals ON COMMIT DROP AS
  SELECT id FROM public.player_goals WHERE achieved_at IS NOT NULL;

-- ===========================================
-- 1. Jumps in meters -> centimeters
-- ===========================================
INSERT INTO public.assessment_cleanup_backup (source_table, row_id, column_name, old_value, new_value)
SELECT 'player_assessments', id, c.col, c.val, c.val * 100
FROM public.player_assessments,
  LATERAL (VALUES
    ('jump_2leg_distance', jump_2leg_distance),
    ('jump_right_leg', jump_right_leg),
    ('jump_left_leg', jump_left_leg)
  ) AS c(col, val)
WHERE c.val > 0 AND c.val < 10;

ALTER TABLE public.player_assessments DISABLE TRIGGER goals_after_assessment_update;
ALTER TABLE public.player_assessments DISABLE TRIGGER recalc_benchmarks_on_assessment_change;

UPDATE public.player_assessments SET
  jump_2leg_distance = CASE WHEN jump_2leg_distance > 0 AND jump_2leg_distance < 10
    THEN jump_2leg_distance * 100 ELSE jump_2leg_distance END,
  jump_right_leg = CASE WHEN jump_right_leg > 0 AND jump_right_leg < 10
    THEN jump_right_leg * 100 ELSE jump_right_leg END,
  jump_left_leg = CASE WHEN jump_left_leg > 0 AND jump_left_leg < 10
    THEN jump_left_leg * 100 ELSE jump_left_leg END
WHERE (jump_2leg_distance > 0 AND jump_2leg_distance < 10)
   OR (jump_right_leg > 0 AND jump_right_leg < 10)
   OR (jump_left_leg > 0 AND jump_left_leg < 10);

-- ===========================================
-- 2. Kick power 0 -> NULL
-- ===========================================
-- All three columns change in one statement: sync_legacy_kick_power_kaiser()
-- would copy a remaining 0 back into the column just cleared.
INSERT INTO public.assessment_cleanup_backup (source_table, row_id, column_name, old_value, new_value)
SELECT 'player_assessments', id, c.col, c.val, NULL
FROM public.player_assessments,
  LATERAL (VALUES
    ('kick_power_right_foot', kick_power_right_foot),
    ('kick_power_left_foot', kick_power_left_foot),
    ('kick_power_kaiser', kick_power_kaiser)
  ) AS c(col, val)
WHERE c.val = 0;

UPDATE public.player_assessments SET
  kick_power_right_foot = NULLIF(kick_power_right_foot, 0),
  kick_power_left_foot = NULLIF(kick_power_left_foot, 0),
  kick_power_kaiser = NULLIF(kick_power_kaiser, 0)
WHERE kick_power_right_foot = 0 OR kick_power_left_foot = 0 OR kick_power_kaiser = 0;

ALTER TABLE public.player_assessments ENABLE TRIGGER goals_after_assessment_update;
ALTER TABLE public.player_assessments ENABLE TRIGGER recalc_benchmarks_on_assessment_change;

-- ===========================================
-- 3. Jump goals set in meters -> centimeters
-- ===========================================
INSERT INTO public.assessment_cleanup_backup (source_table, row_id, column_name, old_value, new_value)
SELECT 'player_goals', id, c.col, c.val, c.val * 100
FROM public.player_goals,
  LATERAL (VALUES
    ('target_value', target_value),
    ('baseline_value', baseline_value),
    ('current_value', current_value),
    ('achieved_value', achieved_value)
  ) AS c(col, val)
WHERE metric_key IN ('jump_2leg_distance', 'jump_right_leg', 'jump_left_leg')
  AND target_value < 10
  AND c.val IS NOT NULL;

UPDATE public.player_goals SET
  target_value = target_value * 100,
  baseline_value = baseline_value * 100,
  current_value = current_value * 100,
  achieved_value = achieved_value * 100,
  updated_at = now()
WHERE metric_key IN ('jump_2leg_distance', 'jump_right_leg', 'jump_left_leg')
  AND target_value < 10;

-- ===========================================
-- 4. No age group for a birthdate in the future
-- ===========================================
CREATE OR REPLACE FUNCTION public.compute_age_group(p_birthdate date)
RETURNS text
LANGUAGE sql
STABLE
AS $$
  SELECT CASE
    WHEN p_birthdate IS NULL OR p_birthdate > CURRENT_DATE THEN NULL
    WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, p_birthdate)) < 10 THEN 'u10'
    WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, p_birthdate)) < 12 THEN 'u12'
    WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, p_birthdate)) < 15 THEN 'u15'
    WHEN EXTRACT(YEAR FROM AGE(CURRENT_DATE, p_birthdate)) < 18 THEN 'u18'
    ELSE 'senior'
  END
$$;

-- ===========================================
-- Checks: any failure rolls the whole file back
-- ===========================================
DO $$
DECLARE
  v_left integer;
BEGIN
  SELECT count(*) INTO v_left FROM public.player_assessments
  WHERE (jump_2leg_distance > 0 AND jump_2leg_distance < 10)
     OR (jump_right_leg > 0 AND jump_right_leg < 10)
     OR (jump_left_leg > 0 AND jump_left_leg < 10);
  IF v_left > 0 THEN
    RAISE EXCEPTION 'cleanup: % assessments still have a jump in meters', v_left;
  END IF;

  SELECT count(*) INTO v_left FROM public.player_assessments
  WHERE kick_power_right_foot = 0 OR kick_power_left_foot = 0 OR kick_power_kaiser = 0;
  IF v_left > 0 THEN
    RAISE EXCEPTION 'cleanup: % assessments still have a kick power of 0', v_left;
  END IF;

  SELECT count(*) INTO v_left FROM public.player_goals
  WHERE metric_key IN ('jump_2leg_distance', 'jump_right_leg', 'jump_left_leg')
    AND target_value < 10;
  IF v_left > 0 THEN
    RAISE EXCEPTION 'cleanup: % jump goals still have a target in meters', v_left;
  END IF;

  SELECT count(*) INTO v_left FROM public.player_goals g
  WHERE g.achieved_at IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM cleanup_achieved_goals a WHERE a.id = g.id);
  IF v_left > 0 THEN
    RAISE EXCEPTION 'cleanup: % goals were marked achieved by the cleanup', v_left;
  END IF;

  SELECT count(*) INTO v_left FROM public.assessment_cleanup_backup;
  RAISE NOTICE 'cleanup: % cells backed up to assessment_cleanup_backup', v_left;
END $$;

-- ===========================================
-- Rebuild every group's benchmarks once
-- ===========================================
SELECT public.recalculate_age_group_benchmarks('u10');
SELECT public.recalculate_age_group_benchmarks('u12');
SELECT public.recalculate_age_group_benchmarks('u15');
SELECT public.recalculate_age_group_benchmarks('u18');
SELECT public.recalculate_age_group_benchmarks('senior');
