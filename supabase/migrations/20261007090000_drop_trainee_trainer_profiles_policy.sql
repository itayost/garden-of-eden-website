-- Trainees no longer read trainer profiles (security, found in review 2026-10-06).
--
-- "Trainees can view trainer profiles" let any trainee read every column of
-- every active trainer's profile (phone, medical notes, emergency contact,
-- guardian phone), because RLS filters rows, not columns. Its only user was
-- the post-training report's trainer dropdown, which since PR #126 is loaded
-- in its server page with the service role (names and ids only). Nothing
-- else running as a trainee reads another profile; trainers and admins keep
-- their own policies.
--
-- Contract: apply after #126 is live (it is).

DROP POLICY IF EXISTS "Trainees can view trainer profiles" ON public.profiles;
