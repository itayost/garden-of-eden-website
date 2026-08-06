-- Fix shift hours for לידור חי זינטי - April 2026
-- Sun-Thu start at 15:00, Fri start at 10:00
-- All April 2026 dates are post-DST (DST started 2026-03-27) -> UTC+3

DO $$
DECLARE
  v_trainer_id UUID;
  v_trainer_name TEXT;
BEGIN
  -- Find trainer by name
  SELECT id, full_name INTO v_trainer_id, v_trainer_name
  FROM profiles
  WHERE full_name ILIKE '%לידור%זינטי%'
    AND role IN ('trainer', 'admin')
  LIMIT 1;

  -- Skip (not fail) when the trainer is absent: keeps `supabase db reset` and
  -- fresh environments working, where profiles is empty.
  IF v_trainer_id IS NULL THEN
    RAISE NOTICE 'Trainer לידור חי זינטי not found - skipping (fresh environment)';
    RETURN;
  END IF;

  RAISE NOTICE 'Found trainer: % (id: %)', v_trainer_name, v_trainer_id;

  -- Already-applied sentinel: skip re-runs so later-added trainer_shifts
  -- columns are not wiped by the delete+insert below.
  IF EXISTS (
    SELECT 1 FROM trainer_shifts
    WHERE trainer_id = v_trainer_id
      AND start_time = '2026-04-01 15:00:00+03'
      AND end_time = '2026-04-01 19:00:00+03'
  ) THEN
    RAISE NOTICE 'April 2026 fix already applied - skipping';
    RETURN;
  END IF;

  -- Delete all existing April 2026 shifts for this trainer
  DELETE FROM trainer_shifts
  WHERE trainer_id = v_trainer_id
    AND start_time >= '2026-04-01T00:00:00+03:00'
    AND start_time < '2026-05-01T00:00:00+03:00';

  -- Insert correct shifts (all post-DST, UTC+3)
  INSERT INTO trainer_shifts (trainer_id, trainer_name, start_time, end_time) VALUES
    -- 1.4 (Wed) 15:00-19:00 (4h)
    (v_trainer_id, v_trainer_name, '2026-04-01 15:00:00+03', '2026-04-01 19:00:00+03'),
    -- 3.4 (Fri) 10:00-16:00 (6h)
    (v_trainer_id, v_trainer_name, '2026-04-03 10:00:00+03', '2026-04-03 16:00:00+03'),
    -- 5.4 (Sun) 15:00-00:00 (9h, spans midnight)
    (v_trainer_id, v_trainer_name, '2026-04-05 15:00:00+03', '2026-04-06 00:00:00+03'),
    -- 6.4 (Mon) 15:00-20:00 (5h)
    (v_trainer_id, v_trainer_name, '2026-04-06 15:00:00+03', '2026-04-06 20:00:00+03'),
    -- 7.4 (Tue) 15:00-22:00 (7h)
    (v_trainer_id, v_trainer_name, '2026-04-07 15:00:00+03', '2026-04-07 22:00:00+03'),
    -- 9.4 (Thu) 15:00-22:00 (7h)
    (v_trainer_id, v_trainer_name, '2026-04-09 15:00:00+03', '2026-04-09 22:00:00+03'),
    -- 10.4 (Fri) 10:00-16:00 (6h)
    (v_trainer_id, v_trainer_name, '2026-04-10 10:00:00+03', '2026-04-10 16:00:00+03'),
    -- 12.4 (Sun) 15:00-21:00 (6h)
    (v_trainer_id, v_trainer_name, '2026-04-12 15:00:00+03', '2026-04-12 21:00:00+03'),
    -- 13.4 (Mon) 15:00-20:00 (5h)
    (v_trainer_id, v_trainer_name, '2026-04-13 15:00:00+03', '2026-04-13 20:00:00+03'),
    -- 14.4 (Tue) 15:00-22:00 (7h)
    (v_trainer_id, v_trainer_name, '2026-04-14 15:00:00+03', '2026-04-14 22:00:00+03'),
    -- 16.4 (Thu) 15:00-20:00 (5h)
    (v_trainer_id, v_trainer_name, '2026-04-16 15:00:00+03', '2026-04-16 20:00:00+03'),
    -- 17.4 (Fri) 10:00-16:00 (6h)
    (v_trainer_id, v_trainer_name, '2026-04-17 10:00:00+03', '2026-04-17 16:00:00+03'),
    -- 19.4 (Sun) 15:00-21:00 (6h)
    (v_trainer_id, v_trainer_name, '2026-04-19 15:00:00+03', '2026-04-19 21:00:00+03'),
    -- 20.4 (Mon) 15:00-18:00 (3h)
    (v_trainer_id, v_trainer_name, '2026-04-20 15:00:00+03', '2026-04-20 18:00:00+03'),
    -- 21.4 (Tue) 15:00-22:00 (7h)
    (v_trainer_id, v_trainer_name, '2026-04-21 15:00:00+03', '2026-04-21 22:00:00+03');

  RAISE NOTICE 'Inserted 15 shifts for % in April 2026', v_trainer_name;
END;
$$;
