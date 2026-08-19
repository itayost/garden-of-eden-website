-- supabase/migrations/20260819110000_course_schema.sql
-- Trainee video course: courses -> chapters -> lessons, plus per-user progress.
--
-- Every trainee gets the course, so there is no enrollment table -- access is a
-- function of role alone. Unpublished content is invisible to trainees at the
-- RLS layer rather than being filtered in application queries.
--
-- Video files live in the private `course-videos` bucket created by
-- 20260819100000_course_videos_bucket.sql. `video_path` is a storage key, and
-- playback happens through short-lived signed URLs minted server-side.

-- ===========================================================================
-- TABLES
-- ===========================================================================

CREATE TABLE courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  title_he TEXT NOT NULL,
  description_he TEXT,
  cover_url TEXT,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  needs_title BOOLEAN NOT NULL DEFAULT FALSE,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- A course still carrying a placeholder name cannot go live.
  CONSTRAINT courses_publish_needs_title CHECK (NOT is_published OR NOT needs_title)
);

CREATE TABLE course_chapters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  title_he TEXT NOT NULL,
  subtitle_he TEXT,
  needs_title BOOLEAN NOT NULL DEFAULT FALSE,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (course_id, slug)
);
CREATE INDEX idx_course_chapters_course ON course_chapters(course_id, order_index);

CREATE TABLE course_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chapter_id UUID NOT NULL REFERENCES course_chapters(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  title_he TEXT NOT NULL,
  description_he TEXT,
  video_path TEXT,
  video_path_sd TEXT,
  duration_sec INTEGER NOT NULL DEFAULT 0,
  needs_title BOOLEAN NOT NULL DEFAULT FALSE,
  is_published BOOLEAN NOT NULL DEFAULT FALSE,
  order_index INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (chapter_id, slug),
  CONSTRAINT course_lessons_duration_non_negative CHECK (duration_sec >= 0),
  -- The forcing function that gets the titles filled in: a lesson with a
  -- placeholder name or no video cannot be published.
  CONSTRAINT course_lessons_publish_ready CHECK (
    NOT is_published OR (video_path IS NOT NULL AND NOT needs_title)
  )
);
CREATE INDEX idx_course_lessons_chapter ON course_lessons(chapter_id, order_index);

CREATE TABLE course_lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id UUID NOT NULL REFERENCES course_lessons(id) ON DELETE CASCADE,
  last_position_sec INTEGER NOT NULL DEFAULT 0,
  watched_sec INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, lesson_id),
  CONSTRAINT course_progress_position_non_negative CHECK (last_position_sec >= 0),
  CONSTRAINT course_progress_watched_non_negative CHECK (watched_sec >= 0)
);
CREATE INDEX idx_course_lesson_progress_user ON course_lesson_progress(user_id);
CREATE INDEX idx_course_lesson_progress_lesson ON course_lesson_progress(lesson_id);

-- ===========================================================================
-- UPDATED_AT TRIGGERS
-- ===========================================================================

CREATE OR REPLACE FUNCTION update_course_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER courses_updated_at
  BEFORE UPDATE ON courses
  FOR EACH ROW EXECUTE FUNCTION update_course_updated_at();

CREATE TRIGGER course_chapters_updated_at
  BEFORE UPDATE ON course_chapters
  FOR EACH ROW EXECUTE FUNCTION update_course_updated_at();

CREATE TRIGGER course_lessons_updated_at
  BEFORE UPDATE ON course_lessons
  FOR EACH ROW EXECUTE FUNCTION update_course_updated_at();

CREATE TRIGGER course_lesson_progress_updated_at
  BEFORE UPDATE ON course_lesson_progress
  FOR EACH ROW EXECUTE FUNCTION update_course_updated_at();

-- ===========================================================================
-- ROW LEVEL SECURITY
-- ===========================================================================

-- Staff (admin or trainer) see everything including drafts; trainees see only
-- what is published, all the way up the chain.
CREATE OR REPLACE FUNCTION is_course_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'trainer')
      AND deleted_at IS NULL
  );
$$;

CREATE OR REPLACE FUNCTION is_course_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND role = 'admin'
      AND deleted_at IS NULL
  );
$$;

ALTER TABLE courses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "courses_select_published_or_staff" ON courses
  FOR SELECT TO authenticated
  USING (is_published OR is_course_staff());

CREATE POLICY "courses_write_admin" ON courses
  FOR ALL TO authenticated
  USING (is_course_admin())
  WITH CHECK (is_course_admin());

ALTER TABLE course_chapters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "course_chapters_select_published_or_staff" ON course_chapters
  FOR SELECT TO authenticated
  USING (
    is_course_staff()
    OR EXISTS (
      SELECT 1 FROM courses c
      WHERE c.id = course_chapters.course_id AND c.is_published
    )
  );

CREATE POLICY "course_chapters_write_admin" ON course_chapters
  FOR ALL TO authenticated
  USING (is_course_admin())
  WITH CHECK (is_course_admin());

ALTER TABLE course_lessons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "course_lessons_select_published_or_staff" ON course_lessons
  FOR SELECT TO authenticated
  USING (
    is_course_staff()
    OR (
      is_published
      AND EXISTS (
        SELECT 1
        FROM course_chapters ch
        JOIN courses c ON c.id = ch.course_id
        WHERE ch.id = course_lessons.chapter_id AND c.is_published
      )
    )
  );

CREATE POLICY "course_lessons_write_admin" ON course_lessons
  FOR ALL TO authenticated
  USING (is_course_admin())
  WITH CHECK (is_course_admin());

-- Progress is owned by the trainee. Staff read it to see who has watched what,
-- but never write it.
ALTER TABLE course_lesson_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "course_lesson_progress_owner_all" ON course_lesson_progress
  FOR ALL TO authenticated
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

CREATE POLICY "course_lesson_progress_staff_select" ON course_lesson_progress
  FOR SELECT TO authenticated
  USING (is_course_staff());
