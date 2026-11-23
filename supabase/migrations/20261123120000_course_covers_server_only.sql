-- Course covers are written only by the server.
--
-- Course cover images live in the public `avatars` bucket under
-- `course-covers/<courseId>/`. They are uploaded by /api/images/course-cover,
-- which checks the admin role and writes with the service role (which bypasses
-- RLS). The older avatars policies let any admin or trainer insert, update or
-- delete any object in the bucket, so a trainer could overwrite or remove a
-- course's cover from the browser. These RESTRICTIVE policies refuse every
-- write by a signed-in user under that folder, whatever the permissive policies
-- allow. Reads stay as they are: the bucket is public.
--
-- `IS DISTINCT FROM` keeps a top-level object (no folder, so foldername()[1] is
-- NULL) writable as before; `=` would make the check NULL and refuse it.

DROP POLICY IF EXISTS "Course covers: no browser inserts" ON storage.objects;
CREATE POLICY "Course covers: no browser inserts" ON storage.objects
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id <> 'avatars'
    OR (storage.foldername(name))[1] IS DISTINCT FROM 'course-covers'
  );

-- USING stops changing an existing cover; WITH CHECK stops moving or renaming
-- another object into the folder.
DROP POLICY IF EXISTS "Course covers: no browser updates" ON storage.objects;
CREATE POLICY "Course covers: no browser updates" ON storage.objects
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id <> 'avatars'
    OR (storage.foldername(name))[1] IS DISTINCT FROM 'course-covers'
  )
  WITH CHECK (
    bucket_id <> 'avatars'
    OR (storage.foldername(name))[1] IS DISTINCT FROM 'course-covers'
  );

DROP POLICY IF EXISTS "Course covers: no browser deletes" ON storage.objects;
CREATE POLICY "Course covers: no browser deletes" ON storage.objects
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated
  USING (
    bucket_id <> 'avatars'
    OR (storage.foldername(name))[1] IS DISTINCT FROM 'course-covers'
  );
