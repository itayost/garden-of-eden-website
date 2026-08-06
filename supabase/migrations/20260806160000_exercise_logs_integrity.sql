-- ===========================================
-- EXERCISE LOGS INTEGRITY — follow-up to 20260806150000 (code review findings)
--
-- 1. The INSERT/UPDATE policies pinned trainee_id but not session_exercise_id,
--    so a trainee could attach a forged log to ANOTHER trainee's session
--    exercise — invisible to the victim (select_own) but rendered to staff as
--    the victim's performed work. Both policies now require the session
--    exercise, when set, to belong to the caller's own session.
--
-- 2. No constraint backed the "one log per session exercise" invariant; a
--    double-tap created duplicates and embeds rendered an arbitrary one.
--    Partial unique index added; free logs (NULL session_exercise_id) are
--    exempt.
--
-- Deliberately unchanged: equipment_authenticated_select USING (true). A
-- trainee can read equipment notes_he via direct PostgREST; accepted — the
-- catalog holds operational labels, not sensitive content, and the scan flow
-- needs code resolution.
-- ===========================================

DROP POLICY IF EXISTS "exercise_logs_trainee_insert_own" ON exercise_logs;
CREATE POLICY "exercise_logs_trainee_insert_own" ON exercise_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (
    trainee_id = (SELECT auth.uid())
    AND (
      session_exercise_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM training_session_exercises tse
        JOIN training_sessions ts ON ts.id = tse.session_id
        WHERE tse.id = session_exercise_id
        AND ts.trainee_id = (SELECT auth.uid())
        -- The log's exercise must be the one the session row prescribes.
        AND tse.exercise_id = exercise_logs.exercise_id
      )
    )
  );

DROP POLICY IF EXISTS "exercise_logs_trainee_update_own" ON exercise_logs;
CREATE POLICY "exercise_logs_trainee_update_own" ON exercise_logs
  FOR UPDATE
  TO authenticated
  USING (trainee_id = (SELECT auth.uid()))
  WITH CHECK (
    trainee_id = (SELECT auth.uid())
    AND (
      session_exercise_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM training_session_exercises tse
        JOIN training_sessions ts ON ts.id = tse.session_id
        WHERE tse.id = session_exercise_id
        AND ts.trainee_id = (SELECT auth.uid())
        AND tse.exercise_id = exercise_logs.exercise_id
      )
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_exercise_logs_unique_session_exercise
  ON exercise_logs(trainee_id, session_exercise_id)
  WHERE session_exercise_id IS NOT NULL;
