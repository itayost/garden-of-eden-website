-- Fix shift hours for אביעד וכשטוק - March 2026
-- Sun-Thu start at 15:00, Fri start at 10:00

DO $$
DECLARE
  v_trainer_id UUID := '5444898b-753f-47ed-9f5c-cd1771ceccec';
  v_trainer_name TEXT := 'אביעד וכשטוק';
BEGIN
  -- Skip (not fail) when the profile is absent: keeps `supabase db reset` and
  -- fresh environments working, where the hardcoded UUID has no auth.users row
  -- and the insert below would violate the FK.
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = v_trainer_id) THEN
    RAISE NOTICE 'Trainer % (%) not found - skipping (fresh environment)', v_trainer_name, v_trainer_id;
    RETURN;
  END IF;

  -- Already-applied sentinel: skip re-runs so later-added trainer_shifts
  -- columns are not wiped by the delete+insert below.
  IF EXISTS (
    SELECT 1 FROM trainer_shifts
    WHERE trainer_id = v_trainer_id
      AND start_time = '2026-03-17 15:00:00+02'
      AND end_time = '2026-03-17 16:30:00+02'
  ) THEN
    RAISE NOTICE 'March 2026 fix already applied - skipping';
    RETURN;
  END IF;

  -- Delete only the window being re-inserted (17.3 onward). Shifts logged
  -- 1.3-16.3, if any, are outside this fix's scope and must survive.
  DELETE FROM trainer_shifts
  WHERE trainer_id = v_trainer_id
    AND start_time >= '2026-03-17T00:00:00+02:00'
    AND start_time < '2026-03-31T00:00:00+03:00';

  -- Insert correct shifts
  -- Pre-DST: UTC+2, Post-DST (March 27+): UTC+3
  INSERT INTO trainer_shifts (trainer_id, trainer_name, start_time, end_time) VALUES
    -- 17.3 (Tue) 15:00-16:30 (1.5h)
    (v_trainer_id, v_trainer_name, '2026-03-17 15:00:00+02', '2026-03-17 16:30:00+02'),
    -- 18.3 (Wed) 15:00-17:00 (2h)
    (v_trainer_id, v_trainer_name, '2026-03-18 15:00:00+02', '2026-03-18 17:00:00+02'),
    -- 19.3 (Thu) 15:00-20:00 (5h)
    (v_trainer_id, v_trainer_name, '2026-03-19 15:00:00+02', '2026-03-19 20:00:00+02'),
    -- 20.3 (Fri) 10:00-15:00 (5h)
    (v_trainer_id, v_trainer_name, '2026-03-20 10:00:00+02', '2026-03-20 15:00:00+02'),
    -- 22.3 (Sun) 15:00-20:30 (5.5h)
    (v_trainer_id, v_trainer_name, '2026-03-22 15:00:00+02', '2026-03-22 20:30:00+02'),
    -- 24.3 (Tue) 15:00-21:00 (6h)
    (v_trainer_id, v_trainer_name, '2026-03-24 15:00:00+02', '2026-03-24 21:00:00+02'),
    -- 26.3 (Thu) 15:00-00:30 (9.5h)
    (v_trainer_id, v_trainer_name, '2026-03-26 15:00:00+02', '2026-03-27 00:30:00+02'),
    -- 29.3 (Sun) 15:00-18:30 (3.5h) -- after DST, UTC+3
    (v_trainer_id, v_trainer_name, '2026-03-29 15:00:00+03', '2026-03-29 18:30:00+03'),
    -- 30.3 (Mon) 15:00-22:00 (7h) -- after DST, UTC+3
    (v_trainer_id, v_trainer_name, '2026-03-30 15:00:00+03', '2026-03-30 22:00:00+03');

  RAISE NOTICE 'Inserted 9 shifts for % in March 2026', v_trainer_name;
END;
$$;
