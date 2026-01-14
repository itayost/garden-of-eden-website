-- Profile Completion Feature
-- Adds columns for profile completion tracking, avatar storage, and player position

-- ===========================================
-- ADD NEW COLUMNS TO PROFILES TABLE
-- ===========================================
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS position VARCHAR(3) CHECK (position IS NULL OR position IN ('GK', 'CB', 'RB', 'LB', 'CDM', 'CM', 'CAM', 'LW', 'RW', 'ST', 'CF'));

-- ===========================================
-- MARK EXISTING COMPLETE PROFILES
-- ===========================================
-- Users with full_name AND birthdate are considered complete
UPDATE profiles
SET profile_completed = TRUE
WHERE full_name IS NOT NULL
  AND full_name != ''
  AND birthdate IS NOT NULL;

-- ===========================================
-- PERFORMANCE INDEX
-- ===========================================
CREATE INDEX IF NOT EXISTS idx_profiles_completed
ON profiles(id, profile_completed);

-- ===========================================
-- STORAGE BUCKET POLICIES FOR AVATARS
-- ===========================================
-- Note: The 'avatars' bucket must be created manually in Supabase Dashboard
-- Bucket settings:
--   - Name: avatars
--   - Public: false
--   - File size limit: 2MB (2097152 bytes)
--   - Allowed MIME types: image/jpeg, image/png, image/webp

-- Users can upload their own avatar
CREATE POLICY "Users can upload own avatar" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can update their own avatar
CREATE POLICY "Users can update own avatar" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Users can delete their own avatar
CREATE POLICY "Users can delete own avatar" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated users can view all avatars (for player cards)
CREATE POLICY "Users can view avatars" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');
