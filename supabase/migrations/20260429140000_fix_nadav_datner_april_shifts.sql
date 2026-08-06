-- Fix shift hours for נדב דטנר (Nadav Datner) - April 2026
-- Adds three missing shifts (6.4, 15.4, 17.4) and corrects start time on 5.4 to 15:00
-- All April 2026 dates are post-DST (DST started 2026-03-27) -> UTC+3

DO $$
DECLARE
  v_trainer_id UUID;
  v_trainer_name TEXT;
  v_updated_5_4 INT;
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

  -- Already-applied sentinel: the inserts below are unconditional, so a re-run
  -- would double-count these shifts - skip when the first one already exists.
  IF EXISTS (
    SELECT 1 FROM trainer_shifts
    WHERE trainer_id = v_trainer_id
      AND start_time = '2026-04-06 15:00:00+03'
      AND end_time = '2026-04-06 20:00:00+03'
  ) THEN
    RAISE NOTICE 'April 2026 fix already applied - skipping';
    RETURN;
  END IF;

  -- Fix 5.4 start time to 15:00 (preserve existing end_time)
  UPDATE trainer_shifts
  SET start_time = '2026-04-05 15:00:00+03'
  WHERE trainer_id = v_trainer_id
    AND start_time >= '2026-04-05T00:00:00+03:00'
    AND start_time <  '2026-04-06T00:00:00+03:00';

  GET DIAGNOSTICS v_updated_5_4 = ROW_COUNT;
  RAISE NOTICE 'Updated % shift(s) on 5.4 to start at 15:00', v_updated_5_4;

  -- Add missing shifts
  INSERT INTO trainer_shifts (trainer_id, trainer_name, start_time, end_time) VALUES
    -- 6.4 (Mon) 15:00-20:00
    (v_trainer_id, v_trainer_name, '2026-04-06 15:00:00+03', '2026-04-06 20:00:00+03'),
    -- 15.4 (Wed) 15:00-20:00
    (v_trainer_id, v_trainer_name, '2026-04-15 15:00:00+03', '2026-04-15 20:00:00+03'),
    -- 17.4 (Fri) 12:00-15:00
    (v_trainer_id, v_trainer_name, '2026-04-17 12:00:00+03', '2026-04-17 15:00:00+03');

  RAISE NOTICE 'Inserted 3 shifts for % in April 2026', v_trainer_name;
END;
$$;
