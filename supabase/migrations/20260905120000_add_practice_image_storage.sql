INSERT INTO storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
VALUES (
  'practice-images',
  'practice-images',
  false,
  1048576,
  ARRAY['image/jpeg']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Users can read own practice images" ON storage.objects;
CREATE POLICY "Users can read own practice images"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'practice-images'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

DROP POLICY IF EXISTS "Users can upload own practice images" ON storage.objects;
CREATE POLICY "Users can upload own practice images"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'practice-images'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

DROP POLICY IF EXISTS "Users can update own practice images" ON storage.objects;
CREATE POLICY "Users can update own practice images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
  bucket_id = 'practice-images'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
)
WITH CHECK (
  bucket_id = 'practice-images'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);

DROP POLICY IF EXISTS "Users can delete own practice images" ON storage.objects;
CREATE POLICY "Users can delete own practice images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'practice-images'
  AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
);
