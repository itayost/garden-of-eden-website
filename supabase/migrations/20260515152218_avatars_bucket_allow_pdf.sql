-- ===========================================
-- Allow meal-plan PDFs in the `avatars` bucket
-- ===========================================
-- The bucket was configured for images only (2 MB, image MIME types),
-- which silently rejected every meal-plan PDF upload with HTTP 400 at
-- the Storage layer (before the server action ran). Loosen the config
-- to match the app contract: 10 MB and application/pdf alongside the
-- existing image types.
--
-- Long-term, meal-plan PDFs should live in a separate private bucket
-- with signed URLs (see audit notes). This is the immediate unblock.

UPDATE storage.buckets
SET
  file_size_limit = 10485760,  -- 10 MB (matches MAX_PDF_SIZE in upload-pdf/route.ts)
  allowed_mime_types = ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf'
  ]
WHERE id = 'avatars';
