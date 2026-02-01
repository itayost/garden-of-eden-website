-- Trainee Images Infrastructure Migration
-- Phase 10: Trainee Images & FIFA Cards
-- Purpose: Add processed_avatar_url column and RLS policies for admin/trainer image uploads

-- ============================================
-- 1. ADD PROCESSED AVATAR URL COLUMN
-- ============================================

-- Add processed_avatar_url to profiles for FIFA card cutout images
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS processed_avatar_url TEXT DEFAULT NULL;

COMMENT ON COLUMN profiles.processed_avatar_url IS 'URL of background-removed cutout image for FIFA cards';

-- ============================================
-- 2. RLS POLICIES FOR AVATARS BUCKET STORAGE
-- ============================================
-- Allow admins and trainers to manage trainee avatar images

-- Policy: Admins and trainers can upload trainee avatars
DROP POLICY IF EXISTS "Admins and trainers can upload trainee avatars" ON storage.objects;
CREATE POLICY "Admins and trainers can upload trainee avatars" ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'trainer')
    )
  );

-- Policy: Admins and trainers can update trainee avatars
DROP POLICY IF EXISTS "Admins and trainers can update trainee avatars" ON storage.objects;
CREATE POLICY "Admins and trainers can update trainee avatars" ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'trainer')
    )
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'trainer')
    )
  );

-- Policy: Admins and trainers can delete trainee avatars
DROP POLICY IF EXISTS "Admins and trainers can delete trainee avatars" ON storage.objects;
CREATE POLICY "Admins and trainers can delete trainee avatars" ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'avatars'
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = (SELECT auth.uid())
      AND role IN ('admin', 'trainer')
    )
  );

-- Policy: Anyone can view avatars (public bucket)
DROP POLICY IF EXISTS "Anyone can view avatars" ON storage.objects;
CREATE POLICY "Anyone can view avatars" ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'avatars');
