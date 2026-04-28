-- supabase/migrations/20260428120200_create_trainee_clips_bucket.sql
-- Private storage bucket for trainee-uploaded short video clips.
-- 100 MB cap, MP4 + MOV only, served via short-lived signed URLs.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'trainee-clips',
  'trainee-clips',
  FALSE,
  104857600, -- 100 MB
  ARRAY['video/mp4', 'video/quicktime']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Path convention: {userId}/{timestamp}.{ext}. Owner's folder = first segment.

CREATE POLICY "Users can upload own clip" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'trainee-clips'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update own clip" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'trainee-clips'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete own clip" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'trainee-clips'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users read own clip" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'trainee-clips'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Staff read all clips" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'trainee-clips'
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin', 'trainer')
    )
  );

CREATE POLICY "Admins manage all clip objects" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'trainee-clips'
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    bucket_id = 'trainee-clips'
    AND EXISTS (
      SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );
