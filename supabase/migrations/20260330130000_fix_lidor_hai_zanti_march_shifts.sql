-- Fix shift hours for לידור חי זינטי - March 2026
-- Sun-Thu start at 15:00, Fri start at 10:00

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
      AND start_time = '2026-03-01 15:00:00+02'
      AND end_time = '2026-03-01 19:00:00+02'
  ) THEN
    RAISE NOTICE 'March 2026 fix already applied - skipping';
    RETURN;
  END IF;

  -- Delete all existing March 2026 shifts for this trainer
  DELETE FROM trainer_shifts
  WHERE trainer_id = v_trainer_id
    AND start_time >= '2026-03-01T00:00:00+02:00'
    AND start_time < '2026-04-01T00:00:00+03:00';

  -- Insert correct shifts
  -- Pre-DST: UTC+2, Post-DST (March 27+): UTC+3
  INSERT INTO trainer_shifts (trainer_id, trainer_name, start_time, end_time) VALUES
    -- 1.3 (Sun) 15:00-19:00 (4h)
    (v_trainer_id, v_trainer_name, '2026-03-01 15:00:00+02', '2026-03-01 19:00:00+02'),
    -- 2.3 (Mon) 15:00-21:00 (6h)
    (v_trainer_id, v_trainer_name, '2026-03-02 15:00:00+02', '2026-03-02 21:00:00+02'),
    -- 3.3 (Tue) 15:00-18:00 (3h)
    (v_trainer_id, v_trainer_name, '2026-03-03 15:00:00+02', '2026-03-03 18:00:00+02'),
    -- 4.3 (Wed) 15:00-22:00 (7h)
    (v_trainer_id, v_trainer_name, '2026-03-04 15:00:00+02', '2026-03-04 22:00:00+02'),
    -- 5.3 (Thu) 15:00-21:00 (6h)
    (v_trainer_id, v_trainer_name, '2026-03-05 15:00:00+02', '2026-03-05 21:00:00+02'),
    -- 6.3 (Fri) 10:00-15:00 (5h)
    (v_trainer_id, v_trainer_name, '2026-03-06 10:00:00+02', '2026-03-06 15:00:00+02'),
    -- 8.3 (Sun) 15:00-22:00 (7h)
    (v_trainer_id, v_trainer_name, '2026-03-08 15:00:00+02', '2026-03-08 22:00:00+02'),
    -- 9.3 (Mon) 15:00-21:00 (6h)
    (v_trainer_id, v_trainer_name, '2026-03-09 15:00:00+02', '2026-03-09 21:00:00+02'),
    -- 10.3 (Tue) 15:00-22:00 (7h)
    (v_trainer_id, v_trainer_name, '2026-03-10 15:00:00+02', '2026-03-10 22:00:00+02'),
    -- 11.3 (Wed) 15:00-21:00 (6h)
    (v_trainer_id, v_trainer_name, '2026-03-11 15:00:00+02', '2026-03-11 21:00:00+02'),
    -- 12.3 (Thu) 15:00-21:00 (6h)
    (v_trainer_id, v_trainer_name, '2026-03-12 15:00:00+02', '2026-03-12 21:00:00+02'),
    -- 13.3 (Fri) 10:00-16:00 (6h)
    (v_trainer_id, v_trainer_name, '2026-03-13 10:00:00+02', '2026-03-13 16:00:00+02'),
    -- 15.3 (Sun) 15:00-22:00 (7h)
    (v_trainer_id, v_trainer_name, '2026-03-15 15:00:00+02', '2026-03-15 22:00:00+02'),
    -- 16.3 (Mon) 15:00-21:00 (6h)
    (v_trainer_id, v_trainer_name, '2026-03-16 15:00:00+02', '2026-03-16 21:00:00+02'),
    -- 17.3 (Tue) 15:00-22:00 (7h)
    (v_trainer_id, v_trainer_name, '2026-03-17 15:00:00+02', '2026-03-17 22:00:00+02'),
    -- 18.3 (Wed) 15:00-22:00 (7h)
    (v_trainer_id, v_trainer_name, '2026-03-18 15:00:00+02', '2026-03-18 22:00:00+02'),
    -- 19.3 (Thu) 15:00-22:00 (7h)
    (v_trainer_id, v_trainer_name, '2026-03-19 15:00:00+02', '2026-03-19 22:00:00+02'),
    -- 20.3 (Fri) 10:00-16:00 (6h)
    (v_trainer_id, v_trainer_name, '2026-03-20 10:00:00+02', '2026-03-20 16:00:00+02'),
    -- 22.3 (Sun) 15:00-23:00 (8h)
    (v_trainer_id, v_trainer_name, '2026-03-22 15:00:00+02', '2026-03-22 23:00:00+02'),
    -- 23.3 (Mon) 15:00-21:00 (6h)
    (v_trainer_id, v_trainer_name, '2026-03-23 15:00:00+02', '2026-03-23 21:00:00+02'),
    -- 24.3 (Tue) 15:00-21:00 (6h)
    (v_trainer_id, v_trainer_name, '2026-03-24 15:00:00+02', '2026-03-24 21:00:00+02'),
    -- 25.3 (Wed) 15:00-21:00 (6h)
    (v_trainer_id, v_trainer_name, '2026-03-25 15:00:00+02', '2026-03-25 21:00:00+02'),
    -- 26.3 (Thu) 15:00-21:00 (6h)
    (v_trainer_id, v_trainer_name, '2026-03-26 15:00:00+02', '2026-03-26 21:00:00+02'),
    -- 27.3 (Fri) 10:00-16:00 (6h) -- DST starts, UTC+3
    (v_trainer_id, v_trainer_name, '2026-03-27 10:00:00+03', '2026-03-27 16:00:00+03'),
    -- 29.3 (Sun) 0 hours - skipped
    -- 30.3 (Mon) 15:00-21:00 (6h) -- after DST, UTC+3
    (v_trainer_id, v_trainer_name, '2026-03-30 15:00:00+03', '2026-03-30 21:00:00+03');

  RAISE NOTICE 'Inserted 25 shifts for % in March 2026', v_trainer_name;
END;
$$;
