-- ===========================================
-- WEEKLY SCHEDULE (לוח שבועי) — the standing staffing layer above the board
--
-- The daily board answers "who is taking this group at this hour on this date".
-- It has had to answer it from scratch every day, because nothing in the system
-- knew the part that never changes: staffing repeats weekly. Sunday looks like
-- Sunday. That pattern lived only in the WhatsApp message the admin maintains.
--
-- A BAND is the atom: one stretch of one weekday a trainer covers. Two trainers
-- on the same stretch are two bands, mirroring "two trainers at the same hour
-- are two slots" in daily_schedule_slots.
--
-- Bands carry no date. The staffing in force on an actual date is DERIVED —
-- that weekday's bands with that date's exceptions applied — and is never
-- stored. See docs/adr/0003-weekly-schedule-derives-staffing.md; the rule is
-- ADR-0001's: no second source of truth that can drift from the first.
--
-- What IS materialised is slots, and only when a human presses the button
-- (buildDayFromWeeklyScheduleAction). ADR-0002 stands: the board is
-- staff-authored, nothing appears on it unasked.
--
-- Every statement is idempotent so a partially-applied migration can be
-- replayed safely.
-- ===========================================

CREATE TABLE IF NOT EXISTS weekly_schedule_bands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 0 = Sunday .. 6 = Saturday, matching getIsraelTime().dayOfWeek and the
  -- HEBREW_WEEKDAYS arrays in src/lib/utils/date.ts. Saturday is legal in the
  -- schema and simply has no rows — the studio is shut, and a CHECK forbidding
  -- it would be a business rule frozen into the wrong layer.
  weekday SMALLINT NOT NULL CHECK (weekday BETWEEN 0 AND 6),

  start_time TIME NOT NULL,
  -- NULL = open-ended ("18:00 והלאה"), i.e. runs to the end of the day. This is
  -- how the admin actually writes it, and inventing a closing hour would put a
  -- number in the system that nobody decided.
  end_time TIME,

  -- NOT NULL, unlike daily_schedule_slots.trainer_id: a slot can legitimately be
  -- written before anyone knows who takes it, but a band with no trainer says
  -- nothing at all — naming the trainer is the entire content of a band.
  trainer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- Denormalized snapshot, same convention as the slot board. Also dodges the
  -- profiles RLS trap: a trainer may read only their own row plus active
  -- trainer rows, so rendering a band for an admin-who-coaches would otherwise
  -- need the service role on every read.
  trainer_name TEXT NOT NULL,

  -- Free text, deliberately matching daily_schedule_slots.location_he rather
  -- than introducing a locations table: "סטודיו", "ביתר חיפה", "עתלית".
  location_he TEXT,
  -- What this stretch is, when it has a fixed identity: "ילדים א׳", "נערים ג׳",
  -- "לידן". Seeds the slot's focus when a day is built from the week.
  label_he TEXT,

  -- "חיזוק במידת הצורך" — the trainer covers this only if called in. Shown in
  -- the day's staffing, never used to seed a slot: nobody has decided it yet.
  is_standby BOOLEAN NOT NULL DEFAULT false,

  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT weekly_bands_end_after_start
    CHECK (end_time IS NULL OR end_time > start_time)
);

CREATE TABLE IF NOT EXISTS weekly_schedule_exceptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  exception_date DATE NOT NULL,

  trainer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  trainer_name TEXT NOT NULL,

  -- 'absent': drop every band this trainer has on that weekday, for this date.
  -- 'extra':  add a one-off band on this date only.
  -- A swap is one of each. Text + CHECK rather than an enum, matching the
  -- schedule/session/equipment tables, which use zero enums.
  kind TEXT NOT NULL CHECK (kind IN ('absent', 'extra')),

  -- 'extra' only. Same shape as the band columns above.
  start_time TIME,
  end_time TIME,
  location_he TEXT,
  label_he TEXT,

  -- Why, in the admin's words: "חופשה", "מילואים". Rendered next to the
  -- absence so the day explains itself.
  note_he TEXT,

  created_by UUID NOT NULL REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT weekly_exceptions_extra_has_start
    CHECK (kind <> 'extra' OR start_time IS NOT NULL),
  -- An absence covers the trainer's whole day, so times on it would be read as
  -- a partial absence the derivation does not implement.
  CONSTRAINT weekly_exceptions_absent_has_no_times
    CHECK (kind <> 'absent' OR (start_time IS NULL AND end_time IS NULL)),
  CONSTRAINT weekly_exceptions_end_after_start
    CHECK (end_time IS NULL OR (start_time IS NOT NULL AND end_time > start_time))
);

-- ===========================================
-- INDEXES
-- ===========================================

-- Every read is "the bands for this weekday", ordered for display.
CREATE INDEX IF NOT EXISTS idx_weekly_bands_weekday
  ON weekly_schedule_bands(weekday, start_time);

-- The weekly editor reads all seven days at once and groups by trainer.
CREATE INDEX IF NOT EXISTS idx_weekly_bands_trainer
  ON weekly_schedule_bands(trainer_id);

-- The day view reads one date; the weekly editor reads a range.
CREATE INDEX IF NOT EXISTS idx_weekly_exceptions_date
  ON weekly_schedule_exceptions(exception_date);

-- A trainer is either absent on a date or not — a second absence row would
-- silently do nothing, and the UI would show the vacation reason twice.
-- 'extra' is deliberately outside the index: several one-off bands on one date
-- for one trainer is a normal Wednesday.
CREATE UNIQUE INDEX IF NOT EXISTS idx_weekly_exceptions_one_absence
  ON weekly_schedule_exceptions(exception_date, trainer_id)
  WHERE kind = 'absent';

-- ===========================================
-- UPDATED_AT TRIGGERS (shared helper, defined in 20260806120000)
-- ===========================================

DROP TRIGGER IF EXISTS set_weekly_schedule_bands_updated_at ON weekly_schedule_bands;
CREATE TRIGGER set_weekly_schedule_bands_updated_at
  BEFORE UPDATE ON weekly_schedule_bands
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS set_weekly_schedule_exceptions_updated_at ON weekly_schedule_exceptions;
CREATE TRIGGER set_weekly_schedule_exceptions_updated_at
  BEFORE UPDATE ON weekly_schedule_exceptions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ===========================================
-- LENGTH BOUNDS AT THE DB LAYER
--
-- Same reasoning as 20260812100000: the anon key sits in every staff browser,
-- so PostgREST is a real write surface and the Zod caps in
-- src/lib/validations/weekly-schedule.ts are not the only line. Keep the two in
-- step. CHECK passes on NULL, which is what the nullable columns want.
-- ===========================================

ALTER TABLE weekly_schedule_bands
  DROP CONSTRAINT IF EXISTS weekly_bands_location_length;
ALTER TABLE weekly_schedule_bands
  ADD CONSTRAINT weekly_bands_location_length
  CHECK (char_length(location_he) <= 300);

ALTER TABLE weekly_schedule_bands
  DROP CONSTRAINT IF EXISTS weekly_bands_label_length;
ALTER TABLE weekly_schedule_bands
  ADD CONSTRAINT weekly_bands_label_length
  CHECK (char_length(label_he) <= 300);

ALTER TABLE weekly_schedule_bands
  DROP CONSTRAINT IF EXISTS weekly_bands_trainer_name_length;
ALTER TABLE weekly_schedule_bands
  ADD CONSTRAINT weekly_bands_trainer_name_length
  CHECK (char_length(trainer_name) <= 100);

ALTER TABLE weekly_schedule_exceptions
  DROP CONSTRAINT IF EXISTS weekly_exceptions_location_length;
ALTER TABLE weekly_schedule_exceptions
  ADD CONSTRAINT weekly_exceptions_location_length
  CHECK (char_length(location_he) <= 300);

ALTER TABLE weekly_schedule_exceptions
  DROP CONSTRAINT IF EXISTS weekly_exceptions_label_length;
ALTER TABLE weekly_schedule_exceptions
  ADD CONSTRAINT weekly_exceptions_label_length
  CHECK (char_length(label_he) <= 300);

ALTER TABLE weekly_schedule_exceptions
  DROP CONSTRAINT IF EXISTS weekly_exceptions_note_length;
ALTER TABLE weekly_schedule_exceptions
  ADD CONSTRAINT weekly_exceptions_note_length
  CHECK (char_length(note_he) <= 300);

ALTER TABLE weekly_schedule_exceptions
  DROP CONSTRAINT IF EXISTS weekly_exceptions_trainer_name_length;
ALTER TABLE weekly_schedule_exceptions
  ADD CONSTRAINT weekly_exceptions_trainer_name_length
  CHECK (char_length(trainer_name) <= 100);

-- ===========================================
-- ROW LEVEL SECURITY
--
-- Staff read, admins write — deliberately narrower than the slot board next
-- door, which trainers may write. A slot is one group on one day and a wrong
-- one is deleted; the weekly schedule is standing staffing, and editing it
-- changes every future Sunday. That is a management decision, the same
-- reasoning that keeps whole-day duplication admin-only.
--
-- Reads do not require is_active, writes do — same split and same reason as
-- 20260812100000: deactivating a trainer revokes no session, so a write gate
-- that ignored is_active would keep letting them write until the token expired,
-- while a read gate that checked it would blank the page mid-shift.
--
-- Trainees get no policy at all. They never see staffing.
-- ===========================================

ALTER TABLE weekly_schedule_bands ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_schedule_exceptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "weekly_bands_staff_select" ON weekly_schedule_bands;
CREATE POLICY "weekly_bands_staff_select" ON weekly_schedule_bands
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'trainer')
      AND deleted_at IS NULL
    )
  );

-- INSERT is split out so it can pin created_by to the caller; see the note in
-- 20260812100000 for why that matters through PostgREST.
DROP POLICY IF EXISTS "weekly_bands_admin_insert" ON weekly_schedule_bands;
CREATE POLICY "weekly_bands_admin_insert" ON weekly_schedule_bands
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
      AND is_active = true
      AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "weekly_bands_admin_update" ON weekly_schedule_bands;
CREATE POLICY "weekly_bands_admin_update" ON weekly_schedule_bands
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
      AND is_active = true
      AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
      AND is_active = true
      AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "weekly_bands_admin_delete" ON weekly_schedule_bands;
CREATE POLICY "weekly_bands_admin_delete" ON weekly_schedule_bands
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
      AND is_active = true
      AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "weekly_exceptions_staff_select" ON weekly_schedule_exceptions;
CREATE POLICY "weekly_exceptions_staff_select" ON weekly_schedule_exceptions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'trainer')
      AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "weekly_exceptions_admin_insert" ON weekly_schedule_exceptions;
CREATE POLICY "weekly_exceptions_admin_insert" ON weekly_schedule_exceptions
  FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
      AND is_active = true
      AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "weekly_exceptions_admin_update" ON weekly_schedule_exceptions;
CREATE POLICY "weekly_exceptions_admin_update" ON weekly_schedule_exceptions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
      AND is_active = true
      AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
      AND is_active = true
      AND deleted_at IS NULL
    )
  );

DROP POLICY IF EXISTS "weekly_exceptions_admin_delete" ON weekly_schedule_exceptions;
CREATE POLICY "weekly_exceptions_admin_delete" ON weekly_schedule_exceptions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role = 'admin'
      AND is_active = true
      AND deleted_at IS NULL
    )
  );

-- Verification after applying (DROP POLICY matches by exact name, so a stale
-- permissive policy under an old name would survive a rename unnoticed):
--   SELECT tablename, policyname, cmd FROM pg_policies
--   WHERE tablename LIKE 'weekly_schedule%' ORDER BY 1, 2;
-- Expect eight rows:
--   weekly_schedule_bands       staff_select / admin_insert / admin_update / admin_delete
--   weekly_schedule_exceptions  staff_select / admin_insert / admin_update / admin_delete
--
--   SELECT relname, relrowsecurity FROM pg_class
--   WHERE relname LIKE 'weekly_schedule%';
-- Expect relrowsecurity = true on both.
