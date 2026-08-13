-- ===========================================
-- Daily brief: staff write it, not just admins.
--
-- The brief was modelled as admin-to-staff broadcast. In practice the person
-- who knows that the photographer moved to 16:00 is the trainer who took the
-- call, and routing that through an admin means it lands late or never. Same
-- reasoning as 20260812100000_schedule_staff_write for the board beside it.
--
-- There is still exactly one brief per calendar day, shared and overwritten in
-- place — this widens who may write it, not how many there are.
--
-- The write policies require is_active, which the read policy does not.
-- Deactivating a trainer only flips the profile column and revokes no session,
-- so without it a deactivated trainer keeps writing the brief until their token
-- expires. Reads stay open so a page already loaded does not go blank.
-- ===========================================

DROP POLICY IF EXISTS "briefs_admin_insert" ON daily_briefs;
DROP POLICY IF EXISTS "briefs_admin_update" ON daily_briefs;
DROP POLICY IF EXISTS "briefs_staff_insert" ON daily_briefs;
DROP POLICY IF EXISTS "briefs_staff_update" ON daily_briefs;

CREATE POLICY "briefs_staff_insert" ON daily_briefs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    author_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'trainer')
      AND is_active = true
      AND deleted_at IS NULL
    )
  );

-- Any staff member may rewrite any day's brief, including someone else's. The
-- author stays fixed and the editor is recorded, see the trigger below.
CREATE POLICY "briefs_staff_update" ON daily_briefs
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'trainer')
      AND is_active = true
      AND deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'trainer')
      AND is_active = true
      AND deleted_at IS NULL
    )
  );

-- ===========================================
-- ATTRIBUTION GUARD
--
-- Replaces guard_daily_brief_author, which only froze the author on UPDATE.
-- Attribution is now the only accountability the brief has — every trainer can
-- overwrite what the previous one wrote — and the name snapshots were free
-- text as far as the database was concerned. The anon key sits in every staff
-- browser, so a crafted PostgREST call could sign a brief as anyone.
--
-- Pinned here rather than trusted from the server action: the action is one
-- caller among the possible ones, not a boundary.
-- ===========================================

CREATE OR REPLACE FUNCTION enforce_daily_brief_attribution()
RETURNS trigger AS $$
DECLARE
  caller_name TEXT;
BEGIN
  -- The author of a brief is fixed at creation; edits only move updated_by_*.
  IF TG_OP = 'UPDATE' THEN
    NEW.author_id := OLD.author_id;
    NEW.author_name := OLD.author_name;
  END IF;

  -- Service role and direct SQL (auth.uid() IS NULL) are trusted: they already
  -- bypass RLS, and back-office scripts must stay able to correct rows.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(full_name, 'צוות') INTO caller_name
  FROM profiles
  WHERE id = auth.uid();

  IF TG_OP = 'INSERT' THEN
    NEW.author_id := auth.uid();
    NEW.author_name := COALESCE(caller_name, 'צוות');
  END IF;

  NEW.updated_by_id := auth.uid();
  NEW.updated_by_name := COALESCE(caller_name, 'צוות');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS guard_daily_brief_author ON daily_briefs;
DROP TRIGGER IF EXISTS guard_daily_brief_attribution ON daily_briefs;
CREATE TRIGGER guard_daily_brief_attribution
  BEFORE INSERT OR UPDATE ON daily_briefs
  FOR EACH ROW
  EXECUTE FUNCTION enforce_daily_brief_attribution();

DROP FUNCTION IF EXISTS enforce_daily_brief_author_immutable();

-- ===========================================
-- Length bound at the DB layer.
--
-- The 5000-char cap lives in src/lib/validations/tasks.ts, inside the server
-- action. Now that every trainer may write this row through PostgREST with the
-- anon key, the cap needs to hold at the table too. Keep the two in step.
-- ===========================================

ALTER TABLE daily_briefs
  DROP CONSTRAINT IF EXISTS daily_briefs_content_length;
ALTER TABLE daily_briefs
  ADD CONSTRAINT daily_briefs_content_length
  CHECK (char_length(content) <= 5000);

-- Verification after applying (DROP POLICY matches by exact name, so a stale
-- permissive policy under the old name would survive a rename unnoticed):
--   SELECT policyname, cmd FROM pg_policies
--   WHERE tablename = 'daily_briefs' ORDER BY 1;
-- Expect four rows and none named *_admin_*:
--   briefs_no_hard_delete / briefs_staff_insert / briefs_staff_select /
--   briefs_staff_update
