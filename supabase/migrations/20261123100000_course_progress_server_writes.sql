-- Course progress is written only by server code.
--
-- course_lesson_progress_owner_all let a trainee insert, update or delete
-- their own rows straight through PostgREST, which skipped the course access
-- gate in updateLessonProgress / markLessonComplete: a trainee locked out of
-- a course could still mark its lessons finished. Those two actions now write
-- with the service role after the gate, so the browser keeps read access to
-- its own rows (the course pages read them) and loses every write.
--
-- Deploy the code that writes with the service role before pushing this, or
-- progress saving stops for everyone until it ships.

SET LOCAL lock_timeout = '3s';

DROP POLICY IF EXISTS "course_lesson_progress_owner_all" ON public.course_lesson_progress;

CREATE POLICY "course_lesson_progress_owner_select" ON public.course_lesson_progress
  FOR SELECT TO authenticated
  USING ((SELECT auth.uid()) = user_id);

REVOKE INSERT, UPDATE, DELETE ON public.course_lesson_progress FROM anon, authenticated;

-- A DROP POLICY matches by exact name only; fail loudly if any policy other
-- than the two read policies is still in place.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'course_lesson_progress'
      AND policyname NOT IN ('course_lesson_progress_owner_select', 'course_lesson_progress_staff_select')
  ) THEN
    RAISE EXCEPTION 'course_lesson_progress still has a policy other than the two read policies';
  END IF;
END
$$;
