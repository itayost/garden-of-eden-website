-- Branch managers (ADR-0009) and branch-scoped staff reads (#89).
--
-- 1. A Branch manager is a Trainer whose membership in a branch is marked as
--    managing it. The admin powers that come with it are checked in the app.
-- 2. Every member of staff sees only the trainees of the branches they are
--    assigned to. "Trainers can view all profiles" ignored assignment, so a
--    trainer of one branch could read the other branch's children, medical
--    notes and parent phones included, with a direct query. Staff rows stay
--    visible to every trainer (schedules, shifts and tasks name colleagues).
--
-- Apply this before deploying the code that reads profile_branches.manages.

ALTER TABLE public.profile_branches
  ADD COLUMN IF NOT EXISTS manages boolean NOT NULL DEFAULT false;

-- profile_branches is readable only by its owner and admins, so a policy on
-- profiles cannot join it directly for a trainer; this runs as its owner.
CREATE OR REPLACE FUNCTION public.shares_branch_with(p_profile_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Staff only: anyone else could probe which branch a known profile is in.
  SELECT get_user_role((SELECT auth.uid())) IN ('trainer', 'admin')
    AND EXISTS (
    SELECT 1
      FROM public.profile_branches mine
      JOIN public.profile_branches theirs ON theirs.branch_id = mine.branch_id
     WHERE mine.profile_id = (SELECT auth.uid())
       AND theirs.profile_id = p_profile_id
  );
$$;

REVOKE ALL ON FUNCTION public.shares_branch_with(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shares_branch_with(uuid) TO authenticated;

DROP POLICY IF EXISTS "Trainers can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Trainers can view staff and their branches' trainees" ON public.profiles;
CREATE POLICY "Trainers can view staff and their branches' trainees" ON public.profiles
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND get_user_role((SELECT auth.uid())) = 'trainer'
    AND (role IS DISTINCT FROM 'trainee' OR shares_branch_with(id))
  );
