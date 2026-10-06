-- Trainees no longer read trainer profiles. RLS filters rows, not columns, so
-- this policy let any trainee read every column of every active trainer
-- (phone, medical notes, emergency contact). Its one user, the post-training
-- trainer list, loads with the service role since #126.
--
-- No IF EXISTS: a name mismatch must fail, not pass silently.

SET LOCAL lock_timeout = '3s';
DROP POLICY "Trainees can view trainer profiles" ON public.profiles;
