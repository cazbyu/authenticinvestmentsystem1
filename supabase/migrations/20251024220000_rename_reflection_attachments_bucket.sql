/*
  # Rename Reflection Attachments Bucket and Update File Size Limit

  1. Changes
    - Rename bucket from `0008-ap-reflection-attachments` to `0008-reflection-attachments`
    - Update file size limit from 10MB to 5MB (5242880 bytes)
    - Rename table from `0008-ap-reflection-attachments` to `0008-reflection-attachments`
    - Update all storage policies to reference new bucket name
    - Update all table policies to reference new table name

  2. Security
    - All existing RLS policies are preserved
    - No change to access control logic
*/

-- Drop existing storage policies for the old bucket name
DROP POLICY IF EXISTS "Users can upload their own reflection attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own reflection attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own reflection attachments" ON storage.objects;
DROP POLICY IF EXISTS "Public read access to reflection attachments" ON storage.objects;

-- Update the bucket configuration
UPDATE storage.buckets
SET
  id = '0008-reflection-attachments',
  name = '0008-reflection-attachments',
  file_size_limit = 5242880 -- 5MB
WHERE id = '0008-ap-reflection-attachments';

-- Rename the table
ALTER TABLE IF EXISTS "0008-ap-reflection-attachments"
  RENAME TO "0008-reflection-attachments";

-- Recreate storage policies with new bucket name
CREATE POLICY "Users can upload their own reflection attachments"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = '0008-reflection-attachments' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update their own reflection attachments"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = '0008-reflection-attachments' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete their own reflection attachments"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = '0008-reflection-attachments' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Public read access to reflection attachments"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = '0008-reflection-attachments');
