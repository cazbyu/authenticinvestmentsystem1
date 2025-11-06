/*
  # Create Note Attachments Storage and Table

  1. Storage Bucket
    - `0008-note-attachments` - Public bucket for note attachments
    - File size limit: 5MB per file
    - Allowed MIME types: images, PDFs, and common document types

  2. New Tables
    - `0008-ap-note-attachments`
      - `id` (uuid, primary key)
      - `note_id` (uuid, foreign key to 0008-ap-notes)
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

-- Create note attachments storage bucket (public)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  '0008-note-attachments',
  '0008-note-attachments',
  true,
  5242880, -- 5MB
  ARRAY['image/*', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/*', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'text/plain'];

-- Create note attachments table
CREATE TABLE IF NOT EXISTS "0008-ap-note-attachments" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  note_id uuid NOT NULL,
  user_id uuid NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_type text NOT NULL,
  file_size integer NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE "0008-ap-note-attachments" ENABLE ROW LEVEL SECURITY;

-- RLS Policies for note attachments
CREATE POLICY "Users can view own note attachments"
  ON "0008-ap-note-attachments"
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own note attachments"
  ON "0008-ap-note-attachments"
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own note attachments"
  ON "0008-ap-note-attachments"
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Storage policies for note attachments bucket
CREATE POLICY "Users can upload their own note attachments"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = '0008-note-attachments' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update their own note attachments"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = '0008-note-attachments' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete their own note attachments"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = '0008-note-attachments' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Public read access to note attachments"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = '0008-note-attachments');

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_note_attachments_note_id
  ON "0008-ap-note-attachments"(note_id);

CREATE INDEX IF NOT EXISTS idx_note_attachments_user_id
  ON "0008-ap-note-attachments"(user_id);

CREATE INDEX IF NOT EXISTS idx_note_attachments_note_user
  ON "0008-ap-note-attachments"(note_id, user_id);
