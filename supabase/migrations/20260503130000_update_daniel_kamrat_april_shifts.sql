-- Update April 2026 shifts for דניאל קמרט
-- 1) Set 29.4 shift to 16:20-20:00 (delete-then-insert, idempotent)
-- 2) Extend 3.4 shift end time by +40 minutes
-- All April 2026 dates are post-DST (DST started 2026-03-27) -> UTC+3

DO $$
DECLARE
  v_trainer_id UUID;
  v_trainer_name TEXT;
  v_old_3rd_end TIMESTAMPTZ;
  v_old_29th_count INT;
  v_updated_rows INT;
BEGIN
  -- Find trainer by name
  SELECT id, full_name INTO v_trainer_id, v_trainer_name
  FROM profiles
  WHERE full_name ILIKE '%דניאל%קמרט%'
    AND role IN ('trainer', 'admin')
  LIMIT 1;

  -- Skip (not fail) when the trainer is absent: keeps `supabase db reset` and
  -- fresh environments working, where profiles is empty.
  IF v_trainer_id IS NULL THEN
    RAISE NOTICE 'Trainer דניאל קמרט not found - skipping (fresh environment)';
    RETURN;
  END IF;

  RAISE NOTICE 'Found trainer: % (id: %)', v_trainer_name, v_trainer_id;

  -- Already-applied sentinel: the 3.4 update below is RELATIVE (+40 minutes),
  -- so a re-run would compound it. The 29.4 replacement doubles as the marker
  -- of a completed run - skip everything when it is present.
  IF EXISTS (
    SELECT 1 FROM trainer_shifts
    WHERE trainer_id = v_trainer_id
      AND start_time = '2026-04-29 16:20:00+03'
      AND end_time = '2026-04-29 20:00:00+03'
  ) THEN
    RAISE NOTICE 'April 2026 update already applied - skipping';
    RETURN;
  END IF;

  -- Capture prior values for audit (before any destructive op)
  SELECT MAX(end_time) INTO v_old_3rd_end
  FROM trainer_shifts
  WHERE trainer_id = v_trainer_id
    AND start_time::date = DATE '2026-04-03';

  SELECT COUNT(*) INTO v_old_29th_count
  FROM trainer_shifts
  WHERE trainer_id = v_trainer_id
    AND start_time::date = DATE '2026-04-29';

  RAISE NOTICE '3.4 current end_time (max): %', v_old_3rd_end;
  RAISE NOTICE '29.4 existing shifts to be replaced: %', v_old_29th_count;

  -- (1) Replace 29.4 with 16:20-20:00
  DELETE FROM trainer_shifts
  WHERE trainer_id = v_trainer_id
    AND start_time::date = DATE '2026-04-29';

  INSERT INTO trainer_shifts (trainer_id, trainer_name, start_time, end_time) VALUES
    (v_trainer_id, v_trainer_name, '2026-04-29 16:20:00+03', '2026-04-29 20:00:00+03');

  -- (2) Extend 3.4 shift end_time by 40 minutes (skipped when there is no 3.4
  -- shift to extend, e.g. a seeded environment without shift data)
  IF v_old_3rd_end IS NULL THEN
    RAISE NOTICE 'No shift on 2026-04-03 - nothing to extend, skipping';
  ELSE
    UPDATE trainer_shifts
    SET end_time = end_time + INTERVAL '40 minutes'
    WHERE trainer_id = v_trainer_id
      AND start_time::date = DATE '2026-04-03';

    GET DIAGNOSTICS v_updated_rows = ROW_COUNT;
    RAISE NOTICE 'Extended % shift(s) on 3.4 by 40 minutes (was end %, now %)',
      v_updated_rows, v_old_3rd_end, v_old_3rd_end + INTERVAL '40 minutes';
  END IF;

  RAISE NOTICE 'Done updating shifts for %', v_trainer_name;
END;
$$;
