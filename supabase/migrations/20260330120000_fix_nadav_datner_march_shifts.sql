-- Fix shift hours for נדב דטנר (Nadav Datner) - March 2026
-- Deletes existing March shifts and re-inserts with correct times

DO $$
DECLARE
  v_trainer_id UUID;
  v_trainer_name TEXT;
BEGIN
  -- Find trainer by name
  SELECT id, full_name INTO v_trainer_id, v_trainer_name
  FROM profiles
  WHERE full_name ILIKE '%נדב דטנר%'
    AND role IN ('trainer', 'admin')
  LIMIT 1;

  -- Skip (not fail) when the trainer is absent: keeps `supabase db reset` and
  -- fresh environments working, where profiles is empty.
  IF v_trainer_id IS NULL THEN
    RAISE NOTICE 'Trainer נדב דטנר not found - skipping (fresh environment)';
    RETURN;
  END IF;

  RAISE NOTICE 'Found trainer: % (id: %)', v_trainer_name, v_trainer_id;

  -- Already-applied sentinel: this migration ran on prod when created. If the
  -- first re-inserted shift is present, a re-run would only wipe columns added
  -- to trainer_shifts since then - skip instead.
  IF EXISTS (
    SELECT 1 FROM trainer_shifts
    WHERE trainer_id = v_trainer_id
      AND start_time = '2026-03-02 17:00:00+02'
      AND end_time = '2026-03-02 20:00:00+02'
  ) THEN
    RAISE NOTICE 'March 2026 fix already applied - skipping';
    RETURN;
  END IF;

  -- Delete all existing March 2026 shifts for this trainer
  DELETE FROM trainer_shifts
  WHERE trainer_id = v_trainer_id
    AND start_time >= '2026-03-01T00:00:00+02:00'
    AND start_time < '2026-04-01T00:00:00+03:00';

  -- Insert correct shifts (Israel timezone UTC+2 for March 2026, DST starts March 27 -> UTC+3)
  INSERT INTO trainer_shifts (trainer_id, trainer_name, start_time, end_time) VALUES
    -- 2.3 17:00-20:00
    (v_trainer_id, v_trainer_name, '2026-03-02 17:00:00+02', '2026-03-02 20:00:00+02'),
    -- 3.3 15:00-20:00
    (v_trainer_id, v_trainer_name, '2026-03-03 15:00:00+02', '2026-03-03 20:00:00+02'),
    -- 4.3 17:00-20:00
    (v_trainer_id, v_trainer_name, '2026-03-04 17:00:00+02', '2026-03-04 20:00:00+02'),
    -- 5.3 15:00-20:00
    (v_trainer_id, v_trainer_name, '2026-03-05 15:00:00+02', '2026-03-05 20:00:00+02'),
    -- 6.3 10:00-15:00
    (v_trainer_id, v_trainer_name, '2026-03-06 10:00:00+02', '2026-03-06 15:00:00+02'),
    -- 9.3 15:00-20:00
    (v_trainer_id, v_trainer_name, '2026-03-09 15:00:00+02', '2026-03-09 20:00:00+02'),
    -- 10.3 15:00-20:00
    (v_trainer_id, v_trainer_name, '2026-03-10 15:00:00+02', '2026-03-10 20:00:00+02'),
    -- 11.3 15:00-20:00
    (v_trainer_id, v_trainer_name, '2026-03-11 15:00:00+02', '2026-03-11 20:00:00+02'),
    -- 12.3 15:00-20:00
    (v_trainer_id, v_trainer_name, '2026-03-12 15:00:00+02', '2026-03-12 20:00:00+02'),
    -- 13.3 10:00-15:00
    (v_trainer_id, v_trainer_name, '2026-03-13 10:00:00+02', '2026-03-13 15:00:00+02'),
    -- 15.3 15:00-20:00
    (v_trainer_id, v_trainer_name, '2026-03-15 15:00:00+02', '2026-03-15 20:00:00+02'),
    -- 16.3 14:30-20:00
    (v_trainer_id, v_trainer_name, '2026-03-16 14:30:00+02', '2026-03-16 20:00:00+02'),
    -- 17.3 15:00-20:00
    (v_trainer_id, v_trainer_name, '2026-03-17 15:00:00+02', '2026-03-17 20:00:00+02'),
    -- 18.3 14:00-20:00
    (v_trainer_id, v_trainer_name, '2026-03-18 14:00:00+02', '2026-03-18 20:00:00+02'),
    -- 19.3 11:00-14:00
    (v_trainer_id, v_trainer_name, '2026-03-19 11:00:00+02', '2026-03-19 14:00:00+02'),
    -- 23.3 16:00-20:00
    (v_trainer_id, v_trainer_name, '2026-03-23 16:00:00+02', '2026-03-23 20:00:00+02'),
    -- 25.3 17:00-20:00
    (v_trainer_id, v_trainer_name, '2026-03-25 17:00:00+02', '2026-03-25 20:00:00+02'),
    -- 27.3 9:00-15:00 (DST starts March 27 in Israel -> UTC+3)
    (v_trainer_id, v_trainer_name, '2026-03-27 09:00:00+03', '2026-03-27 15:00:00+03'),
    -- 29.3 8:00-10:00 (first shift, after DST)
    (v_trainer_id, v_trainer_name, '2026-03-29 08:00:00+03', '2026-03-29 10:00:00+03'),
    -- 29.3 17:00-20:00 (second shift, after DST)
    (v_trainer_id, v_trainer_name, '2026-03-29 17:00:00+03', '2026-03-29 20:00:00+03');

  RAISE NOTICE 'Inserted 20 shifts for % in March 2026', v_trainer_name;
END;
$$;
