-- supabase/migrations/20260819100000_course_videos_bucket.sql
-- Private storage bucket for the trainee video course.
--
-- Playback never reads this bucket directly. The server verifies the caller,
-- then mints a short-lived signed URL with the service-role client, and signed
-- URLs bypass RLS. That means trainees need no SELECT policy here at all --
-- the absence of one is the access control.
--
-- Path convention: {chapter-slug}/{lesson-slug}.{720p|480p}.mp4

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'course-videos',
  'course-videos',
  FALSE,
  262144000, -- 250 MB; the largest 720p rendition is well under 100 MB
  ARRAY['video/mp4']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Admins upload and replace lesson videos straight from the CMS, so the browser
-- talks to storage directly rather than pushing 60 MB through a server action.
CREATE POLICY "Admins manage course video objects" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'course-videos'
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  )
  WITH CHECK (
    bucket_id = 'course-videos'
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = (SELECT auth.uid()) AND role = 'admin'
    )
  );
