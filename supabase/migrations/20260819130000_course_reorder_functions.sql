-- supabase/migrations/20260819130000_course_reorder_functions.sql
-- Atomic reordering for course chapters and lessons.
--
-- The CMS previously issued one UPDATE per row from the server action. A failure
-- part-way through left the chapter half-renumbered with no way back, while the
-- browser was already showing the new order. Doing the renumber inside a single
-- statement in a single function makes it all-or-nothing.
--
-- Both functions are SECURITY DEFINER but re-check `is_course_admin()` against
-- the *caller*, so they must be invoked with the request-scoped client rather
-- than the service role -- that keeps the permission check meaningful instead of
-- relying on the caller having already done it.

CREATE OR REPLACE FUNCTION reorder_course_chapters(
  p_course_id UUID,
  p_ids UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  child_count INTEGER;
BEGIN
  IF NOT public.is_course_admin() THEN
    RAISE EXCEPTION 'not authorised';
  END IF;

  SELECT COUNT(*) INTO child_count
  FROM public.course_chapters
  WHERE course_id = p_course_id;

  -- The list must name this course's chapters exactly: no foreign ids, no
  -- omissions, no duplicates.
  IF child_count IS DISTINCT FROM COALESCE(array_length(p_ids, 1), 0)
     OR EXISTS (
       SELECT 1
       FROM unnest(p_ids) AS candidate(id)
       WHERE NOT EXISTS (
         SELECT 1 FROM public.course_chapters c
         WHERE c.id = candidate.id AND c.course_id = p_course_id
       )
     )
     OR (SELECT COUNT(DISTINCT id) FROM unnest(p_ids) AS u(id)) IS DISTINCT FROM child_count
  THEN
    RAISE EXCEPTION 'id list does not match this course''s chapters';
  END IF;

  UPDATE public.course_chapters AS ch
  SET order_index = ordered.position - 1
  FROM unnest(p_ids) WITH ORDINALITY AS ordered(id, position)
  WHERE ch.id = ordered.id;
END;
$$;

CREATE OR REPLACE FUNCTION reorder_course_lessons(
  p_chapter_id UUID,
  p_ids UUID[]
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  child_count INTEGER;
BEGIN
  IF NOT public.is_course_admin() THEN
    RAISE EXCEPTION 'not authorised';
  END IF;

  SELECT COUNT(*) INTO child_count
  FROM public.course_lessons
  WHERE chapter_id = p_chapter_id;

  IF child_count IS DISTINCT FROM COALESCE(array_length(p_ids, 1), 0)
     OR EXISTS (
       SELECT 1
       FROM unnest(p_ids) AS candidate(id)
       WHERE NOT EXISTS (
         SELECT 1 FROM public.course_lessons l
         WHERE l.id = candidate.id AND l.chapter_id = p_chapter_id
       )
     )
     OR (SELECT COUNT(DISTINCT id) FROM unnest(p_ids) AS u(id)) IS DISTINCT FROM child_count
  THEN
    RAISE EXCEPTION 'id list does not match this chapter''s lessons';
  END IF;

  UPDATE public.course_lessons AS l
  SET order_index = ordered.position - 1
  FROM unnest(p_ids) WITH ORDINALITY AS ordered(id, position)
  WHERE l.id = ordered.id;
END;
$$;

REVOKE ALL ON FUNCTION reorder_course_chapters(UUID, UUID[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION reorder_course_lessons(UUID, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION reorder_course_chapters(UUID, UUID[]) TO authenticated;
GRANT EXECUTE ON FUNCTION reorder_course_lessons(UUID, UUID[]) TO authenticated;
