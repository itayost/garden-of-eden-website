-- supabase/migrations/20260819160000_fix_profile_self_update_recursion.sql
-- Make "Users can update own profile" actually work.
--
-- Since 20260225140000 the policy has guarded privileged columns with WITH CHECK
-- subqueries of the form `role = (SELECT p.role FROM profiles p WHERE ...)`.
-- Reading `profiles` from inside a policy on `profiles` re-enters that table's
-- policies, and Postgres refuses with 42P17 "infinite recursion detected in
-- policy for relation profiles". Every user-scoped UPDATE has failed since --
-- unnoticed, because every profile write in the app goes through the service
-- role, which bypasses RLS entirely.
--
-- The column guard moves to a BEFORE UPDATE trigger, matching
-- enforce_trainer_task_column_guard() which already solves this exact problem
-- for trainer_tasks. A trigger sees OLD and NEW directly, so it needs no
-- self-query and cannot recurse. The policy goes back to the simple ownership
-- test it had before.
--
-- The admin policies on profiles are untouched: they already use the
-- SECURITY DEFINER get_user_role(), which is why SELECT never recursed.

CREATE OR REPLACE FUNCTION enforce_profile_column_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service role and direct SQL (auth.uid() IS NULL) are trusted: they already
  -- bypass RLS, and every profile write the app makes arrives this way.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- Admins may change anything, including another user's row.
  IF get_user_role(auth.uid()) = 'admin' THEN
    RETURN NEW;
  END IF;

  -- A non-admin may only ever be editing their own row (the RLS policy enforces
  -- that); these are the columns they must not be able to move.
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
  -- Access tier: the facts come from the nightly Arbox sync and the override
  -- from an admin. Letting the owner touch these would let a course-only
  -- trainee unlock the whole app with the anon key.
  IF NEW.arbox_paid_training IS DISTINCT FROM OLD.arbox_paid_training THEN
    RAISE EXCEPTION 'arbox_paid_training cannot be changed by its owner';
  END IF;
  IF NEW.arbox_bought_course IS DISTINCT FROM OLD.arbox_bought_course THEN
    RAISE EXCEPTION 'arbox_bought_course cannot be changed by its owner';
  END IF;
  IF NEW.access_override IS DISTINCT FROM OLD.access_override THEN
    RAISE EXCEPTION 'access_override cannot be changed by its owner';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_column_guard ON profiles;
CREATE TRIGGER profiles_column_guard
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION enforce_profile_column_guard();

-- With the guard in the trigger, the policy is just an ownership test again.
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;
CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE
  TO authenticated
  USING (id = (SELECT auth.uid()) AND deleted_at IS NULL)
  WITH CHECK (id = (SELECT auth.uid()) AND deleted_at IS NULL);
