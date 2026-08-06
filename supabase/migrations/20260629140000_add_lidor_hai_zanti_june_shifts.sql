-- Add June 2026 shifts for לידור חי זינטי (total 136h)
-- Sun-Thu start at 15:00, Fri start at 10:00
-- All June 2026 dates are within DST (started 2026-03-27) -> UTC+3
-- Clears the whole June 2026 month before re-insert (idempotent)
-- 3.6 reported 0 hours -> no shift inserted

DO $$
DECLARE
  v_trainer_id UUID;
  v_trainer_name TEXT;
  v_existing_count INT;
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

  -- Already-applied sentinel: a re-run of the delete+insert below would reset
  -- trainer_shifts columns added after this fix originally ran (shift_period,
  -- other_purpose_*, auto_ended, ...) and sever shift_change_requests links.
  IF EXISTS (
    SELECT 1 FROM trainer_shifts
    WHERE trainer_id = v_trainer_id
      AND start_time = '2026-06-01 15:00:00+03'
      AND end_time = '2026-06-01 20:00:00+03'
  ) THEN
    RAISE NOTICE 'June 2026 fix already applied - skipping';
    RETURN;
  END IF;

  -- Capture prior values for June (audit trail before destructive op)
  SELECT COUNT(*) INTO v_existing_count
  FROM trainer_shifts
  WHERE trainer_id = v_trainer_id
    AND start_time >= '2026-06-01T00:00:00+03:00'
    AND start_time < '2026-06-30T00:00:00+03:00';
  RAISE NOTICE 'Existing June shifts (will be replaced): %', v_existing_count;

  -- Delete only through 29.6 - the last day this fix re-inserts. A 30.6 shift
  -- logged via the app is outside this fix's scope and must survive.
  DELETE FROM trainer_shifts
  WHERE trainer_id = v_trainer_id
    AND start_time >= '2026-06-01T00:00:00+03:00'
    AND start_time < '2026-06-30T00:00:00+03:00';

  -- Insert correct shifts (all within DST, UTC+3)
  INSERT INTO trainer_shifts (trainer_id, trainer_name, start_time, end_time) VALUES
    -- 1.6 (Mon) 15:00-20:00 (5h)
    (v_trainer_id, v_trainer_name, '2026-06-01 15:00:00+03', '2026-06-01 20:00:00+03'),
    -- 2.6 (Tue) 15:00-21:00 (6h)
    (v_trainer_id, v_trainer_name, '2026-06-02 15:00:00+03', '2026-06-02 21:00:00+03'),
    -- 3.6 (Wed) 0h -> no shift
    -- 4.6 (Thu) 15:00-23:00 (8h)
    (v_trainer_id, v_trainer_name, '2026-06-04 15:00:00+03', '2026-06-04 23:00:00+03'),
    -- 5.6 (Fri) 10:00-16:00 (6h)
    (v_trainer_id, v_trainer_name, '2026-06-05 10:00:00+03', '2026-06-05 16:00:00+03'),
    -- 7.6 (Sun) 15:00-22:00 (7h)
    (v_trainer_id, v_trainer_name, '2026-06-07 15:00:00+03', '2026-06-07 22:00:00+03'),
    -- 8.6 (Mon) 15:00-20:00 (5h)
    (v_trainer_id, v_trainer_name, '2026-06-08 15:00:00+03', '2026-06-08 20:00:00+03'),
    -- 9.6 (Tue) 15:00-23:00 (8h)
    (v_trainer_id, v_trainer_name, '2026-06-09 15:00:00+03', '2026-06-09 23:00:00+03'),
    -- 10.6 (Wed) 15:00-20:00 (5h)
    (v_trainer_id, v_trainer_name, '2026-06-10 15:00:00+03', '2026-06-10 20:00:00+03'),
    -- 11.6 (Thu) 15:00-19:00 (4h)
    (v_trainer_id, v_trainer_name, '2026-06-11 15:00:00+03', '2026-06-11 19:00:00+03'),
    -- 12.6 (Fri) 10:00-17:00 (7h)
    (v_trainer_id, v_trainer_name, '2026-06-12 10:00:00+03', '2026-06-12 17:00:00+03'),
    -- 14.6 (Sun) 15:00-23:00 (8h)
    (v_trainer_id, v_trainer_name, '2026-06-14 15:00:00+03', '2026-06-14 23:00:00+03'),
    -- 15.6 (Mon) 15:00-20:00 (5h)
    (v_trainer_id, v_trainer_name, '2026-06-15 15:00:00+03', '2026-06-15 20:00:00+03'),
    -- 16.6 (Tue) 15:00-23:00 (8h)
    (v_trainer_id, v_trainer_name, '2026-06-16 15:00:00+03', '2026-06-16 23:00:00+03'),
    -- 17.6 (Wed) 15:00-21:00 (6h)
    (v_trainer_id, v_trainer_name, '2026-06-17 15:00:00+03', '2026-06-17 21:00:00+03'),
    -- 18.6 (Thu) 15:00-21:00 (6h)
    (v_trainer_id, v_trainer_name, '2026-06-18 15:00:00+03', '2026-06-18 21:00:00+03'),
    -- 19.6 (Fri) 10:00-15:00 (5h)
    (v_trainer_id, v_trainer_name, '2026-06-19 10:00:00+03', '2026-06-19 15:00:00+03'),
    -- 21.6 (Sun) 15:00-19:00 (4h)
    (v_trainer_id, v_trainer_name, '2026-06-21 15:00:00+03', '2026-06-21 19:00:00+03'),
    -- 22.6 (Mon) 15:00-20:00 (5h)
    (v_trainer_id, v_trainer_name, '2026-06-22 15:00:00+03', '2026-06-22 20:00:00+03'),
    -- 24.6 (Wed) 15:00-17:00 (2h)
    (v_trainer_id, v_trainer_name, '2026-06-24 15:00:00+03', '2026-06-24 17:00:00+03'),
    -- 25.6 (Thu) 15:00-00:00 (9h, spans midnight)
    (v_trainer_id, v_trainer_name, '2026-06-25 15:00:00+03', '2026-06-26 00:00:00+03'),
    -- 26.6 (Fri) 10:00-16:00 (6h)
    (v_trainer_id, v_trainer_name, '2026-06-26 10:00:00+03', '2026-06-26 16:00:00+03'),
    -- 28.6 (Sun) 15:00-20:00 (5h)
    (v_trainer_id, v_trainer_name, '2026-06-28 15:00:00+03', '2026-06-28 20:00:00+03'),
    -- 29.6 (Mon) 15:00-21:00 (6h)
    (v_trainer_id, v_trainer_name, '2026-06-29 15:00:00+03', '2026-06-29 21:00:00+03');

  RAISE NOTICE 'Inserted 23 June shifts for % (total 136h)', v_trainer_name;
END;
$$;
