/*
  # Create Reflection Attachments Storage and Table

  1. Storage Bucket
    - `0008-reflection-attachments` - Public bucket for reflection attachments
    - File size limit: 5MB per file
    - Allowed MIME types: images, PDFs, and common document types

  2. New Tables
    - `0008-ap-reflection-attachments`
      - `id` (uuid, primary key)
      - `reflection_id` (uuid, foreign key to reflections)
      - `user_id` (uuid, not null)
      - `file_name` (text, not null)
      - `file_path` (text, not null - storage path)
      - `file_type` (text, not null - MIME type)
      - `file_size` (integer, not null - bytes)
      - `created_at` (timestamptz, default now())

  3. Security
    - Enable RLS on attachments table
    - Users can only manage their own attachments
    - Public read access to storage for viewing
    - Authenticated write access for uploading
*/

-- Create reflection attachments storage bucket (public)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  '0008-reflection-attachments',
  '0008-reflection-attachments',
  true,
  5242880, -- 5MB
  ARRAY['image/*', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/*', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain'];

-- Create reflection attachments table
CREATE TABLE IF NOT EXISTS "0008-ap-reflection-attachments" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reflection_id uuid NOT NULL REFERENCES "0008-ap-reflections"(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_type text NOT NULL,
  file_size integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE "0008-ap-reflection-attachments" ENABLE ROW LEVEL SECURITY;

-- RLS Policies for reflection attachments
CREATE POLICY "Users can view own reflection attachments"
  ON "0008-ap-reflection-attachments"
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reflection attachments"
  ON "0008-ap-reflection-attachments"
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own reflection attachments"
  ON "0008-ap-reflection-attachments"
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Storage policies for reflection attachments bucket
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

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_reflection_attachments_reflection_id
  ON "0008-ap-reflection-attachments"(reflection_id);

CREATE INDEX IF NOT EXISTS idx_reflection_attachments_user_id
  ON "0008-ap-reflection-attachments"(user_id);

CREATE INDEX IF NOT EXISTS idx_reflection_attachments_reflection_user
  ON "0008-ap-reflection-attachments"(reflection_id, user_id);