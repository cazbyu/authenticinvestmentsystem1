/*
  # Create Weekly Alignments Table

  1. New Tables
    - `0008-ap-weekly-alignments`
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `week_start_date` (date, start of the week)
      - `week_end_date` (date, end of the week)
      - `content` (text, alignment content)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `0008-ap-weekly-alignments` table
    - Add policies for authenticated users to:
      - Read their own weekly alignments
      - Insert their own weekly alignments (one per week)
      - Update their own weekly alignments
      - Delete their own weekly alignments

  3. Constraints
    - Unique constraint on (user_id, week_start_date) to ensure one alignment per week
*/

-- Create weekly alignments table
CREATE TABLE IF NOT EXISTS "0008-ap-weekly-alignments" (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start_date date NOT NULL,
  week_end_date date NOT NULL,
  content text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),

  -- Ensure only one alignment per user per week
  UNIQUE(user_id, week_start_date)
);

-- Enable Row Level Security
ALTER TABLE "0008-ap-weekly-alignments" ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read their own alignments
CREATE POLICY "Users can read own weekly alignments"
  ON "0008-ap-weekly-alignments"
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Policy: Users can insert their own alignments
CREATE POLICY "Users can insert own weekly alignment"
  ON "0008-ap-weekly-alignments"
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own alignments
CREATE POLICY "Users can update own weekly alignments"
  ON "0008-ap-weekly-alignments"
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete their own alignments
CREATE POLICY "Users can delete own weekly alignments"
  ON "0008-ap-weekly-alignments"
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_weekly_alignments_user_week
  ON "0008-ap-weekly-alignments"(user_id, week_start_date DESC);

CREATE INDEX IF NOT EXISTS idx_weekly_alignments_user_id
  ON "0008-ap-weekly-alignments"(user_id);

-- Create trigger function for auto-updating timestamps
CREATE OR REPLACE FUNCTION update_weekly_alignments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply the trigger
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger
        WHERE tgname = 'update_weekly_alignments_updated_at_trigger'
    ) THEN
        CREATE TRIGGER update_weekly_alignments_updated_at_trigger
          BEFORE UPDATE ON "0008-ap-weekly-alignments"
          FOR EACH ROW
          EXECUTE FUNCTION update_weekly_alignments_updated_at();
    END IF;
END $$;