-- supabase/migrations/20260819140000_course_access_tier.sql
-- Who sees the whole app, and who sees only the digital course.
--
-- The academy sells the course in Arbox as an `item`, alongside memberships
-- (`plan`) and session packs (`session`). Someone who bought the course but has
-- never paid for training sees the course and nothing else; anyone who ever
-- trained here keeps the full app, even if that membership lapsed long ago.
--
-- The two Arbox facts are stored rather than the verdict, so the rule can change
-- without a re-sync and "why is this person restricted?" has an auditable
-- answer. `access_override` is the admin's escape hatch, because the Arbox link
-- is fuzzy-matched and a wrongly restricted paying customer must be fixable
-- without touching Arbox.

ALTER TABLE profiles
  ADD COLUMN arbox_paid_training BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN arbox_bought_course BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN access_override TEXT,
  ADD COLUMN arbox_access_synced_at TIMESTAMPTZ;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_access_override_valid
  CHECK (access_override IS NULL OR access_override IN ('full', 'course_only'));

COMMENT ON COLUMN profiles.arbox_paid_training IS
  'Ever held an Arbox plan or session membership (active, expired or cancelled). Synced nightly.';
COMMENT ON COLUMN profiles.arbox_bought_course IS
  'Ever bought the Arbox item "קורס דיגיטלי". Synced nightly.';
COMMENT ON COLUMN profiles.access_override IS
  'Admin override of the derived access tier. NULL means derive it from the Arbox facts.';

-- ===========================================================================
-- Close the self-update hole these columns would otherwise open
-- ===========================================================================
-- "Users can update own profile" pins only the columns that existed when it was
-- last written, so every new column is writable by the user themselves. Without
-- this, a course-only trainee could set access_override = 'full' with the anon
-- key and unlock the whole app.

DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid()) AND deleted_at IS NULL)
  WITH CHECK (
    id = (SELECT auth.uid())
    AND deleted_at IS NULL
    -- Prevent self-elevation of privileged columns
    AND role = (SELECT p.role FROM profiles p WHERE p.id = (SELECT auth.uid()))
    AND is_active = (SELECT p.is_active FROM profiles p WHERE p.id = (SELECT auth.uid()))
    AND nutrition_appointment_status = (
      SELECT p.nutrition_appointment_status FROM profiles p WHERE p.id = (SELECT auth.uid())
    )
    -- Access tier: the facts come from the nightly Arbox sync and the override
    -- from an admin. A trainee may change none of them.
    AND arbox_paid_training = (
      SELECT p.arbox_paid_training FROM profiles p WHERE p.id = (SELECT auth.uid())
    )
    AND arbox_bought_course = (
      SELECT p.arbox_bought_course FROM profiles p WHERE p.id = (SELECT auth.uid())
    )
    AND access_override IS NOT DISTINCT FROM (
      SELECT p.access_override FROM profiles p WHERE p.id = (SELECT auth.uid())
    )
  );
