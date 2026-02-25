-- Add tour_completed flag to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS tour_completed BOOLEAN NOT NULL DEFAULT false;

-- Add nutrition appointment status enum and column
DO $$ BEGIN
  CREATE TYPE public.nutrition_appointment_status AS ENUM (
    'not_scheduled', 'scheduled', 'completed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS nutrition_appointment_status public.nutrition_appointment_status
    NOT NULL DEFAULT 'not_scheduled';

-- Index for admin queries
CREATE INDEX IF NOT EXISTS idx_profiles_nutrition_appointment_status
  ON public.profiles (nutrition_appointment_status)
  WHERE role = 'trainee' AND deleted_at IS NULL;

-- Backfill: existing users with profile_completed = true should NOT see the tour
UPDATE public.profiles
SET tour_completed = true
WHERE profile_completed = true;

-- ============================================
-- Tighten self-update RLS policy
-- ============================================
-- The existing "Users can update own profile" policy allows ANY column to be
-- written. This is a privilege escalation risk: a trainee could set role='admin'
-- or nutrition_appointment_status='completed' on their own row using the public
-- anon key. Fix: WITH CHECK ensures sensitive columns remain unchanged.

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
  );
