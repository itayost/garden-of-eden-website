-- Fix overly permissive INSERT policy on user_achievements
-- Original policy (migration 008) had WITH CHECK (TRUE) allowing any user to insert for any user

DROP POLICY IF EXISTS "System can insert achievements" ON user_achievements;

-- Replace with scoped policy: users can only earn achievements for themselves
CREATE POLICY "Users can earn own achievements" ON user_achievements
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));
