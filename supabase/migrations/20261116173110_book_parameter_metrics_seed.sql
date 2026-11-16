-- First draft of the metric-to-book map, plan
-- docs/superpowers/plans/2026-11-16-goal-proposals.md. Staff correct it in
-- /admin/book/metrics.
--
-- Matches parameters by slug, never by id: a slug that does not exist adds
-- nothing. Safe to rerun: once the map holds any pair it adds nothing, so a
-- rerun never brings back a pair staff removed in the editor.

SET LOCAL lock_timeout = '3s';

INSERT INTO public.book_parameter_metrics (parameter_id, metric_key)
SELECT p.id, m.metric_key
FROM (VALUES
  ('sprint_5m', 'כוח-מתפרץ-8'),
  ('sprint_5m', 'מהירות-ריצה-9'),
  ('sprint_10m', 'מהירות-ריצה-9'),
  ('sprint_10m', 'כוח-מתפרץ-8'),
  ('sprint_20m', 'מהירות-ריצה-9'),
  ('jump_2leg_distance', 'כוח-מתפרץ-8'),
  ('jump_2leg_height', 'כוח-מתפרץ-8'),
  ('jump_right_leg', 'כוח-מתפרץ-8'),
  ('jump_left_leg', 'כוח-מתפרץ-8'),
  ('blaze_spot_time', 'kondos-code'),
  ('blaze_spot_time', 'קריאת-משחק-12'),
  ('flexibility_ankle', 'גמישות-core-כוח-עליון-ריקברי-11'),
  ('flexibility_knee', 'גמישות-core-כוח-עליון-ריקברי-11'),
  ('flexibility_hip', 'גמישות-core-כוח-עליון-ריקברי-11'),
  ('kick_power_right_foot', 'בעיטה-לשער-5'),
  ('kick_power_right_foot', 'מסירה-ארוכה-4'),
  ('kick_power_left_foot', 'בעיטה-לשער-5'),
  ('kick_power_left_foot', 'מסירה-ארוכה-4'),
  ('shuffle_10m', 'kondos-code'),
  ('shuffle_10m', 'אחד-על-אחד-הגנתי-1'),
  ('sprint_10m_h', 'kondos-code'),
  ('sprint_10m_h', 'מהירות-ריצה-9'),
  ('sprint_10m_h_ball', 'kondos-code'),
  ('sprint_10m_h_ball', 'כישורי-כדרור-6'),
  ('sprint_10m_h_ball', 'אחד-על-אחד-התקפי-0'),
  ('envelope', 'kondos-code'),
  ('envelope_ball', 'kondos-code'),
  ('envelope_ball', 'כישורי-כדרור-6')
) AS m(metric_key, slug)
JOIN public.book_parameters p ON p.slug = m.slug
WHERE NOT EXISTS (SELECT 1 FROM public.book_parameter_metrics)
ON CONFLICT (parameter_id, metric_key) DO NOTHING;
