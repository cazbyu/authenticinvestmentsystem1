/*
  # Add Public SELECT Policy for Profile Images Storage Bucket

  ## Problem
  The storage bucket is configured as PUBLIC, but there's no policy allowing public access.
  Currently only authenticated users who own the images can view them.
  
  ## Changes
  1. Add a public SELECT policy to allow anyone to view profile images
  2. Keep INSERT, UPDATE, and DELETE policies restricted to authenticated owners
  3. This enables using getPublicUrl() instead of createSignedUrl() for better performance

  ## Security
  - Anyone can view profile images (bucket is public)
  - Only authenticated users can upload images to their own folder
  - Only authenticated users can modify/delete their own images
  - Folder structure enforces user isolation: userId/filename
*/

-- Drop existing view policy if it exists
DROP POLICY IF EXISTS "Anyone can view profile images" ON storage.objects;
DROP POLICY IF EXISTS "Users can view their own profile images" ON storage.objects;

-- Add public SELECT policy for profile images
CREATE POLICY "Anyone can view profile images"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = '0008-ap-profile-images');

-- Ensure existing ownership policies are correct
-- Drop and recreate upload policy to ensure correct folder check
DROP POLICY IF EXISTS "Users can upload their own profile images" ON storage.objects;
CREATE POLICY "Users can upload their own profile images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = '0008-ap-profile-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Drop and recreate update policy
DROP POLICY IF EXISTS "Users can update their own profile images" ON storage.objects;
CREATE POLICY "Users can update their own profile images"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = '0008-ap-profile-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Drop and recreate delete policy
DROP POLICY IF EXISTS "Users can delete their own profile images" ON storage.objects;
CREATE POLICY "Users can delete their own profile images"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = '0008-ap-profile-images'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
