/*
  # Fix Note Attachments Storage Policies

  1. Issues Fixed
    - Drop duplicate/conflicting storage policies
    - Recreate correct policies for authenticated access
    - Ensure bucket settings are correct

  2. Storage Bucket
    - Keep bucket private (secure by default)
    - Use signed URLs for access

  3. Security
    - Users can upload to their own folder (userId/)
    - Users can read their own attachments
    - Users can delete their own attachments
*/

-- Drop conflicting policies
DROP POLICY IF EXISTS "note_attachments_insert_own_folder_note 3b4ry2_0" ON storage.objects;
DROP POLICY IF EXISTS "note_attachments_select_own_folder_notes 3b4ry2_0" ON storage.objects;
DROP POLICY IF EXISTS "note_attachments_update_own_folder _note 3b4ry2_0" ON storage.objects;
DROP POLICY IF EXISTS "note_attachments_delete_own_folder_note 3b4ry2_0" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own note attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own note attachments" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own note attachments" ON storage.objects;
DROP POLICY IF EXISTS "Public read access to note attachments" ON storage.objects;

-- Create correct storage policies for note attachments
CREATE POLICY "note_attachments_authenticated_insert"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = '0008-note-attachments' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "note_attachments_authenticated_select"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = '0008-note-attachments' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "note_attachments_authenticated_update"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = '0008-note-attachments' AND
    (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = '0008-note-attachments' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "note_attachments_authenticated_delete"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = '0008-note-attachments' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );
