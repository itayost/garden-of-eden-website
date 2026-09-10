-- ===========================================
-- Branches: the academy now runs in two physical places.
--
-- branches is an admin-editable lookup table. profile_branches is the
-- many-to-many link: a trainer or trainee belongs to one branch or both.
-- Schedule bands, exceptions, slots and shifts each point at one branch.
--
-- This supersedes the inline note in 20260815120000_weekly_schedule.sql that
-- chose free text over a locations table. location_he stays: it names the
-- room or field ("סטודיו", "מגרש"), not the branch.
-- See docs/adr/0006-branches-are-a-table.md.
-- ===========================================

CREATE TABLE branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_he TEXT NOT NULL UNIQUE
    CHECK (char_length(name_he) BETWEEN 1 AND 60),
  -- Dormant Arbox hook. Null until Eden splits Arbox into two locations.
  arbox_location_name TEXT UNIQUE
    CHECK (arbox_location_name IS NULL OR char_length(arbox_location_name) BETWEEN 1 AND 120),
  is_active BOOLEAN NOT NULL DEFAULT true,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION set_branches_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER branches_set_updated_at
  BEFORE UPDATE ON branches
  FOR EACH ROW EXECUTE FUNCTION set_branches_updated_at();

INSERT INTO branches (name_he, order_index) VALUES
  ('חיפה', 0),
  ('קריית אתא', 1);

CREATE TABLE profile_branches (
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (profile_id, branch_id)
);
CREATE INDEX idx_profile_branches_branch ON profile_branches(branch_id);

-- Stamped whenever an admin or trainer sets a user's branches by hand.
-- The Arbox sync fills branches only while this is null.
ALTER TABLE profiles ADD COLUMN branches_set_by_admin_at TIMESTAMPTZ;

-- Nullable on purpose: legacy rows are backfilled below, and an offline
-- clock-in replayed later must never fail on a missing branch.
ALTER TABLE weekly_schedule_bands ADD COLUMN branch_id UUID REFERENCES branches(id);
ALTER TABLE weekly_schedule_exceptions ADD COLUMN branch_id UUID REFERENCES branches(id);
ALTER TABLE daily_schedule_slots ADD COLUMN branch_id UUID REFERENCES branches(id);
ALTER TABLE trainer_shifts ADD COLUMN branch_id UUID REFERENCES branches(id);

CREATE INDEX idx_weekly_bands_branch ON weekly_schedule_bands(branch_id);
CREATE INDEX idx_weekly_exceptions_branch ON weekly_schedule_exceptions(branch_id);
CREATE INDEX idx_schedule_slots_branch ON daily_schedule_slots(branch_id);
CREATE INDEX idx_trainer_shifts_branch ON trainer_shifts(branch_id);

-- ===========================================
-- Backfill: everything that exists today happened in חיפה.
-- Counts are raised as a NOTICE so the prior state is visible in the log.
-- ===========================================
DO $$
DECLARE
  v_haifa UUID;
  v_profiles INTEGER;
  v_bands INTEGER;
  v_exceptions INTEGER;
  v_slots INTEGER;
  v_shifts INTEGER;
BEGIN
  SELECT id INTO v_haifa FROM branches WHERE name_he = 'חיפה';

  INSERT INTO profile_branches (profile_id, branch_id)
  SELECT id, v_haifa FROM profiles
  ON CONFLICT DO NOTHING;
  GET DIAGNOSTICS v_profiles = ROW_COUNT;

  UPDATE weekly_schedule_bands SET branch_id = v_haifa WHERE branch_id IS NULL;
  GET DIAGNOSTICS v_bands = ROW_COUNT;

  UPDATE weekly_schedule_exceptions SET branch_id = v_haifa WHERE branch_id IS NULL;
  GET DIAGNOSTICS v_exceptions = ROW_COUNT;

  UPDATE daily_schedule_slots SET branch_id = v_haifa WHERE branch_id IS NULL;
  GET DIAGNOSTICS v_slots = ROW_COUNT;

  UPDATE trainer_shifts SET branch_id = v_haifa WHERE branch_id IS NULL;
  GET DIAGNOSTICS v_shifts = ROW_COUNT;

  RAISE NOTICE 'branches backfill to חיפה: profiles=% bands=% exceptions=% slots=% shifts=%',
    v_profiles, v_bands, v_exceptions, v_slots, v_shifts;
END $$;

-- ===========================================
-- RLS
-- ===========================================
ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "branches_select_authenticated" ON branches
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "branches_write_admin" ON branches
  FOR ALL TO authenticated
  USING (get_user_role((SELECT auth.uid())) = 'admin')
  WITH CHECK (get_user_role((SELECT auth.uid())) = 'admin');

ALTER TABLE profile_branches ENABLE ROW LEVEL SECURITY;

-- A user reads their own memberships; admins read all. Trainers read other
-- users' memberships through the service role inside gated server actions,
-- the same way schedule-options.ts reads the trainee list.
CREATE POLICY "profile_branches_select_own_or_admin" ON profile_branches
  FOR SELECT TO authenticated
  USING (
    profile_id = (SELECT auth.uid())
    OR get_user_role((SELECT auth.uid())) = 'admin'
  );

CREATE POLICY "profile_branches_write_admin" ON profile_branches
  FOR ALL TO authenticated
  USING (get_user_role((SELECT auth.uid())) = 'admin')
  WITH CHECK (get_user_role((SELECT auth.uid())) = 'admin');

-- ===========================================
-- Column guard: the owner of a profile must not move the admin stamp.
-- Full function body repeated because CREATE OR REPLACE replaces it whole.
-- ===========================================
CREATE OR REPLACE FUNCTION enforce_profile_column_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  RETURN NEW;
END;
$$;
