-- Allow trainees (and all authenticated users) to view active trainer profiles
-- Needed for post-workout form trainer dropdown
CREATE POLICY "Trainees can view trainer profiles"
ON profiles FOR SELECT
USING (
  role = 'trainer'::user_role
  AND deleted_at IS NULL
  AND is_active = true
  AND get_user_role((SELECT auth.uid())) IN ('trainee'::user_role, 'trainer'::user_role, 'admin'::user_role)
);
