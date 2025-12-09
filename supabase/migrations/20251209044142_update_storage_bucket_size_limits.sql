/*
  # Update Storage Bucket Size Limits
  
  1. Changes
    - Update 0008-role-images bucket to 10MB (10485760 bytes)
    - Update 0008-key-relationship-images bucket to 10MB (10485760 bytes)
    - Update 0008-note-attachments bucket to 10MB (10485760 bytes)
    - Update 0008-reflection-attachments bucket to 10MB (10485760 bytes)
    - Keep 0008-ap-profile-images at 5MB (5242880 bytes)
  
  2. Security
    - No changes to existing RLS policies
    - Only updates file size limits on existing buckets
*/

-- Update role images bucket to 10MB
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  '0008-role-images',
  '0008-role-images',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) 
DO UPDATE SET 
  file_size_limit = 10485760;

-- Update key relationship images bucket to 10MB
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  '0008-key-relationship-images',
  '0008-key-relationship-images',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) 
DO UPDATE SET 
  file_size_limit = 10485760;

-- Update note attachments bucket to 10MB
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  '0008-note-attachments',
  '0008-note-attachments',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) 
DO UPDATE SET 
  file_size_limit = 10485760;

-- Update reflection attachments bucket to 10MB
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  '0008-reflection-attachments',
  '0008-reflection-attachments',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) 
DO UPDATE SET 
  file_size_limit = 10485760;

-- Ensure profile images bucket stays at 5MB
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  '0008-ap-profile-images',
  '0008-ap-profile-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) 
DO UPDATE SET 
  file_size_limit = 5242880;
