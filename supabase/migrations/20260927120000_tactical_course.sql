-- הקורס הטקטי: a second course of Zoom recordings, open only to staff and
-- trainees whose account is active. Spec:
-- docs/superpowers/specs/2026-09-27-tactical-course-design.md

ALTER TABLE public.courses
  ADD COLUMN IF NOT EXISTS active_only boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.courses.active_only IS
  'Open only to staff and trainees with profiles.is_active; enforced in the course pages and getLessonPlaybackUrl.';

INSERT INTO public.courses (slug, title_he, description_he, is_published, needs_title, order_index, active_only)
VALUES (
  'tactical',
  'הקורס הטקטי',
  'הקלטות שיעורי הזום של הקורס הטקטי',
  false,
  false,
  (SELECT coalesce(max(order_index), 0) + 1 FROM public.courses),
  true
)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.course_chapters (course_id, slug, title_he, order_index)
SELECT id, 'zoom-lessons', 'שיעורי זום', 0
FROM public.courses
WHERE slug = 'tactical'
ON CONFLICT (course_id, slug) DO NOTHING;

-- Zoom recordings run to an hour or more; resumable uploads (TUS) up to 2 GB.
UPDATE storage.buckets
SET file_size_limit = 2147483648
WHERE id = 'course-videos';
